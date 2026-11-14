import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function repoTemp(arquivos = {}) {
  const d = mkdtempSync(join(tmpdir(), 'odin-'));
  const modelo = readFileSync(join(RAIZ, 'docs/adr/0000-modelo.md'), 'utf8');
  const base = { 'docs/adr/0000-modelo.md': modelo, ...arquivos };
  for (const [p, c] of Object.entries(base)) { mkdirSync(dirname(join(d, p)), { recursive: true }); writeFileSync(join(d, p), c); }
  return d;
}

export function hook(raiz, evento) {
  const r = spawnSync(process.execPath, [join(RAIZ, '.claude/hooks/guard-docs.mjs')], {
    input: typeof evento === 'string' ? evento : JSON.stringify(evento),
    env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
    encoding: 'utf8',
  });
  return { codigo: r.status, erro: r.stderr };
}

export const ADR = (n, status) => `# ${n}. Teste\n\n**Status:** ${status}\n**Data:** 2026-11-14\n`;
