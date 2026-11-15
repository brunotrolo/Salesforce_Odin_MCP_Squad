import { OdinErro } from '../../../../packages/shared/src/erros.ts';
import type { Ferramenta } from '../contexto.ts';

export const odin_conhecimento_propor: Ferramenta = async (a, c, s) => {
  const nivel = c.direitos.colecoes[String(a.colecao)];
  if (nivel !== 'propor' && nivel !== 'curar') throw new OdinErro('sem_acesso', 'Seu perfil não pode propor conhecimento nessa coleção.');
  if (a.projeto !== 'global' && !c.direitos.projetos.includes(String(a.projeto))) throw new OdinErro('sem_acesso', 'Você não participa desse projeto.');
  const proposta_id = await s.conhecimento.propor({ colecao: String(a.colecao), projeto: String(a.projeto), texto: String(a.texto), fonte: String(a.fonte), tipo: String(a.tipo), userId: c.direitos.userId });
  return { estruturado: { request_id: c.requestId, proposta_id, status: 'na_fila' } };
};
