// Ponto de entrada dos jobs (uma imagem, três contas de serviço): publisher, tick (rotinas) e semente.
// Uso: node apps/jobs/src/main.ts <publisher <skill> <versao> | tick | semente>
import { auditar, coletorStdout, novoRequestId } from '../../../packages/shared/src/auditoria.ts';
import { FirestoreStore } from '../../../packages/shared/src/nuvem/firestore.ts';
import { AssinadorKms, versaoAtual } from '../../../packages/shared/src/nuvem/kms.ts';
import { ArmazenamentoGcs } from '../../../packages/shared/src/nuvem/gcs.ts';
import { exigir } from '../../../packages/shared/src/nuvem/servidor.ts';
import { semearNuvem } from '../../../packages/shared/src/nuvem/semente.ts';
import { registrarVersao } from './publisher.ts';
import { tick } from './rotinas.ts';

const [tarefa, ...args] = process.argv.slice(2);
const projeto = exigir('PROJECT_ID'); const store = new FirestoreStore(projeto);
if (tarefa === 'publisher') {
  const [skill, versao] = args; if (!skill || !versao) throw new Error('uso: publisher <skill> <versao>');
  const chave = await new AssinadorKms('bundle-2026-a', await versaoAtual(exigir('CHAVE_PACOTES'))).carregar();
  await registrarVersao({ store, armazenamento: new ArmazenamentoGcs(exigir('BUCKET_PACOTES')), chavesDePacote: [chave.publica()], coletor: coletorStdout }, skill, versao);
} else if (tarefa === 'tick') {
  const r = await tick(store); auditar(coletorStdout, 'odin-jobs', { ator: 'sa:jobs', acao: 'jobs.tick', resultado: 'ok', request_id: novoRequestId(), alvo: JSON.stringify(r).slice(0, 200) });
} else if (tarefa === 'semente') {
  const r = await semearNuvem(store, process.cwd(), { id: 'usr_mantenedor', githubId: Number(exigir('MANTENEDOR_GITHUB_ID')), githubLogin: exigir('MANTENEDOR_LOGIN'), nome: process.env.MANTENEDOR_NOME ?? 'Mantenedor' });
  process.stdout.write(`${JSON.stringify(r)}\n`);
} else throw new Error('tarefa desconhecida; use publisher, tick ou semente');
