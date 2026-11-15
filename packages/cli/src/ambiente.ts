// Caminhos e configuração do CLI. O Odin só escreve em ~/.odin, em pastas próprias de ~/.claude e em blocos marcados (plano, seção 22).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ChavePublica } from '../../shared/src/chaves.ts';

export const VERSAO_CLI = '0.1.0';
export interface Config { emissor: string; sts: string; mcp: string; portal: string; audiencias: string[]; chavesDePacote: ChavePublica[]; deviceId?: string }

export function caminhos() {
  const home = process.env.ODIN_TESTE_HOME ?? homedir();
  const odin = process.env.ODIN_HOME ?? join(home, '.odin');
  const claude = process.env.CLAUDE_CONFIG_DIR ?? join(home, '.claude');
  return { home, odin, claude, claudeJson: process.env.ODIN_CLAUDE_JSON ?? join(home, '.claude.json'), config: join(odin, 'config.json'), cache: join(odin, 'cache'), runtime: join(odin, 'runtime'), odinMd: join(odin, 'ODIN.md') };
}
export function gravarAtomico(arquivo: string, conteudo: string | Buffer, modo = 0o600): void {
  mkdirSync(dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.tmp`;
  writeFileSync(tmp, conteudo, { mode: modo }); renameSync(tmp, arquivo);
}
export const lerJsonArquivo = <T>(arquivo: string): T | null => { try { return JSON.parse(readFileSync(arquivo, 'utf8')) as T; } catch { return null; } };
export function lerConfig(): Config {
  const c = lerJsonArquivo<Config>(caminhos().config);
  if (!c) throw new Error('O Odin ainda não foi configurado nesta máquina. Rode: odin setup --servidor <endereço do portal>');
  return c;
}
export const gravarConfig = (c: Config): void => gravarAtomico(caminhos().config, JSON.stringify(c, null, 2));
/** Como o Claude Code deve chamar este CLI (hook e headersHelper). */
export const comandoOdin = (): string => process.env.ODIN_BIN ?? (existsSync(process.argv[1] ?? '') ? `"${process.execPath}" "${process.argv[1]}"` : 'odin');
