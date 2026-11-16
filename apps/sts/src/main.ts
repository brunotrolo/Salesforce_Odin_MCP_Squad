// Ponto de entrada do odin-sts no Cloud Run: Firestore + chave de tokens no KMS + segredos do Secret Manager.
import { coletorStdout } from '../../../packages/shared/src/auditoria.ts';
import { FirestoreStore } from '../../../packages/shared/src/nuvem/firestore.ts';
import { AssinadorKms } from '../../../packages/shared/src/nuvem/kms.ts';
import { lerSegredo } from '../../../packages/shared/src/nuvem/segredos.ts';
import { escutar, exigir, passo } from '../../../packages/shared/src/nuvem/servidor.ts';
import { criarSts } from './sts.ts';

const projeto = exigir('PROJECT_ID'); const emissor = exigir('EMISSOR'); const mcp = exigir('URL_MCP');
// Versão fixa da chave (a conta só pode assinar e ver a chave pública, não listar versões). Rotação = mudar VERSAO_CHAVE_JWT.
const assinador = await passo('kms', () => new AssinadorKms('jwt-kms-a', `${exigir('CHAVE_JWT')}/cryptoKeyVersions/${process.env.VERSAO_CHAVE_JWT ?? '1'}`).carregar());
const sts = criarSts({
  store: new FirestoreStore(projeto), assinador, coletor: coletorStdout, emissor, audiencias: [mcp], portalUrl: emissor,
  pimenta: await passo('segredo pimenta', () => lerSegredo(projeto, 'odin-pimenta')), ativacaoSegredo: await passo('segredo ativação', () => lerSegredo(projeto, 'odin-ativacao-admin')),
  descoberta: { emissor, mcp: `${mcp}/mcp`, sts: emissor, portal: emissor, audiencias: [mcp], cli_min: '0.1.0', estagio: 'e0' },
});
escutar(sts.handler);
