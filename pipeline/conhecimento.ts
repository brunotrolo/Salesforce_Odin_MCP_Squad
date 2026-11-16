// Pipeline de conhecimento (plano, seção 11.3): valida o frontmatter, mascara dados pessoais, recusa instrução injetada e Unicode oculto,
// divide por seção, gera embeddings e grava no Firestore. Lê a pasta `conhecimento/` (formato do repositório odin-knowledge).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import YAML from 'yaml';
import { Conhecimento } from '../apps/mcp-server/src/conhecimento.ts';
import type { EmbedderDenso } from '../packages/shared/src/nuvem/vertex.ts';
import type { Store } from '../packages/shared/src/store.ts';

export const COLECOES = ['funcional', 'negocio', 'tecnico', 'licoes', 'dados'] as const; const TIPOS = ['padrao', 'regra', 'decisao', 'glossario', 'licao'];
export interface Documento { arquivo: string; id: string; tipo: string; colecao: string; projeto: string; autoridade: number; dono: string; sensibilidade: string; vigenciaDe: string; vigenciaAte: string | null; substitui: string[]; titulo: string; corpo: string }
const INJECAO = /\b(ignore|desconsidere|esque[cç]a)\b.{0,40}\b(instru[cç][oõ]es|regras|anteriores)\b|\bnota para (o|a) (agente|revisor|ia|assistente)\b|\b(system prompt|voc[eê] agora [eé])\b/i;
const OCULTO = /[​-‏‪-‮⁠-⁤⁦-⁩­᠎]|[\u{E0000}-\u{E007F}]|[\u{E0100}-\u{E01EF}]/u;

export function mascararPii(t: string): { texto: string; mascarados: number } {
  let n = 0; const sub = (re: RegExp, r: string) => { t = t.replace(re, () => { n++; return r; }); };
  sub(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]'); sub(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ]'); sub(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[EMAIL]'); sub(/\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/g, '[TELEFONE]');
  return { texto: t, mascarados: n };
}
function arquivosMd(dir: string, saida: string[] = []): string[] { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) arquivosMd(p, saida); else if (n.endsWith('.md') && n !== 'LEIA-ME.md') saida.push(p); } return saida; }

export function lerFonte(dir: string): { docs: Documento[]; erros: string[] } {
  const docs: Documento[] = []; const erros: string[] = [];
  if (!existsSync(dir)) return { docs, erros: [`pasta ${dir} não existe`] };
  for (const f of arquivosMd(dir).sort()) {
    const rel = relative(dir, f).replaceAll('\\', '/'); const bruto = readFileSync(f, 'utf8'); const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(bruto);
    if (!m) { erros.push(`${rel}: sem frontmatter`); continue; }
    let fm: Record<string, any>; try { fm = YAML.parse(m[1]!) ?? {}; } catch { erros.push(`${rel}: frontmatter ilegível`); continue; }
    const e = (msg: string) => erros.push(`${rel}: ${msg}`);
    if (!/^[A-Z]{3}-[A-Z0-9]+-\d{3}$/.test(String(fm.id ?? ''))) e('id inválido (ex.: TEC-APEX-001)');
    if (!TIPOS.includes(fm.tipo)) e(`tipo inválido (${TIPOS.join(', ')})`); if (!(COLECOES as readonly string[]).includes(fm.colecao)) e(`coleção inválida (${COLECOES.join(', ')})`);
    if (!rel.startsWith(`${fm.colecao}/`)) e('o arquivo precisa estar na pasta da sua coleção');
    if (!fm.projeto) e('falta projeto'); if (!Number.isInteger(fm.autoridade) || fm.autoridade < 1 || fm.autoridade > 5) e('autoridade deve ser de 1 a 5');
    if (!['publica', 'interna', 'confidencial'].includes(fm.sensibilidade)) e('sensibilidade inválida'); else if (fm.sensibilidade === 'confidencial') e('conhecimento confidencial só entra com o banco de isolamento por projeto (Cloud SQL)');
    const de = fm.vigencia?.de instanceof Date ? fm.vigencia.de.toISOString().slice(0, 10) : String(fm.vigencia?.de ?? ''); const ate = fm.vigencia?.ate ? (fm.vigencia.ate instanceof Date ? fm.vigencia.ate.toISOString().slice(0, 10) : String(fm.vigencia.ate)) : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de)) e('vigencia.de inválida'); if (ate && ate < de) e('vigência termina antes de começar');
    if (OCULTO.test(bruto)) e('caractere Unicode invisível'); if (INJECAO.test(m[2]!)) e('instrução dirigida a agentes');
    const titulo = /^#\s+(.+)$/m.exec(m[2]!)?.[1]?.trim() ?? String(fm.id);
    docs.push({ arquivo: rel, id: String(fm.id), tipo: fm.tipo, colecao: fm.colecao, projeto: String(fm.projeto), autoridade: fm.autoridade, dono: String(fm.dono ?? ''), sensibilidade: fm.sensibilidade, vigenciaDe: de, vigenciaAte: ate, substitui: (fm.substitui ?? []).map(String), titulo, corpo: m[2]! });
  }
  const ids = new Set(docs.map((d) => d.id)); const vistos = new Set<string>();
  for (const d of docs) { if (vistos.has(d.id)) erros.push(`${d.arquivo}: id repetido ${d.id}`); vistos.add(d.id); for (const s of d.substitui) if (!ids.has(s)) erros.push(`${d.arquivo}: substitui ${s}, que não existe`); }
  return { docs, erros };
}

