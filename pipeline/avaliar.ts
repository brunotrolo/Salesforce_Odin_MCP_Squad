// Avaliações de comportamento por skill (ADR 0017): camada determinística (sem modelo) e portão de promoção beta → stable.
// A camada com modelo roda na máquina do mantenedor (`odin dev eval`) e grava o mesmo resultado.json.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

export interface Esperado { grader?: string; args?: Record<string, unknown>; arquivo_existe?: string; arquivo_ausente?: string; max_linhas?: { arquivo: string; linhas: number } }
export interface CasoEval { id: string; titulo: string; tipo: 'positivo' | 'negativo' | 'injecao' | 'limite'; critico?: boolean; camada: 'deterministica' | 'modelo'; fixture: string; pedido?: string; esperado: Esperado[] }
export interface ResultadoCaso { id: string; critico: boolean; resultado: 'passou' | 'falhou' | 'instavel'; repeticoes: Array<0 | 1>; motivo?: string }
export interface ResultadoEval { schema: 'odin.eval/1'; skill: string; sha: string; versao: string; gerado_em: string; repeticoes: number; nota: number; nota_stable_anterior?: number | null; casos: ResultadoCaso[] }
export const COMPOSICAO_MINIMA = { positivo: 4, negativo: 3, injecao: 2, limite: 1 } as const;

export function lerCasos(repo: string): CasoEval[] { return YAML.parse(readFileSync(join(repo, 'evals/casos.yaml'), 'utf8')) as CasoEval[]; }

/** Composição mínima do ADR 0017 (10 casos: 4 positivos, 3 negativos, 2 de injeção, 1 de limite). */
export function conferirComposicao(casos: CasoEval[]): string[] {
  const erros: string[] = []; if (casos.length < 10) erros.push(`são ${casos.length} casos; o mínimo é 10`);
  for (const [t, n] of Object.entries(COMPOSICAO_MINIMA)) { const c = casos.filter((x) => x.tipo === t).length; if (c < n) erros.push(`tipo ${t}: ${c} caso(s); o mínimo é ${n}`); }
  return erros;
}

function achar(dir: string, padrao: string): string[] {
  const re = new RegExp(`^${padrao.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
  const fora: string[] = []; const andar = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) andar(p); else if (re.test(relative(dir, p).replaceAll('\\', '/'))) fora.push(p); } };
  if (existsSync(dir)) andar(dir); return fora;
}

async function rodarCaso(repo: string, c: CasoEval): Promise<{ ok: boolean; motivo?: string }> {
  const trabalho = mkdtempSync(join(tmpdir(), 'odin-eval-'));
  try {
    cpSync(join(repo, 'evals', c.fixture), trabalho, { recursive: true });
    for (const e of c.esperado) {
      if (e.grader) {
        const mod = await import(`${pathToFileURL(join(repo, 'evals', e.grader)).href}?t=${Date.now()}`) as { default: (ctx: { dir: string; repo: string; args: Record<string, unknown> }) => Promise<{ ok: boolean; motivo?: string }> | { ok: boolean; motivo?: string } };
        const r = await mod.default({ dir: trabalho, repo, args: e.args ?? {} }); if (!r.ok) return { ok: false, motivo: `${e.grader}: ${r.motivo ?? 'recusado'}` };
      }
      if (e.arquivo_existe && !achar(trabalho, e.arquivo_existe).length) return { ok: false, motivo: `arquivo esperado não existe: ${e.arquivo_existe}` };
      if (e.arquivo_ausente && achar(trabalho, e.arquivo_ausente).length) return { ok: false, motivo: `arquivo não deveria existir: ${e.arquivo_ausente}` };
      if (e.max_linhas) { const a = achar(trabalho, e.max_linhas.arquivo)[0]; if (!a) return { ok: false, motivo: `arquivo ausente: ${e.max_linhas.arquivo}` }; const n = readFileSync(a, 'utf8').split('\n').length; if (n > e.max_linhas.linhas) return { ok: false, motivo: `${e.max_linhas.arquivo} tem ${n} linhas (máximo ${e.max_linhas.linhas})` }; }
    }
    return { ok: true };
  } catch (e) { return { ok: false, motivo: (e as Error).message.slice(0, 200) }; }
  finally { rmSync(trabalho, { recursive: true, force: true }); }
}

/** Camada determinística: roda os casos `deterministica`; os de `modelo` ficam de fora (rodam em `odin dev eval`). */
export async function avaliarDeterministico(o: { repo: string; skill: string; sha: string; versao: string; repeticoes?: number; notaStableAnterior?: number | null }): Promise<ResultadoEval & { ignorados: string[] }> {
  const casos = lerCasos(o.repo); const rep = o.repeticoes ?? 3; const res: ResultadoCaso[] = []; const ignorados: string[] = [];
  for (const c of casos) {
    if (c.camada !== 'deterministica') { ignorados.push(c.id); continue; }
    const rs: Array<0 | 1> = []; let motivo: string | undefined;
    for (let i = 0; i < rep; i++) { const r = await rodarCaso(o.repo, c); rs.push(r.ok ? 1 : 0); if (!r.ok) motivo = r.motivo; }
    const soma = rs.reduce<number>((a, b) => a + b, 0);
    res.push({ id: c.id, critico: !!c.critico, resultado: soma === rep ? 'passou' : soma === 0 ? 'falhou' : 'instavel', repeticoes: rs, ...(motivo && soma < rep ? { motivo } : {}) });
  }
  const nota = res.length ? Math.round((res.filter((r) => r.resultado === 'passou').length / res.length) * 1000) / 10 : 0;
  return { schema: 'odin.eval/1', skill: o.skill, sha: o.sha, versao: o.versao, gerado_em: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), repeticoes: rep, nota, nota_stable_anterior: o.notaStableAnterior ?? null, casos: res, ignorados };
}

/** Portão de promoção beta → stable (ADR 0017): relatório do SHA promovido, nota sem cair mais de 5 pontos, casos críticos todos verdes. */
export function portaoDePromocao(r: ResultadoEval, shaPromovido: string, notaStableAtual?: number | null): { ok: boolean; motivos: string[] } {
  const m: string[] = [];
  if (r.sha !== shaPromovido) m.push(`o relatório é do SHA ${r.sha.slice(0, 7)}, não do promovido (${shaPromovido.slice(0, 7)})`);
  if (notaStableAtual != null && r.nota < notaStableAtual - 5) m.push(`a nota caiu de ${notaStableAtual} para ${r.nota} (máximo de queda: 5 pontos)`);
  for (const c of r.casos) { if (c.critico && c.resultado !== 'passou') m.push(`caso crítico ${c.id} não passou`); if (c.resultado === 'instavel') m.push(`caso ${c.id} oscila entre repetições (instável)`); }
  return { ok: m.length === 0, motivos: m };
}
