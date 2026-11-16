#!/usr/bin/env node
// Publica na nuvem (KMS + Cloud Storage + Firestore) as skills reais, SÓ as que mudaram, e promove a stable as que passam no portão de avaliação.
// Os repositórios das skills ficam clonados em ODIN_REPOS. Sem token do GitHub no Google Cloud; sem confirmação humana.
// Versão: 1.0.N (N = número de versões já publicadas + 1). Promoção: avaliações determinísticas do SHA, nota sem cair mais de 5 pontos, casos críticos verdes (ADR 0017).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { FirestoreStore } from '../packages/shared/src/nuvem/firestore.ts';
import { ArmazenamentoGcs } from '../packages/shared/src/nuvem/gcs.ts';
import { AssinadorKms, versaoAtual } from '../packages/shared/src/nuvem/kms.ts';
import { semearNuvem } from '../packages/shared/src/nuvem/semente.ts';
import { registrarVersao, promover } from '../apps/jobs/src/publisher.ts';
import { avaliarDeterministico, conferirComposicao, lerCasos, portaoDePromocao } from '../pipeline/avaliar.ts';
import { publicar } from '../pipeline/publicar.ts';
import { avaliar } from './prontidao-skills.ts';
import { RAIZ } from '../dev/ambiente.ts';

const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
const store = new FirestoreStore(env('PROJECT_ID')); const armazenamento = new ArmazenamentoGcs(env('BUCKET_PACOTES'));
const chave = await new AssinadorKms('bundle-2026-a', await versaoAtual(env('CHAVE_PACOTES'))).carregar();
await semearNuvem(store, RAIZ, { id: 'usr_mantenedor', githubId: 59326877, githubLogin: 'brunotrolo', nome: 'Mantenedor' });
const deps = { store, armazenamento, chavesDePacote: [chave.publica()], coletor: coletorMemoria().coletor };
const linhas: string[] = ['| Skill | Resultado | Detalhe |', '|---|---|---|']; let publicadas = 0, promovidas = 0, falhas = 0;
const sha = (repo: string) => execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

for (const x of avaliar(RAIZ, env('ODIN_REPOS'))) {
  const id = x.skill.id;
  if (!x.repo) { linhas.push(`| ${id} | não disponível | repositório não está neste ambiente |`); continue; }
  const rascunho = !existsSync(join(x.repo, 'odin.yaml'));
  const lintErros = rascunho ? (x.r?.erros ?? []) : [];
  if (lintErros.length) { linhas.push(`| ${id} | bloqueada no lint | ${lintErros.slice(0, 2).join('; ').slice(0, 160)} |`); falhas++; continue; }
  try {
    const hoje = sha(x.repo); const versoes = (await store.list('catalog_versions', (v) => v.skill === id)).sort((a, b) => Number(a.publicadoEm) - Number(b.publicadoEm)); const ultima = versoes[versoes.length - 1];
    let versao = String(ultima?.versao ?? '');
    if ((ultima?.manifesto as { fonte?: { sha?: string } } | undefined)?.fonte?.sha === hoje) { linhas.push(`| ${id} | sem mudança | ${versao} já publicada para ${hoje.slice(0, 7)} |`); }
    else {
      versao = `1.0.${versoes.length + 1}`;
      await publicar({ repo: x.repo, versao, canal: 'beta', fonte: { repo: `brunotrolo/${x.skill.repo}`, sha: hoje }, assinador: chave, armazenamento, bucket: env('BUCKET_PACOTES'), ...(rascunho ? { odinYaml: x.yaml, rascunho: true } : {}), pipeline: { run: process.env.URL_EXECUCAO ?? 'https://github.com/brunotrolo/Salesforce_Odin_MCP_Squad/actions', sha: process.env.GITHUB_SHA ?? hoje } });
      await registrarVersao(deps, id, versao); publicadas++; linhas.push(`| ${id} | publicada ${versao} (beta) | assinada no KMS, hashes conferidos (${hoje.slice(0, 7)}) |`);
    }
    // Portão de promoção para stable (só com avaliações no repositório da skill).
    const atual = await store.get('catalog_skills', id); const stableAtual = String((atual?.canais as Record<string, string> | undefined)?.stable ?? '');
    if (stableAtual === versao) continue;
    if (!existsSync(join(x.repo, 'evals/casos.yaml'))) { linhas.push(`| ${id} | permanece em beta | sem evals/ no repositório |`); continue; }
    const comp = conferirComposicao(lerCasos(x.repo)); if (comp.length) { linhas.push(`| ${id} | permanece em beta | evals insuficientes: ${comp[0]} |`); continue; }
    const notaAnterior = stableAtual ? Number(((await store.get('catalog_versions', `${id}@${stableAtual}`))?.avaliacao as { nota?: number } | undefined)?.nota ?? 0) : null;
    const r = await avaliarDeterministico({ repo: x.repo, skill: id, sha: hoje, versao, notaStableAnterior: notaAnterior });
    const p = portaoDePromocao(r, hoje, notaAnterior);
    if (!p.ok) { linhas.push(`| ${id} | permanece em beta | portão: ${p.motivos.join('; ').slice(0, 160)} |`); falhas++; continue; }
    await store.update('catalog_versions', `${id}@${versao}`, (v) => (v ? { ...v, avaliacao: { nota: r.nota, casos: r.casos.length, sha: hoje, em: Date.now() } } : v));
    await promover(deps, id, versao); promovidas++; linhas.push(`| ${id} | **promovida a stable** ${versao} | nota ${r.nota}, ${r.casos.length} casos determinísticos verdes, SHA ${hoje.slice(0, 7)} |`);
  } catch (e) { linhas.push(`| ${id} | falhou | ${(e as Error).message.split('\n')[0]!.slice(0, 160)} |`); falhas++; }
}
console.log(linhas.join('\n')); console.log(`\n${publicadas} publicada(s), ${promovidas} promovida(s) a stable, ${falhas} falha(s)`);
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Skills publicadas\n\n${linhas.join('\n')}\n`);
process.exit(falhas ? 1 : 0);
