// Bibliotecas de terceiros compartilhadas (ADR 0028): `libs/<id>/` guarda uma cópia canônica com versão, licença e NOTICE.
// A skill declara `usa: [lib-x@^1]`; o lint confere a existência e a versão e o publicador inclui a lib no runtime assinado da skill.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const LIBS_PADRAO = join(dirname(fileURLToPath(import.meta.url)), '../../../libs');
export interface Lib { id: string; versao: string; grupo: string; licenca: string; origem: string; itens: string[]; dir: string }
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function lerLib(libsDir: string, id: string): Lib | null {
  const arq = join(libsDir, id, 'lib.yaml'); if (!existsSync(arq)) return null;
  const y = YAML.parse(readFileSync(arq, 'utf8')) as Partial<Lib>;
  return { id: String(y.id), versao: String(y.versao), grupo: String(y.grupo), licenca: String(y.licenca), origem: String(y.origem ?? ''), itens: (y.itens ?? []).map(String), dir: join(libsDir, id) };
}
/** `lib-x@^1`, `lib-x@~1.2`, `lib-x@1.0.3`: devolve o erro ou null. */
export function conferirUso(libsDir: string, ref: string): { lib?: Lib; erro?: string } {
  const m = /^(lib-[a-z0-9-]+)@([\^~]?)(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(ref); if (!m) return { erro: `usa: "${ref}" não segue lib-<nome>@<versão>` };
  const lib = lerLib(libsDir, m[1]!); if (!lib) return { erro: `usa: a biblioteca ${m[1]} não existe em libs/` };
  const v = SEMVER.exec(lib.versao); if (!v) return { erro: `usa: ${lib.id} tem versão inválida (${lib.versao})` };
  const [maior, menor, patch] = [Number(m[3]), m[4] === undefined ? undefined : Number(m[4]), m[5] === undefined ? undefined : Number(m[5])]; const [a, b, c] = [Number(v[1]), Number(v[2]), Number(v[3])];
  const ok = m[2] === '^' ? a === maior && (b > (menor ?? 0) || (b === (menor ?? 0) && c >= (patch ?? 0)))
    : m[2] === '~' ? a === maior && b === (menor ?? b) && c >= (patch ?? 0)
      : a === maior && (menor === undefined || b === menor) && (patch === undefined || c === patch);
  return ok ? { lib } : { erro: `usa: ${ref} não é satisfeita por ${lib.id}@${lib.versao}` };
}
export function arquivosDaLib(lib: Lib): Record<string, Buffer> {
  const saida: Record<string, Buffer> = {}; const raiz = join(lib.dir, 'conteudo');
  const andar = (d: string) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) andar(p); else saida[relative(raiz, p).replace(/\\/g, '/')] = readFileSync(p); } };
  andar(raiz);
  for (const n of ['LICENSE', 'NOTICE']) if (existsSync(join(lib.dir, n))) saida[n] = readFileSync(join(lib.dir, n));
  return saida;
}
/** Troca os caminhos de origem das libs pelo caminho do runtime: `.claude/skills/<grupo>/<item>` e a forma plana `.claude/skills/<item>`. */
export function reescreverComLibs(texto: string, libs: Lib[]): string {
  let t = texto; const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const lib of libs) {
    for (const item of [...lib.itens].sort((a, b) => b.length - a.length)) {
      const para = `{{ODIN_RUNTIME}}/libs/${lib.id}/${item}`; const fim = '(?![A-Za-z0-9_-])';
      t = t.replace(new RegExp(`\\.claude/skills/${esc(lib.grupo)}/${esc(item)}${fim}`, 'g'), para);
      t = t.replace(new RegExp(`\\.claude/skills/${esc(item)}${fim}`, 'g'), para);
    }
  }
  return t;
}
