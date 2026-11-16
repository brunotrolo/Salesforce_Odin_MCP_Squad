// Direitos efetivos resolvidos no servidor a cada chamada, com cache de 30 s (ADR-05; segurança 04). Negado por padrão.
import { OdinErro } from '../../../packages/shared/src/erros.ts';
import { REVOCATION_CACHE_SECONDS } from '../../../packages/shared/src/limites.ts';
import type { Store } from '../../../packages/shared/src/store.ts';
import type { Direitos } from './contexto.ts';

interface Perfil { skills: string[]; colecoes: Record<string, 'ler' | 'propor' | 'curar'>; canais: string[] }
const NIVEL = { ler: 1, propor: 2, curar: 3 } as const;

export class ResolvedorDeDireitos {
  private cache = new Map<string, { ate: number; d: Direitos; dispositivos: Map<string, boolean>; globalDesde: number }>();
  private store: Store; private agora: () => number;
  constructor(store: Store, agora: () => number = Date.now) { this.store = store; this.agora = agora; }

  private async carregar(userId: string) {
    const u = await this.store.get('users', userId);
    const d: Direitos = { userId, status: u?.status === 'ativo' ? 'ativo' : 'suspenso', policyVersion: Number(u?.policyVersion ?? 0), perfis: [], squads: [], projetos: [], skills: new Map(), colecoes: {} };
    if (u && d.status === 'ativo') {
      const t = this.agora();
      for (const m of await this.store.list('memberships', (x) => x.userId === userId && (!x.expiraEm || Number(x.expiraEm) > t))) {
        d.squads.push(String(m.squadId));
        const sq = await this.store.get('squads', String(m.squadId));
        for (const p of (sq?.projetos as string[] | undefined) ?? []) if (!d.projetos.includes(p)) d.projetos.push(p);
        for (const nome of (m.perfis as string[] | undefined) ?? []) {
          if (!d.perfis.includes(nome)) d.perfis.push(nome);
          const p = await this.store.get<Perfil & Record<string, unknown>>('profiles', nome);
          if (!p) continue;
          const canal = p.canais?.includes('beta') ? 'beta' : 'stable';
          for (const s of p.skills ?? []) if (canal === 'beta' || !d.skills.has(s)) d.skills.set(s, canal);
          for (const [c, n] of Object.entries(p.colecoes ?? {})) if (!d.colecoes[c] || NIVEL[n] > NIVEL[d.colecoes[c]]) d.colecoes[c] = n;
        }
      }
      for (const g of await this.store.list('grants', (x) => x.userId === userId && Number(x.expiraEm) > t)) {
        if (g.alvoTipo === 'skill') d.skills.set(String(g.alvo), d.skills.get(String(g.alvo)) ?? 'stable');
        if (g.alvoTipo === 'colecao') d.colecoes[String(g.alvo)] = (g.nivel as 'ler') ?? 'ler';
      }
    }
    const dispositivos = new Map<string, boolean>();
    for (const x of await this.store.list('devices', (y) => y.userId === userId)) dispositivos.set(x.id, x.status === 'ativo');
    const globalDesde = Number((await this.store.get('revocations', 'global'))?.desde ?? 0);
    return { ate: this.agora() + REVOCATION_CACHE_SECONDS * 1000, d, dispositivos, globalDesde };
  }

  /** Devolve os direitos atuais ou lança `revogado`. Nunca usa direitos mais antigos que o cache de 30 s. */
  async resolver(userId: string, dispositivo: string, iatSegundos: number): Promise<Direitos> {
    let e = this.cache.get(userId);
    if (!e || e.ate <= this.agora()) { e = await this.carregar(userId); this.cache.set(userId, e); if (this.cache.size > 5000) this.cache.clear(); }
    // Dispositivo que o cache não conhece (ativado depois da última leitura): recarrega antes de negar, para o uso imediato funcionar.
    if (!e.dispositivos.has(dispositivo)) { e = await this.carregar(userId); this.cache.set(userId, e); }
    if (e.d.status !== 'ativo') throw new OdinErro('revogado', 'Seu acesso ao Odin está suspenso. Fale com um administrador.');
    if (e.dispositivos.get(dispositivo) !== true) throw new OdinErro('revogado', 'Este dispositivo foi revogado. Rode "odin setup" para ativar de novo.');
    if (iatSegundos * 1000 < e.globalDesde) throw new OdinErro('revogado', 'Todas as sessões foram encerradas por segurança. Rode "odin login".');
    return e.d;
  }
  esquecer(userId?: string): void { if (userId) this.cache.delete(userId); else this.cache.clear(); }
}
