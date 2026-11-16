#!/usr/bin/env node
// F6: leva o contrato para dentro de cada repositório de skill (odin.yaml na raiz) e coloca o primeiro passo `odin ensure <id>` no SKILL.md principal.
// Uso: node scripts/migrar-skill.mjs <pasta-dos-repos>. Idempotente.
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..'); const BASE = resolve(process.argv[2] ?? join(RAIZ, '..'));
const repos = readdirSync(BASE); const catalogo = YAML.parse(readFileSync(join(RAIZ, 'catalog/skills.yaml'), 'utf8')).skills;
for (const s of catalogo) {
  const pasta = repos.find((d) => d.toLowerCase() === String(s.repo).toLowerCase()); if (!pasta) { console.log(`- ${s.id}: repositório não encontrado`); continue; }
  const repo = join(BASE, pasta); const origem = join(RAIZ, 'catalog/migracao', s.id, 'odin.yaml'); if (!existsSync(origem)) { console.log(`- ${s.id}: sem rascunho de odin.yaml`); continue; }
  const corpo = readFileSync(origem, 'utf8').split('\n').filter((l) => !l.startsWith('# Rascunho gerado') && !l.startsWith('# Na migração')).join('\n');
  writeFileSync(join(repo, 'odin.yaml'), `# Contrato da skill no Odin (schemas/odin.schema.json). Mantido neste repositório; o catálogo só lê.\n${corpo}`);
  const principal = join(repo, YAML.parse(corpo).skills[0].path); const md = readFileSync(principal, 'utf8');
  if (!md.includes(`odin ensure ${s.id}`)) { const fim = md.startsWith('---') ? md.indexOf('\n---', 3) + 4 : 0; writeFileSync(principal, `${md.slice(0, fim)}\n\n> **Primeiro passo (Odin):** rode \`odin ensure ${s.id}\` e só continue se a resposta tiver \`"ok": true\`.\n${md.slice(fim)}`); }
  console.log(`✓ ${s.id}: odin.yaml na raiz e passo ensure no SKILL.md principal`);
}
