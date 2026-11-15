#!/usr/bin/env node
// odin-guard: hook PreToolUse único do Odin. Fail-closed: qualquer erro interno nega (código de saída 2).
// Também registra a "prova de vida": ao ver `odin ensure <skill>` passar, grava um marcador que o ensure confere.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { avaliar, segmentos, type Ambiente, type Evento } from './politicas.ts';

export function ambienteAtual(cwd: string): Ambiente {
  const home = process.env.ODIN_TESTE_HOME ?? homedir();
  const odinHome = process.env.ODIN_HOME ?? join(home, '.odin');
  let orgs: Record<string, string> = {};
  try { orgs = JSON.parse(readFileSync(join(odinHome, 'cache', 'orgs.json'), 'utf8')); } catch { /* sem cache: toda org é desconhecida e a PG-05 nega */ }
  return { home, odinHome, claudeHome: process.env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'), cwd, orgs, windows: process.platform === 'win32' };
}

export function executarGuard(entrada: string): { codigo: number; mensagem?: string } {
  try {
    const e = JSON.parse(entrada) as Evento;
    if (!e || typeof e.tool_name !== 'string') throw new Error('evento inválido');
    const a = ambienteAtual(e.cwd ?? process.cwd());
    const d = avaliar(e, a);
    const cache = join(a.odinHome, 'cache'); mkdirSync(cache, { recursive: true });
    const cmd = String(e.tool_input?.command ?? '');
    if (d.decisao !== 'negar' && segmentos(cmd).some((s) => /^(\S*[\\/])?odin(\.exe|\.cmd)?\s+ensure\s+[a-z0-9-]+/.test(s))) writeFileSync(join(cache, 'guard-visto.json'), JSON.stringify({ ts: Date.now(), sessao: e.session_id ?? null }));
    if (d.decisao !== 'permitir') appendFileSync(join(cache, 'guard.log'), `${JSON.stringify({ ts: new Date().toISOString(), decisao: d.decisao, politica: d.politica, ferramenta: e.tool_name })}\n`);
    return d.decisao === 'negar' ? { codigo: 2, mensagem: d.motivo } : { codigo: 0 };
  } catch {
    return { codigo: 2, mensagem: 'O odin-guard falhou ao avaliar esta ação e, por segurança, bloqueou. Rode `odin doctor`.' };
  }
}

if (process.argv[1] && /guard\.(ts|mjs|js)$/.test(process.argv[1]) && existsSync(process.argv[1])) {
  let entrada = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { entrada += c; });
  process.stdin.on('end', () => { const r = executarGuard(entrada); if (r.mensagem) process.stderr.write(`${r.mensagem}\n`); process.exit(r.codigo); });
}
