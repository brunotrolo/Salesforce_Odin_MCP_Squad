// Rollback do canal stable (plano 8.4): aponta o stable para a versão anterior (ou para uma versão escolhida) já registrada e não proibida.
import { auditar, novoRequestId } from '../../../packages/shared/src/auditoria.ts';
import { PublicacaoRecusada, promover, type DepsPublisher } from './publisher.ts';

export async function reverter(d: DepsPublisher, skill: string, versao?: string): Promise<string> {
  const s = await d.store.get('catalog_skills', skill); const atual = String((s?.canais as Record<string, string> | undefined)?.stable ?? '');
  if (!atual) throw new PublicacaoRecusada('a skill não tem versão em stable');
  const versoes = (await d.store.list('catalog_versions', (v) => v.skill === skill && !v.proibida)).sort((a, b) => Number(a.publicadoEm) - Number(b.publicadoEm));
  let alvo = versao;
  if (!alvo) { const i = versoes.findIndex((v) => v.versao === atual); alvo = String(versoes[i - 1]?.versao ?? ''); }
  if (!alvo || alvo === atual) throw new PublicacaoRecusada('não há versão anterior para voltar');
  if (!versoes.some((v) => v.versao === alvo)) throw new PublicacaoRecusada(`a versão ${alvo} não está registrada ou foi retirada`);
  await promover(d, skill, alvo);
  auditar(d.coletor, 'odin-publisher', { ator: 'sa:publisher', acao: 'catalogo.rollback', resultado: 'ok', request_id: novoRequestId(), skill, versao: alvo, alvo: `stable ${atual} -> ${alvo}` });
  return alvo;
}
