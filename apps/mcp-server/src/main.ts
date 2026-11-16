// Ponto de entrada do odin-mcp no Cloud Run: Firestore, Cloud Storage e chaves públicas do emissor (JWKS, cache de 10 min).
import { coletorStdout } from '../../../packages/shared/src/auditoria.ts';
import type { ChavePublica } from '../../../packages/shared/src/chaves.ts';
import { JWKS_CACHE_SECONDS } from '../../../packages/shared/src/limites.ts';
import { FirestoreStore } from '../../../packages/shared/src/nuvem/firestore.ts';
import { ArmazenamentoGcs } from '../../../packages/shared/src/nuvem/gcs.ts';
import { lerSegredo } from '../../../packages/shared/src/nuvem/segredos.ts';
import { escutar, exigir, passo } from '../../../packages/shared/src/nuvem/servidor.ts';
import { criarMcp } from './servidor.ts';

const projeto = exigir('PROJECT_ID'); const emissor = exigir('EMISSOR'); const urlPublica = exigir('URL_MCP');
let jwks: { ate: number; chaves: ChavePublica[] } | null = null;
const chavesDoEmissor = async (): Promise<ChavePublica[]> => {
  if (jwks && jwks.ate > Date.now()) return jwks.chaves;
  const r = await fetch(`${emissor}/.well-known/jwks.json`); if (!r.ok) throw new Error(`JWKS indisponível (${r.status})`);
  const { keys } = (await r.json()) as { keys: Array<{ kid: string; kty: string; crv: string; x: string; y: string }> };
  jwks = { ate: Date.now() + JWKS_CACHE_SECONDS * 1000, chaves: keys.map((k) => ({ kid: k.kid, jwk: { kty: k.kty, crv: k.crv, x: k.x, y: k.y } })) };
  return jwks.chaves;
};
const mcp = criarMcp({ store: new FirestoreStore(projeto), armazenamento: new ArmazenamentoGcs(exigir('BUCKET_PACOTES')), coletor: coletorStdout, chavesDoEmissor, emissor, audiencias: [urlPublica], urlPublica, segredoUrl: await passo('segredo url', () => lerSegredo(projeto, 'odin-segredo-url')), versaoServidor: process.env.K_REVISION ?? '0.1.0' });
await passo('firestore (gravar mcp_tools)', () => mcp.registrarFerramentas());
escutar(mcp.handler);
