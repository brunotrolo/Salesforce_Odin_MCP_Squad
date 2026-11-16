#!/usr/bin/env node
// Uso: node scripts/avaliar-skill.ts <pasta-do-repo-da-skill> <id-da-skill> <versao> [nota-stable-atual]
// Roda a camada determinística das avaliações (ADR 0017), confere a composição mínima e grava evals/resultado.json.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { avaliarDeterministico, conferirComposicao, lerCasos } from '../pipeline/avaliar.ts';

const [repoArg, skill, versao, anterior] = process.argv.slice(2);
if (!repoArg || !skill || !versao) { console.error('uso: avaliar-skill.ts <repo> <skill> <versao> [nota-stable-atual]'); process.exit(2); }
const repo = resolve(repoArg);
const erros = conferirComposicao(lerCasos(repo)); if (erros.length) { console.error(`Composição insuficiente:\n- ${erros.join('\n- ')}`); process.exit(1); }
const sha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const { ignorados, ...r } = await avaliarDeterministico({ repo, skill, sha, versao, notaStableAnterior: anterior ? Number(anterior) : null });
writeFileSync(join(repo, 'evals/resultado.json'), `${JSON.stringify(r, null, 2)}\n`);
console.log(`Nota determinística: ${r.nota} (${r.casos.filter((c) => c.resultado === 'passou').length}/${r.casos.length} casos). Casos de modelo (rodam em odin dev eval): ${ignorados.join(', ') || 'nenhum'}.`);
process.exit(r.casos.some((c) => c.critico && c.resultado !== 'passou') ? 1 : 0);
