// Roteamento determinístico e barato (plano, seção 10; arquitetura 03, 6.4): sem modelo no caminho principal.
// 1) só skills permitidas  2) similaridade entre o pedido e as intenções  3) regras por artefato  4) limiar.
// O vetor vem de um Embedder: léxico no desenvolvimento local e nos testes; Vertex AI na nuvem.
import { ROUTING_THRESHOLD } from '../../shared/src/limites.ts';

export interface Intencao { texto: string; negativa?: boolean }
export interface SkillRoteavel {
  id: string; nome: string; descricao: string; etapa: number; atalho?: string;
  intencoes: Intencao[]; proximo: string[];
  /** Padrões de caminho que indicam que a skill já produziu a saída dela (para o próximo passo). */
  sinais?: string[];
  /** Padrões de caminho que tornam a skill mais provável (insumo dela presente). */
  insumos?: string[];
}
export interface Candidata { skill: string; confianca: number; motivo: string }
export interface Embedder { vetor(texto: string): Map<number, number> }

const STOP = new Set('a o as os um uma de da do das dos em no na nos nas para por com que e ou se me eu meu minha esse essa este esta isso isto ao aos pra pro como quero preciso favor pode fazer faca faz'.split(' '));
export const normalizar = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_./ -]+/g, ' ').replace(/\s+/g, ' ').trim();
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 4096; };

/** Embedder léxico: palavras, pares de palavras e trechos de 4 letras, com peso por raridade (IDF) do corpus. */
export class EmbedderLexico implements Embedder {
  private idf = new Map<number, number>();
  private n = 0;
  private termos(texto: string): number[] {
    const palavras = normalizar(texto).split(' ').filter((p) => p.length > 1 && !STOP.has(p));
    const t: string[] = [];
    palavras.forEach((p, i) => { t.push(`w:${p}`); if (i) t.push(`b:${palavras[i - 1]}_${p}`); for (let k = 0; k + 4 <= p.length; k++) t.push(`c:${p.slice(k, k + 4)}`); });
    return t.map(hash);
  }
  treinar(corpus: string[]): void {
    this.n = corpus.length; const df = new Map<number, number>();
    for (const doc of corpus) for (const h of new Set(this.termos(doc))) df.set(h, (df.get(h) ?? 0) + 1);
    for (const [h, d] of df) this.idf.set(h, Math.log(1 + this.n / d));
  }
  vetor(texto: string): Map<number, number> {
    const v = new Map<number, number>();
    for (const h of this.termos(texto)) v.set(h, (v.get(h) ?? 0) + (this.idf.get(h) ?? Math.log(1 + (this.n || 1))));
    let norma = 0; for (const x of v.values()) norma += x * x; norma = Math.sqrt(norma) || 1;
    for (const [h, x] of v) v.set(h, x / norma);
    return v;
  }
}
const cosseno = (a: Map<number, number>, b: Map<number, number>): number => { let s = 0; const [m, M] = a.size < b.size ? [a, b] : [b, a]; for (const [h, x] of m) { const y = M.get(h); if (y) s += x * y; } return s; };

/** Casa um padrão simples com * e ** contra um caminho relativo. */
export function casaPadrao(padrao: string, caminho: string): boolean {
  const re = new RegExp('^' + padrao.split('**').map((p) => p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
  return re.test(caminho.replace(/\\/g, '/').replace(/^\.\//, ''));
}

export class Roteador {
  private skills: SkillRoteavel[];
  private embedder: Embedder;
  private vetores = new Map<string, Array<{ v: Map<number, number>; negativa: boolean; texto: string }>>();
  private limiar: number;
  constructor(skills: SkillRoteavel[], embedder?: Embedder, limiar: number = ROUTING_THRESHOLD) {
    this.skills = skills; this.limiar = limiar;
    if (embedder) this.embedder = embedder;
    else { const e = new EmbedderLexico(); e.treinar(skills.flatMap((s) => [s.descricao, ...s.intencoes.map((i) => i.texto)])); this.embedder = e; }
    for (const s of skills) this.vetores.set(s.id, [{ v: this.embedder.vetor(`${s.nome}. ${s.descricao}`), negativa: false, texto: s.descricao }, ...s.intencoes.map((i) => ({ v: this.embedder.vetor(i.texto), negativa: !!i.negativa, texto: i.texto }))]);
  }

  rotear(pedido: string, permitidas: Set<string>, artefatos: string[] = [], skillAtual?: string): { candidatas: Candidata[] } | { nao_sei: true; pergunta: string } {
    const q = this.embedder.vetor(pedido);
    const notas: Candidata[] = [];
    for (const s of this.skills) {
      if (!permitidas.has(s.id)) continue;
      let pos = 0, neg = 0, exemplo = '';
      for (const i of this.vetores.get(s.id)!) { const c = cosseno(q, i.v); if (i.negativa) neg = Math.max(neg, c); else if (c > pos) { pos = c; exemplo = i.texto; } }
      let nota = neg > pos ? pos * 0.4 : pos;
      const insumo = (s.insumos ?? []).find((p) => artefatos.some((a) => casaPadrao(p, a)));
      if (insumo) nota = Math.min(1, nota + 0.08);
      if (s.id === skillAtual) nota = Math.min(1, nota + 0.03);
      if (nota > 0) notas.push({ skill: s.id, confianca: Math.round(nota * 100) / 100, motivo: insumo ? `parecido com "${exemplo}"; insumo presente (${insumo})` : `parecido com "${exemplo}"` });
    }
    notas.sort((a, b) => b.confianca - a.confianca);
    if (!notas.length || notas[0]!.confianca < this.limiar) {
      const nomes = this.skills.filter((s) => permitidas.has(s.id)).map((s) => s.nome).slice(0, 6).join(', ');
      return { nao_sei: true, pergunta: nomes ? `Não identifiquei a skill com segurança. O pedido é sobre qual destas áreas: ${nomes}?` : 'Você ainda não tem skills liberadas. Peça acesso no portal.' };
    }
    return { candidatas: notas.slice(0, 3) };
  }

  /** Próxima skill da jornada, a partir dos artefatos que já existem no projeto. */
  proximoPasso(artefatos: string[], permitidas: Set<string>): { skill: string; motivo: string } | { fim: true } {
    const feitas = this.skills.filter((s) => (s.sinais ?? []).some((p) => artefatos.some((a) => casaPadrao(p, a))));
    if (!feitas.length) {
      const primeira = this.skills.filter((s) => permitidas.has(s.id)).sort((a, b) => a.etapa - b.etapa)[0];
      return primeira ? { skill: primeira.id, motivo: `Nenhum artefato do ciclo encontrado; ${primeira.nome} é a primeira etapa que você pode usar.` } : { fim: true };
    }
    const idsFeitas = new Set(feitas.map((s) => s.id));
    const ultima = feitas.sort((a, b) => b.etapa - a.etapa)[0]!;
    for (const origem of feitas.sort((a, b) => b.etapa - a.etapa)) for (const id of origem.proximo) {
      if (idsFeitas.has(id) || !permitidas.has(id)) continue;
      const alvo = this.skills.find((s) => s.id === id);
      if (alvo && alvo.etapa >= ultima.etapa) return { skill: id, motivo: `${origem.nome} já tem saída no projeto; o passo seguinte é ${alvo.nome}.` };
    }
    return { fim: true };
  }
}
