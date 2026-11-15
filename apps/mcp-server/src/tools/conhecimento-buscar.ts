import { OdinErro } from '../../../../packages/shared/src/erros.ts';
import type { Ferramenta } from '../contexto.ts';

export const odin_conhecimento_buscar: Ferramenta = async (a, c, s) => {
  const pedidas = (a.colecoes as string[] | undefined) ?? Object.keys(c.direitos.colecoes);
  const colecoes = pedidas.filter((k) => c.direitos.colecoes[k]);
  if (a.projeto && !c.direitos.projetos.includes(String(a.projeto))) throw new OdinErro('sem_acesso', 'Você não participa desse projeto.');
  const trechos = colecoes.length ? await s.conhecimento.buscar(String(a.consulta), { colecoes, projetos: a.projeto ? [String(a.projeto)] : c.direitos.projetos, tipo: a.tipo as string | undefined, limite: Number(a.limite ?? 5) }) : [];
  return { estruturado: { request_id: c.requestId, trechos } };
};
