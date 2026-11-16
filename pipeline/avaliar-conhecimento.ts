// Avaliação da recuperação (plano 11.3, item 5): perguntas com o documento esperado; mede recall@5 por coleção e a recusa de perguntas fora do assunto.
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import type { Conhecimento } from '../apps/mcp-server/src/conhecimento.ts';

export interface Pergunta { id: string; colecao: string; pergunta: string; esperado?: string; sem_resposta?: boolean }
export interface RelatorioRecuperacao { total: number; acertos: number; recall: number; porColecao: Record<string, { total: number; acertos: number; recall: number }>; semRespostaOk: number; semRespostaTotal: number; falhas: string[] }
export const lerPerguntas = (arquivo: string): Pergunta[] => YAML.parse(readFileSync(arquivo, 'utf8')) as Pergunta[];

export async function medirRecuperacao(kb: Conhecimento, perguntas: Pergunta[], projetos: string[], k = 5): Promise<RelatorioRecuperacao> {
  const porColecao: RelatorioRecuperacao['porColecao'] = {}; const falhas: string[] = []; let acertos = 0, total = 0, semOk = 0, semTotal = 0;
  for (const p of perguntas) {
    const r = await kb.buscar(p.pergunta, { colecoes: ['funcional', 'negocio', 'tecnico', 'licoes', 'dados'], projetos, limite: k });
    if (p.sem_resposta) { semTotal++; if (r.length === 0) semOk++; else falhas.push(`${p.id}: pergunta fora do assunto trouxe ${r[0]!.citacao.documento}`); continue; }
    const c = (porColecao[p.colecao] ??= { total: 0, acertos: 0, recall: 0 }); c.total++; total++;
    if (r.some((x) => x.citacao.documento === p.esperado)) { c.acertos++; acertos++; } else falhas.push(`${p.id}: esperado ${p.esperado}, veio ${r.map((x) => x.citacao.documento).join(', ') || 'nada'}`);
  }
  for (const c of Object.values(porColecao)) c.recall = c.total ? c.acertos / c.total : 0;
  return { total, acertos, recall: total ? acertos / total : 0, porColecao, semRespostaOk: semOk, semRespostaTotal: semTotal, falhas };
}
