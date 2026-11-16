// Cópias antigas de skills dentro dos projetos (de antes do Odin): `odin doctor --limpar-copias` arquiva e remove,
// `odin restore-copias` devolve (plano 23.3: por 30 dias). Nada é apagado sem antes existir o pacote de arquivo.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { desempacotar, empacotar, type Arquivos } from '../../shared/src/pacote.ts';
import { caminhos, gravarAtomico, lerJsonArquivo } from './ambiente.ts';

export const DIAS_DE_ARQUIVO = 30; const LIMITE_BYTES = 50 * 1024 * 1024;
interface Entrada { pacote: string; projeto: string; em: number; arquivos: number }
const pastaArquivo = () => join(caminhos().odin, 'arquivo-copias');
const indiceArq = () => join(pastaArquivo(), 'indice.json');

function arquivosDe(projeto: string, rel: string, saida: string[]): void {
  const abs = join(projeto, rel); if (!existsSync(abs)) return;
  if (statSync(abs).isDirectory()) { for (const n of readdirSync(abs)) arquivosDe(projeto, join(rel, n), saida); } else saida.push(rel.replaceAll('\\', '/'));
}
/** Cópias antigas que existem de fato neste projeto (caminhos relativos), a partir dos caminhos declarados nos manifestos das skills. */
export function copiasNoProjeto(projeto: string, declaradas: string[]): string[] {
  const achados: string[] = []; for (const d of new Set(declaradas)) { if (d.includes('..') || d.startsWith('/')) continue; arquivosDe(projeto, d, achados); } return achados.sort();
}
export function arquivarCopias(projeto: string, arquivos: string[], agora = Date.now()): { pacote: string; n: number } {
  const dados: Arquivos = {}; let total = 0;
  for (const rel of arquivos) { const b = readFileSync(join(projeto, rel)); total += b.length; if (total > LIMITE_BYTES) throw new Error('As cópias passam de 50 MB; arquive manualmente.'); dados[rel] = b; }
  const pacote = empacotar(dados); const nome = `${new Date(agora).toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${createHash('sha256').update(resolve(projeto)).digest('hex').slice(0, 8)}.odinpkg`;
  const arq = join(pastaArquivo(), nome); gravarAtomico(arq, pacote);
  const idx = lerJsonArquivo<{ entradas: Entrada[] }>(indiceArq()) ?? { entradas: [] }; idx.entradas.push({ pacote: nome, projeto: resolve(projeto), em: agora, arquivos: arquivos.length }); gravarAtomico(indiceArq(), JSON.stringify(idx, null, 2));
  return { pacote: arq, n: arquivos.length };
}
export function removerCopias(projeto: string, arquivos: string[]): void {
  for (const rel of arquivos) rmSync(join(projeto, rel), { force: true });
  for (const rel of new Set(arquivos.map((a) => dirname(a)))) { let d = join(projeto, rel); while (d !== resolve(projeto) && existsSync(d) && readdirSync(d).length === 0) { rmSync(d, { recursive: true }); d = dirname(d); } }
}
/** Devolve as cópias arquivadas deste projeto (a mais recente). Não sobrescreve arquivos que já existem. */
export function restaurarCopias(projeto: string, agora = Date.now()): { restaurados: number; pulados: number; pacote: string } {
  const idx = lerJsonArquivo<{ entradas: Entrada[] }>(indiceArq()); const alvo = resolve(projeto);
  const e = [...(idx?.entradas ?? [])].reverse().find((x) => x.projeto === alvo);
  if (!e) throw new Error('Não há cópias arquivadas deste projeto.');
  if (agora - e.em > DIAS_DE_ARQUIVO * 86_400_000) throw new Error(`O arquivo deste projeto tem mais de ${DIAS_DE_ARQUIVO} dias e expirou.`);
  const arquivos = desempacotar(readFileSync(join(pastaArquivo(), e.pacote))); let restaurados = 0, pulados = 0;
  for (const [rel, b] of Object.entries(arquivos)) { const dest = join(projeto, rel); if (relative(projeto, dest).startsWith('..')) continue; if (existsSync(dest)) { pulados++; continue; } mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, b); restaurados++; }
  return { restaurados, pulados, pacote: join(pastaArquivo(), e.pacote) };
}