/** Divide por seção `##`, sem quebrar blocos de código nem tabelas (o cabeçalho de seção só vale fora de bloco de código). */
export function dividirSecoes(corpo: string): Array<{ secao: string; texto: string }> {
  const saida: Array<{ secao: string; texto: string }> = []; let atual = { secao: 'Resumo', linhas: [] as string[] }; let cerca = false;
  for (const l of corpo.split('\n')) {
    if (/^```/.test(l.trim())) cerca = !cerca;
    const h = !cerca && /^##\s+(.+)$/.exec(l);
    if (h) { saida.push({ secao: atual.secao, texto: atual.linhas.join('\n').trim() }); atual = { secao: h[1]!.trim(), linhas: [] }; } else if (!/^#\s/.test(l) || cerca) atual.linhas.push(l);
  }
  saida.push({ secao: atual.secao, texto: atual.linhas.join('\n').trim() });
  return saida.filter((s) => s.texto.length > 0);
}

export interface ResultadoIndexacao { documentos: number; trechos: number; mascarados: number; substituidos: number; removidos: number }
export async function indexar(o: { dir: string; store: Store; denso?: EmbedderDenso; origem?: string }): Promise<ResultadoIndexacao> {
  const { docs, erros } = lerFonte(o.dir); if (erros.length) throw new Error(`A fonte de conhecimento tem ${erros.length} problema(s):\n- ${erros.join('\n- ')}`);
  const origem = o.origem ?? 'odin-knowledge'; const kb = new Conhecimento(o.store); const substituidos = new Set(docs.flatMap((d) => d.substitui));
  const trechos: Array<Record<string, unknown> & { documento: string; secao: string; colecao: string; projeto: string; texto: string }> = []; let mascarados = 0;
  for (const d of docs) for (const s of dividirSecoes(d.corpo)) {
    const m = mascararPii(s.texto); mascarados += m.mascarados;
    trechos.push({ documento: d.id, secao: s.secao, versao: d.vigenciaDe, vigencia: d.vigenciaAte ? `${d.vigenciaDe}..${d.vigenciaAte}` : `${d.vigenciaDe}..`, vigenciaAte: d.vigenciaAte ?? undefined, colecao: d.colecao, projeto: d.projeto, tipo: d.tipo, texto: m.texto, sensibilidade: d.sensibilidade, autoridade: d.autoridade, titulo: d.titulo, substituido: substituidos.has(d.id) || undefined, origem });
  }
  if (o.denso && trechos.length) { const v = await o.denso.incorporar(trechos.map((t) => `${String(t.titulo)}. ${t.secao}: ${t.texto}`), 'documento'); trechos.forEach((t, i) => { t.vetor = v[i]; }); }
  const novos = new Set(trechos.map((t) => `${t.documento}#${t.secao}`.replace(/[/\s]+/g, '_'))); let removidos = 0;
  for (const antigo of await o.store.list('kb_chunks', (x) => x.origem === origem)) if (!novos.has(antigo.id)) { await o.store.delete('kb_chunks', antigo.id); removidos++; }
  for (const t of trechos) await kb.ingerir(t as never);
  return { documentos: docs.length, trechos: trechos.length, mascarados, substituidos: substituidos.size, removidos };
}
