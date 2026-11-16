// Empacotamento e assinatura do próprio CLI (F5): só código TypeScript do repositório, sem dependências de terceiros,
// assinado com a chave `cli-signing` e publicado no Cloud Storage; o servidor MCP entrega pelo endereço público /v1/cli.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Armazenamento } from '../packages/shared/src/armazenamento.ts';
import { canonico, sha256hex, type Assinador, type ChavePublica } from '../packages/shared/src/chaves.ts';
import { empacotar, hashesDosArquivos, type Arquivos } from '../packages/shared/src/pacote.ts';
import type { Store } from '../packages/shared/src/store.ts';

const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
/** Fecho de imports relativos a partir do ponto de entrada do CLI; recusa qualquer dependência que não seja do Node. */
export function arquivosDoCli(raiz: string, entrada = 'packages/cli/src/odin.ts'): string[] {
  const vistos = new Set<string>(); const fila = [entrada];
  while (fila.length) {
    const rel = fila.pop()!; if (vistos.has(rel)) continue; vistos.add(rel);
    const texto = readFileSync(join(raiz, rel), 'utf8');
    for (const m of texto.matchAll(IMPORT)) {
      const alvo = m[1] ?? m[2]!; if (alvo.startsWith('node:')) continue;
      if (!alvo.startsWith('.')) throw new Error(`${rel} importa "${alvo}": o CLI não pode depender de pacote de terceiros`);
      const f = relative(raiz, resolve(join(raiz, dirname(rel)), alvo)).replaceAll('\\', '/'); if (existsSync(join(raiz, f))) fila.push(f); // `new URL('../x.json', import.meta.url)` não casa: tratado à parte
    }
  }
  return [...vistos].sort();
}
export interface PublicacaoCli { versao: string; manifesto: Record<string, unknown>; assinatura: string }
export async function publicarCli(o: { raiz: string; versao: string; assinador: Assinador; armazenamento: Armazenamento; store: Store; chaves: ChavePublica[]; bucket?: string; agora?: Date }): Promise<PublicacaoCli> {
  const conteudo: Arquivos = {}; for (const f of arquivosDoCli(o.raiz)) conteudo[f] = readFileSync(join(o.raiz, f));
  conteudo['packages/cli/chaves-de-pacote.json'] = Buffer.from(JSON.stringify(o.chaves, null, 2)); // âncoras de confiança fixadas no CLI
  const pacote = empacotar(conteudo); const base = `cli/${o.versao}`; const bucket = o.bucket ?? 'odin-bundles-local';
  const manifesto = { schema: 'odin.cli/1', versao: o.versao, pacote: { uri: `gs://${bucket}/${base}/cli.odinpkg`, sha256: sha256hex(pacote) }, arquivos: hashesDosArquivos(conteudo, 'cli'), emitido_em: (o.agora ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'), kid: o.assinador.kid };
  const assinatura = Buffer.from(await o.assinador.assinar(Buffer.from(canonico(manifesto)))).toString('base64');
  await o.armazenamento.gravar(`${base}/cli.odinpkg`, pacote); await o.armazenamento.gravar(`${base}/manifesto.json`, Buffer.from(JSON.stringify(manifesto, null, 2))); await o.armazenamento.gravar(`${base}/manifesto.sig`, Buffer.from(assinatura));
  await o.store.set('catalog_versions', 'odin-cli@current', { versao: o.versao, manifesto, assinatura, publicadoEm: Date.now() });
  return { versao: o.versao, manifesto, assinatura };
}
