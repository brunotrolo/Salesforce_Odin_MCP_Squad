// `odin update`: atualiza o próprio CLI (pacote assinado com a chave cli-signing, conferido com a âncora fixada) e as skills instaladas.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonico, sha256hex, verificarAssinatura } from '../../shared/src/chaves.ts';
import { desempacotar } from '../../shared/src/pacote.ts';
import { caminhos, gravarAtomico, lerConfig, lerJsonArquivo, VERSAO_CLI } from './ambiente.ts';

const partes = (v: string) => v.split('-')[0]!.split('.').map(Number);
export const maisNovo = (a: string, b: string): boolean => { const x = partes(a), y = partes(b); for (let i = 0; i < 3; i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); } return false; };

export interface ResultadoCli { atualizou: boolean; versao: string; mensagem: string }
export async function atualizarCli(versaoAtual = process.env.ODIN_VERSAO_CLI ?? VERSAO_CLI): Promise<ResultadoCli> {
  const cfg = lerConfig(); const origem = new URL(cfg.mcp).origin;
  const r = await fetch(`${origem}/v1/cli`); if (!r.ok) return { atualizou: false, versao: versaoAtual, mensagem: `Não consegui consultar a versão mais nova do CLI (${r.status}).` };
  const { manifesto: m, assinatura, url } = (await r.json()) as { manifesto: Record<string, any>; assinatura: string; url: string };
  const chave = cfg.chavesDePacote.find((c) => c.kid === m.kid);
  if (!chave || !verificarAssinatura(chave.jwk, Buffer.from(canonico(m)), Buffer.from(assinatura, 'base64'))) throw new Error('A versão do CLI oferecida pelo servidor não tem assinatura válida. Nada foi instalado.');
  if (!maisNovo(String(m.versao), versaoAtual)) return { atualizou: false, versao: versaoAtual, mensagem: `O CLI já está na versão mais nova (${versaoAtual}).` };
  const dados = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (`${sha256hex(dados)}` !== m.pacote.sha256) throw new Error('O pacote do CLI não bate com o manifesto assinado. Nada foi instalado.');
  const arquivos = desempacotar(dados); const dir = join(caminhos().odin, 'cli', String(m.versao));
  for (const [rel, b] of Object.entries(arquivos)) { if (`sha256:${sha256hex(b)}` !== m.arquivos[`cli/${rel}`]) throw new Error(`Arquivo ${rel} não bate com o manifesto assinado. Nada foi instalado.`); }
  for (const [rel, b] of Object.entries(arquivos)) gravarAtomico(join(dir, rel), b, 0o644);
  gravarAtomico(join(caminhos().odin, 'cli', 'current.json'), JSON.stringify({ versao: m.versao, dir }));
  escreverLauncher(dir);
  return { atualizou: true, versao: String(m.versao), mensagem: `CLI atualizado de ${versaoAtual} para ${m.versao}.` };
}

/** Atalho `odin` em ~/.odin/bin que aponta para a versão instalada (sh no Linux e no Mac; cmd no Windows). */
export function escreverLauncher(dirVersao: string): void {
  const bin = join(caminhos().odin, 'bin'); mkdirSync(bin, { recursive: true }); const entrada = join(dirVersao, 'packages', 'cli', 'src', 'odin.ts');
  const sh = join(bin, 'odin'); writeFileSync(sh, `#!/bin/sh\nexec node "${entrada}" "$@"\n`, { mode: 0o755 }); try { chmodSync(sh, 0o755); } catch { /* Windows */ }
  writeFileSync(join(bin, 'odin.cmd'), `@echo off\r\nnode "${entrada}" %*\r\n`);
}
export function versaoInstalada(): string | null { return lerJsonArquivo<{ versao: string }>(join(caminhos().odin, 'cli', 'current.json'))?.versao ?? null; }
export const existeLauncher = (): boolean => existsSync(join(caminhos().odin, 'bin', process.platform === 'win32' ? 'odin.cmd' : 'odin'));
