#!/usr/bin/env node
// Indexa a fonte de conhecimento (pasta `conhecimento/`, formato odin-knowledge) no Firestore com embeddings da Vertex AI.
import { FirestoreStore } from '../packages/shared/src/nuvem/firestore.ts';
import { EmbedderVertex } from '../packages/shared/src/nuvem/vertex.ts';
import { indexar } from '../pipeline/conhecimento.ts';
import { RAIZ } from '../dev/ambiente.ts';
import { join } from 'node:path';

const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
const projeto = env('PROJECT_ID');
const r = await indexar({ dir: process.env.FONTE_CONHECIMENTO ?? join(RAIZ, 'conhecimento'), store: new FirestoreStore(projeto), denso: new EmbedderVertex(projeto, process.env.VERTEX_REGIAO ?? 'us-central1') });
const linha = `${r.documentos} documentos, ${r.trechos} trechos com embedding; ${r.mascarados} dado(s) pessoal(is) mascarado(s); ${r.substituidos} substituído(s); ${r.removidos} removido(s).`;
console.log(linha); if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Conhecimento\n\n${linha}\n`);
