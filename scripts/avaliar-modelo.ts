#!/usr/bin/env node
// Uso: ANTHROPIC_API_KEY=… node scripts/avaliar-modelo.ts <pasta-do-repo-da-skill> <id-da-skill> <versao> [sha]
// Roda a camada com modelo das avaliações. Sem chave, não roda e sai 0 (a camada determinística continua valendo).
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { avaliarComModelo } from '../pipeline/avaliar-modelo.ts';

const [repoArg, skill, versao, shaArg] = process.argv.slice(2);
if (!repoArg || !skill || !versao) { console.error('uso: avaliar-modelo.ts <repo> <skill> <versao> [sha]'); process.exit(2); }
const chave = process.env.ANTHROPIC_API_KEY; if (!chave) { console.log(`${skill}: sem ANTHROPIC_API_KEY, camada com modelo não executada`); process.exit(0); }
const repo = resolve(repoArg); const sha = shaArg ?? execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const r = await avaliarComModelo(repo, skill, versao, sha, { chave, ...(process.env.ODIN_EVAL_MODELO ? { modelo: process.env.ODIN_EVAL_MODELO } : {}) });
writeFileSync(join(repo, 'evals/resultado-modelo.json'), `${JSON.stringify(r, null, 2)}\n`);
const linha = `${skill}: nota com modelo ${r.nota} (${r.casos.filter((c) => c.resultado === 'passou').length}/${r.casos.length} casos; instáveis: ${r.casos.filter((c) => c.resultado === 'instavel').map((c) => c.id).join(', ') || 'nenhum'}; críticos falhando: ${r.casos.filter((c) => c.critico && c.resultado !== 'passou').map((c) => c.id).join(', ') || 'nenhum'})`;
console.log(linha); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${linha}\n`);
