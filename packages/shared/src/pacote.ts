// Pacote do Odin (.odinpkg): JSON canônico { arquivos: { caminho: base64 } } comprimido com gzip.
// Determinístico (mesma entrada → mesmo hash), sem dependência externa e conferível arquivo a arquivo (ADR 0020).
import { gunzipSync, gzipSync } from 'node:zlib';
import { canonico, sha256hex } from './chaves.ts';

export type Arquivos = Record<string, Buffer>;
const caminhoSeguro = (c: string): boolean => !c.startsWith('/') && !c.includes('..') && !c.includes('\\') && c.length > 0 && c.length < 300;

export function empacotar(arquivos: Arquivos): Buffer {
  const obj: Record<string, string> = {};
  for (const c of Object.keys(arquivos).sort()) { if (!caminhoSeguro(c)) throw new Error(`caminho inválido no pacote: ${c}`); obj[c] = arquivos[c]!.toString('base64'); }
  return gzipSync(Buffer.from(canonico({ arquivos: obj })), { level: 9 });
}
export function desempacotar(pacote: Buffer, limiteBytes = 200 * 1024 * 1024): Arquivos {
  const bruto = gunzipSync(pacote, { maxOutputLength: limiteBytes });
  const obj = JSON.parse(bruto.toString('utf8')).arquivos as Record<string, string>;
  const out: Arquivos = {};
  for (const [c, b] of Object.entries(obj)) { if (!caminhoSeguro(c)) throw new Error(`caminho inválido no pacote: ${c}`); out[c] = Buffer.from(b, 'base64'); }
  return out;
}
export const hashesDosArquivos = (arquivos: Arquivos, prefixo: string): Record<string, string> => Object.fromEntries(Object.keys(arquivos).sort().map((c) => [`${prefixo}/${c}`, `sha256:${sha256hex(arquivos[c]!)}`]));
