#!/usr/bin/env node
// Publica na nuvem (KMS + Cloud Storage + Firestore) as skills reais que passam no odin lint, em modo rascunho (canal beta).
// Os repositórios das skills ficam clonados em ODIN_REPOS. Roda no workflow publicar-skills.yml; não usa token do GitHub no Google Cloud.
import { execFileSync } from 'node:child_process';
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { FirestoreStore } from '../packages/shared/src/nuvem/firestore.ts';
import { ArmazenamentoGcs } from '../packages/shared/src/nuvem/gcs.ts';
import { AssinadorKms, versaoAtual } from '../packages/shared/src/nuvem/kms.ts';
import { semearNuvem } from '../packages/shared/src/nuvem/semente.ts';
import { registrarVersao, promover } from '../apps/jobs/src/publisher.ts';
import { publicar } from '../pipeline/publicar.ts';
import { avaliar } from './prontidao-skills.ts';
import { RAIZ } from '../dev/ambiente.ts';

const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
const VERSAO = process.env.VERSAO_SKILLS ?? '0.1.0-rascunho';
const store = new FirestoreStore(env('PROJECT_ID')); const armazenamento = new ArmazenamentoGcs(env('BUCKET_PACOTES'));
const chave = await new AssinadorKms('bundle-2026-a', await versaoAtual(env('CHAVE_PACOTES'))).carregar();
await semearNuvem(store, RAIZ, { id: 'usr_mantenedor', githubId: 59326877, githubLogin: 'brunotrolo', nome: 'Mantenedor' });
const deps = { store, armazenamento, chavesDePacote: [chave.publica()], coletor: coletorMemoria().coletor };
const linhas: string[] = ['| Skill | Resultado | Detalhe |', '|---|---|---|']; let publicadas = 0;
for (const x of avaliar(RAIZ, env('ODIN_REPOS'))) {
  const id = x.skill.id;
  if (!x.repo) { linhas.push(`| ${id} | não publicada | repositório não disponível neste ambiente |`); continue; }
  if (!x.r || x.r.erros.length) { linhas.push(`| ${id} | bloqueada no lint | ${(x.r?.erros ?? []).slice(0, 2).join('; ').slice(0, 160)} |`); continue; }
  try {
    const sha = execFileSync('git', ['-C', x.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    await publicar({ repo: x.repo, versao: VERSAO, canal: 'beta', fonte: { repo: `brunotrolo/${x.skill.repo}`, sha }, assinador: chave, armazenamento, bucket: env('BUCKET_PACOTES'), odinYaml: x.yaml, rascunho: true, pipeline: { run: process.env.URL_EXECUCAO ?? 'https://github.com/brunotrolo/Salesforce_Odin_MCP_Squad/actions', sha: process.env.GITHUB_SHA ?? sha } });
    await registrarVersao(deps, id, VERSAO); await promover(deps, id, VERSAO); publicadas++;
    linhas.push(`| ${id} | publicada ${VERSAO} | assinada no KMS, hashes conferidos, canal beta (${sha.slice(0, 7)}) |`);
  } catch (e) { linhas.push(`| ${id} | falhou | ${(e as Error).message.split('\n')[0]!.slice(0, 160)} |`); }
}
console.log(linhas.join('\n')); console.log(`\n${publicadas} skill(s) publicada(s) na nuvem`);
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Skills publicadas\n\n${linhas.join('\n')}\n`);
if (publicadas === 0) process.exit(1);
