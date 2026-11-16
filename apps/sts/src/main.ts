// Ponto de entrada do odin-sts no Cloud Run: Firestore + chave de tokens no KMS + segredos do Secret Manager.
import { coletorStdout } from '../../../packages/shared/src/auditoria.ts';
import { FirestoreStore } from '../../../packages/shared/src/nuvem/firestore.ts';
import { AssinadorKms, versaoAtual } from '../../../packages/shared/src/nuvem/kms.ts';
import { lerSegredo } from '../../../packages/shared/src/nuvem/segredos.ts';
import { escutar, exigir } from '../../../packages/shared/src/nuvem/servidor.ts';
import { criarSts } from './sts.ts';

const projeto = exigir('PROJECT_ID'); const emissor = exigir('EMISSOR'); const mcp = exigir('URL_MCP');
const assinador = await new AssinadorKms('jwt-kms-a', await versaoAtual(exigir('CHAVE_JWT'))).carregar();
const sts = criarSts({
  store: new FirestoreStore(projeto), assinador, coletor: coletorStdout, emissor, audiencias: [mcp], portalUrl: emissor,
  pimenta: await lerSegredo(projeto, 'odin-pimenta'), ativacaoSegredo: await lerSegredo(projeto, 'odin-ativacao-admin'),
  descoberta: { emissor, mcp: `${mcp}/mcp`, sts: emissor, portal: emissor, audiencias: [mcp], cli_min: '0.1.0', estagio: 'e0' },
});
escutar(sts.handler);
