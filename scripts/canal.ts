#!/usr/bin/env node
// Uso: node scripts/canal.ts rollback <skill> [versao]  — volta o canal stable (RB de rollback, meta: menos de 10 minutos).
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { FirestoreStore } from '../packages/shared/src/nuvem/firestore.ts';
import { ArmazenamentoGcs } from '../packages/shared/src/nuvem/gcs.ts';
import { reverter } from '../apps/jobs/src/canais.ts';

const [acao, skill, versao] = process.argv.slice(2); const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
if (acao !== 'rollback' || !skill) { console.error('uso: canal.ts rollback <skill> [versao]'); process.exit(2); }
const d = { store: new FirestoreStore(env('PROJECT_ID')), armazenamento: new ArmazenamentoGcs(env('BUCKET_PACOTES')), chavesDePacote: [], coletor: coletorMemoria().coletor };
const alvo = await reverter(d, skill, versao); console.log(`stable de ${skill} voltou para ${alvo}`);
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Rollback\n\n${skill}: stable voltou para **${alvo}**\n`);
