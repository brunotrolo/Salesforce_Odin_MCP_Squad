// Políticas de guard por skill (ADR 0027): o que era hook na skill vira um módulo `politicas/<id>.mjs` dentro do runtime assinado.
// Só valem as políticas das skills que passaram por `odin ensure` NA SESSÃO atual; as globais (PG-01 a PG-08) continuam valendo sempre.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Ambiente, Evento } from './politicas.ts';

export type DecisaoSkill = { decisao: 'permitir' | 'negar' | 'perguntar' | 'alertar'; politica?: string; motivo?: string };
/** Contrato do módulo: função pura, síncrona, sem E/S. Devolve null (sem opinião) ou a decisão. */
export type PoliticaDeSkill = (evento: Evento, ambiente: Ambiente) => { decisao: 'negar' | 'perguntar' | 'alertar'; motivo: string } | null | undefined;

const ARQUIVO = 'sessoes-skills.json'; const MAX_SESSOES = 50; const ID = /^[a-z][a-z0-9-]*$/;
type Mapa = Record<string, { ts: number; skills: string[] }>;
const ler = (odinHome: string): Mapa => { try { return JSON.parse(readFileSync(join(odinHome, 'cache', ARQUIVO), 'utf8')) as Mapa; } catch { return {}; } };

/** Chamado quando o guard vê `odin ensure <skill>` passar: a skill passa a valer nesta sessão. */
export function registrarSkillNaSessao(odinHome: string, sessao: string | undefined, skill: string): void {
  if (!sessao || !ID.test(skill)) return;
  const m = ler(odinHome); const atual = m[sessao] ?? { ts: 0, skills: [] };
  m[sessao] = { ts: Date.now(), skills: [...new Set([...atual.skills, skill])] };
  const recentes = Object.entries(m).sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_SESSOES);
  mkdirSync(join(odinHome, 'cache'), { recursive: true }); writeFileSync(join(odinHome, 'cache', ARQUIVO), JSON.stringify(Object.fromEntries(recentes)));
}
export const skillsDaSessao = (odinHome: string, sessao: string | undefined): string[] => (sessao ? (ler(odinHome)[sessao]?.skills ?? []).filter((s) => ID.test(s)) : []);

const PESO = { negar: 3, perguntar: 2, alertar: 1 } as const;
/** Aplica as políticas das skills ativas na sessão. Falha de carga ou exceção = nega (fail-closed), citando a skill. */
export async function avaliarPoliticasDeSkill(e: Evento, a: Ambiente): Promise<DecisaoSkill> {
  let melhor: DecisaoSkill = { decisao: 'permitir' };
  for (const skill of skillsDaSessao(a.odinHome, e.session_id)) {
    const dir = join(a.odinHome, 'runtime', skill, 'current', 'scripts', 'politicas'); if (!existsSync(dir)) continue;
    for (const arq of readdirSync(dir).filter((f) => /^[a-z][a-z0-9-]*\.mjs$/.test(f)).sort()) {
      try {
        const mod = (await import(pathToFileURL(join(dir, arq)).href)) as { default?: PoliticaDeSkill };
        if (typeof mod.default !== 'function') throw new Error('o módulo não exporta a função padrão');
        const r = mod.default(e, a);
        if (r && PESO[r.decisao] > (melhor.decisao === 'permitir' ? 0 : PESO[melhor.decisao])) melhor = { decisao: r.decisao, politica: `${skill}/${arq.replace(/\.mjs$/, '')}`, motivo: `${r.motivo} (política da skill ${skill}; se for um engano, rode \`odin doctor\`)` };
      } catch (err) { return { decisao: 'negar', politica: `${skill}/${arq}`, motivo: `A política da skill ${skill} falhou ao avaliar e, por segurança, bloqueou (${err instanceof Error ? err.message : 'erro'}). Rode \`odin doctor\`.` }; }
    }
  }
  return melhor;
}
