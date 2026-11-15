import { OdinErro } from '../../../../packages/shared/src/erros.ts';
import { MAX_TOOL_RESPONSE_TOKENS } from '../../../../packages/shared/src/limites.ts';
import type { Ferramenta } from '../contexto.ts';
import { resolverRuntime, resolverVersao } from './carregar-skill.ts';

const PAGINA = Math.floor(MAX_TOOL_RESPONSE_TOKENS * 3.5 * 0.8); // caracteres por página, com folga para o envelope

export const odin_ler_referencia: Ferramenta = async (a, c, s) => {
  const id = String(a.skill); const caminho = String(a.caminho);
  const { versao } = await resolverVersao(id, c, s);
  const arquivos = await s.conteudo(id, versao);
  const alvo = caminho.startsWith('references/') ? caminho : `references/${caminho}`;
  const b = arquivos[alvo];
  if (!b) throw new OdinErro('invalido', `A referência ${caminho} não existe na skill ${id}.`);
  const texto = resolverRuntime(b.toString('utf8'), id, c);
  const total = Math.max(1, Math.ceil(texto.length / PAGINA)); const pagina = Math.min(total, Math.max(1, Number(a.pagina ?? 1)));
  const conteudo = texto.slice((pagina - 1) * PAGINA, pagina * PAGINA);
  return { estruturado: { request_id: c.requestId, conteudo, pagina, total }, texto: `${conteudo}${total > 1 ? `\n\n(página ${pagina} de ${total})` : ''}`, skill: id, versao };
};
