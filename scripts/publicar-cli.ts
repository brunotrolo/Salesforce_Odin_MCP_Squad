#!/usr/bin/env node
// Empacota, assina (KMS, chave cli-signing) e publica o CLI. Só publica se o conteúdo mudou. Roda no workflow publicar-skills.yml.
import { FirestoreStore } from '../packages/shared/src/nuvem/firestore.ts';
import { ArmazenamentoGcs } from '../packages/shared/src/nuvem/gcs.ts';
import { AssinadorKms, versaoAtual } from '../packages/shared/src/nuvem/kms.ts';
import { VERSAO_CLI } from '../packages/cli/src/ambiente.ts';
import { publicarCli } from '../pipeline/cli.ts';
import { RAIZ } from '../dev/ambiente.ts';

const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
const store = new FirestoreStore(env('PROJECT_ID')); const armazenamento = new ArmazenamentoGcs(env('BUCKET_PACOTES'));
const cli = await new AssinadorKms('cli-2026-a', await versaoAtual(env('CHAVE_CLI'))).carregar(); const pacotes = await new AssinadorKms('bundle-2026-a', await versaoAtual(env('CHAVE_PACOTES'))).carregar();
const r = await publicarCli({ raiz: RAIZ, versao: VERSAO_CLI, assinador: cli, armazenamento, store, chaves: [pacotes.publica(), cli.publica()], bucket: env('BUCKET_PACOTES') });
console.log(`CLI ${r.versao} publicado e assinado (${(r.manifesto.pacote as { sha256: string }).sha256.slice(0, 12)})`);
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## CLI\n\nVersão **${r.versao}** assinada pela chave cli-signing.\n`);
