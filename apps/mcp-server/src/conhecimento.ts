// Base de conhecimento atrás da interface KnowledgeStore (arquitetura 03, 4.3.1). Esta implementação usa o Store
// (Firestore na nuvem), com isolamento por projeto e coleção na aplicação: por isso não recebe conhecimento confidencial.
import { randomBytes } from 'node:crypto';
import { OdinErro } from '../../../packages/shared/src/erros.ts';
import type { Store } from '../../../packages/shared/src/store.ts';
import { EmbedderLexico } from '../../../packages/router/src/router.ts';

export interface Trecho { documento: string; secao: string; versao?: string; vigencia?: string; colecao: string; projeto: string; tipo?: string; texto: string; sensibilidade?: string; [k: string]: unknown }
export interface Citado { texto: string; evidencia: true; citacao: { documento: string; secao: string; versao?: string; vigencia?: string } }

const INJECAO = /\b(ignore|desconsidere|esque[cç]a)\b.{0,40}\b(instru[cç][oõ]es|regras|anteriores)\b|\bnota para (o|a) (agente|revisor|ia|assistente)\b|\b(system prompt|voc[eê] agora [eé])\b/i;

export class Conhecimento {
  private store: Store;
  constructor(store: Store) { this.store = store; }

  /** Ingestão: recusa conhecimento confidencial neste armazenamento e texto com instrução dirigida a agentes. */
  async ingerir(t: Trecho): Promise<void> {
    if (t.sensibilidade === 'confidencial') throw new OdinErro('invalido', 'Conhecimento confidencial só entra com o banco de isolamento por projeto (Cloud SQL).');
    if (INJECAO.test(t.texto)) throw new OdinErro('invalido', 'Texto com instrução dirigida a agentes foi recusado na ingestão.');
    await this.store.set('kb_chunks', `${t.documento}#${t.secao}`.replace(/[/\s]+/g, '_'), t);
  }

  /** Busca só no que a pessoa pode ver: o filtro de projeto e coleção é aplicado antes da similaridade. */
  async buscar(consulta: string, o: { colecoes: string[]; projetos: string[]; tipo?: string; limite: number }): Promise<Citado[]> {
    const permitidos = new Set(['global', ...o.projetos]);
    const cand = await this.store.list<Trecho>('kb_chunks', (t) => o.colecoes.includes(t.colecao) && permitidos.has(t.projeto) && (!o.tipo || t.tipo === o.tipo));
    if (!cand.length) return [];
    const e = new EmbedderLexico(); e.treinar(cand.map((t) => t.texto));
    const q = e.vetor(consulta);
    const sim = (v: Map<number, number>) => { let s = 0; for (const [h, x] of q) { const y = v.get(h); if (y) s += x * y; } return s; };
    return cand.map((t) => ({ t, n: sim(e.vetor(`${t.secao}. ${t.texto}`)) })).filter((x) => x.n > 0.05).sort((a, b) => b.n - a.n).slice(0, o.limite)
      .map(({ t }) => ({ texto: t.texto, evidencia: true as const, citacao: { documento: t.documento, secao: t.secao, ...(t.versao ? { versao: t.versao } : {}), ...(t.vigencia ? { vigencia: t.vigencia } : {}) } }));
  }

  async propor(p: { colecao: string; projeto: string; texto: string; fonte: string; tipo: string; userId: string }): Promise<string> {
    if (INJECAO.test(p.texto)) throw new OdinErro('invalido', 'A proposta contém instrução dirigida a agentes e foi recusada.');
    const id = `prop_${randomBytes(6).toString('hex')}`;
    await this.store.set('proposals', id, { ...p, origem: 'skill', status: 'na_fila', criadaEm: Date.now() });
    return id;
  }
}
