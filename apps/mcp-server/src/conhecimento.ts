// Base de conhecimento atrás da interface KnowledgeStore (arquitetura 03, 4.3.1). Esta implementação usa o Store
// (Firestore na nuvem), com isolamento por projeto e coleção na aplicação: por isso não recebe conhecimento confidencial.
import { randomBytes } from 'node:crypto';
import { OdinErro } from '../../../packages/shared/src/erros.ts';
import type { Store } from '../../../packages/shared/src/store.ts';
import { EmbedderLexico } from '../../../packages/router/src/router.ts';
import { cosseno, type EmbedderDenso } from '../../../packages/shared/src/nuvem/vertex.ts';

export interface Trecho { documento: string; secao: string; versao?: string; vigencia?: string; colecao: string; projeto: string; tipo?: string; texto: string; sensibilidade?: string; [k: string]: unknown }
export interface Citado { texto: string; evidencia: true; citacao: { documento: string; secao: string; versao?: string; vigencia?: string } }

const INJECAO = /\b(ignore|desconsidere|esque[cç]a)\b.{0,40}\b(instru[cç][oõ]es|regras|anteriores)\b|\bnota para (o|a) (agente|revisor|ia|assistente)\b|\b(system prompt|voc[eê] agora [eé])\b/i;

export class Conhecimento {
  private store: Store; private denso?: EmbedderDenso; private corte: number;
  /** `denso` (Vertex AI) ativa a busca híbrida; sem ele (ou se falhar) a busca é só lexical. `corte` é a nota mínima da busca híbrida. */
  constructor(store: Store, denso?: EmbedderDenso, corte = Number(process.env.KB_CORTE_HIBRIDO ?? 0.45)) { this.store = store; this.denso = denso; this.corte = corte; }

  /** Ingestão: recusa conhecimento confidencial neste armazenamento e texto com instrução dirigida a agentes. */
  async ingerir(t: Trecho): Promise<void> {
    if (t.sensibilidade === 'confidencial') throw new OdinErro('invalido', 'Conhecimento confidencial só entra com o banco de isolamento por projeto (Cloud SQL).');
    if (INJECAO.test(t.texto)) throw new OdinErro('invalido', 'Texto com instrução dirigida a agentes foi recusado na ingestão.');
    await this.store.set('kb_chunks', `${t.documento}#${t.secao}`.replace(/[/\s]+/g, '_'), t);
  }

  /** Busca só no que a pessoa pode ver: o filtro de projeto e coleção é aplicado antes da similaridade. Texto substituído ou fora da vigência não volta. */
  async buscar(consulta: string, o: { colecoes: string[]; projetos: string[]; tipo?: string; limite: number }): Promise<Citado[]> {
    const permitidos = new Set(['global', ...o.projetos]); const hoje = new Date().toISOString().slice(0, 10);
    const cand = await this.store.list<Trecho>('kb_chunks', (t) => o.colecoes.includes(t.colecao) && permitidos.has(t.projeto) && (!o.tipo || t.tipo === o.tipo) && !t.substituido && !(typeof t.vigenciaAte === 'string' && t.vigenciaAte < hoje));
    if (!cand.length) return [];
    const e = new EmbedderLexico(); e.treinar(cand.map((t) => t.texto));
    const q = e.vetor(consulta);
    const sim = (v: Map<number, number>) => { let s = 0; for (const [h, x] of q) { const y = v.get(h); if (y) s += x * y; } return s; };
    const lex = cand.map((t) => ({ t, n: sim(e.vetor(`${t.secao}. ${t.texto}`)) }));
    let pontuado = lex.filter((x) => x.n > 0.05).sort((a, b) => b.n - a.n);
    const comVetor = cand.filter((t) => Array.isArray(t.vetor));
    if (this.denso && comVetor.length) {
      try {
        const [qv] = await this.denso.incorporar([consulta], 'consulta');
        // Trecho com embedding: nota híbrida acima do corte. Trecho sem embedding (ex.: proposta aprovada no portal): vale a nota lexical, para nunca sumir da busca.
        const todos = lex.map(({ t, n }) => ({ t, n: Array.isArray(t.vetor) ? 0.65 * cosseno(qv!, t.vetor as number[]) + 0.35 * Math.min(1, n) : n, ok: Array.isArray(t.vetor) ? undefined : n > 0.05 }))
          ;
        if (process.env.KB_DIAGNOSTICO === '1') console.error(JSON.stringify({ kb_sem_corte: consulta.slice(0, 40), topo: [...todos].sort((a, b) => b.n - a.n).slice(0, 3).map((x) => [x.t.documento, Number(x.n.toFixed(3))]) }));
        pontuado = todos.filter((x) => (x.ok === undefined ? x.n >= this.corte : x.ok)).sort((a, b) => b.n - a.n);
      } catch { /* sem a Vertex AI, vale a busca lexical */ }
    }
    if (process.env.KB_DIAGNOSTICO === '1') console.error(JSON.stringify({ kb: consulta.slice(0, 40), topo: pontuado.slice(0, 3).map((x) => [x.t.documento, Number(x.n.toFixed(3))]) }));
    return pontuado.slice(0, o.limite).map(({ t }) => ({ texto: t.texto, evidencia: true as const, citacao: { documento: t.documento, secao: t.secao, ...(t.versao ? { versao: t.versao } : {}), ...(t.vigencia ? { vigencia: t.vigencia } : {}) } }));
  }

  async propor(p: { colecao: string; projeto: string; texto: string; fonte: string; tipo: string; userId: string }): Promise<string> {
    if (INJECAO.test(p.texto)) throw new OdinErro('invalido', 'A proposta contém instrução dirigida a agentes e foi recusada.');
    const id = `prop_${randomBytes(6).toString('hex')}`;
    await this.store.set('proposals', id, { ...p, origem: 'skill', status: 'na_fila', criadaEm: Date.now() });
    return id;
  }
}
