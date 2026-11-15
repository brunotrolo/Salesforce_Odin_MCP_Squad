import { OdinErro } from '../../../../packages/shared/src/erros.ts';
import type { Chamada, Ferramenta, Servicos, SkillPublicada } from '../contexto.ts';

/** Resolve a skill e a versão que a pessoa recebe (canal do perfil; versão proibida nunca é entregue). */
export async function resolverVersao(id: string, c: Chamada, s: Servicos): Promise<{ skill: SkillPublicada; versao: string; manifesto: Record<string, unknown> }> {
  const canal = c.direitos.skills.get(id);
  const skill = (await s.catalogo()).skills.find((x) => x.id === id);
  if (!canal || !skill) throw new OdinErro(skill ? 'sem_acesso' : 'skill_inexistente', skill ? `Você não tem acesso à skill ${id}. Peça no portal.` : `A skill ${id} não existe no catálogo.`);
  const versao = (canal === 'beta' && skill.canais.beta) || skill.canais.stable;
  if (!versao) throw new OdinErro('versao_indisponivel', `A skill ${id} ainda não tem versão publicada no seu canal.`);
  const v = await s.cfg.store.get('catalog_versions', `${id}@${versao}`);
  if (!v || v.proibida) throw new OdinErro('versao_indisponivel', `A versão ${versao} da skill ${id} foi retirada de circulação.`);
  return { skill, versao, manifesto: v.manifesto as Record<string, unknown> };
}

export const resolverRuntime = (texto: string, id: string, c: Chamada): string => texto.replaceAll('{{ODIN_RUNTIME}}', `${c.runtime ?? '~/.odin/runtime'}/${id}/current`);

export const odin_carregar_skill: Ferramenta = async (a, c, s) => {
  const id = String(a.skill);
  const { skill, versao, manifesto } = await resolverVersao(id, c, s);
  const arquivos = await s.conteudo(id, versao);
  const sub = a.subskill ? `skills/${String(a.subskill)}/SKILL.md` : 'SKILL.md';
  const md = arquivos[sub];
  if (!md) throw new OdinErro('skill_inexistente', `A skill ${id} não tem a subskill ${String(a.subskill)}.`);
  const regras = Object.keys(arquivos).filter((k) => k.startsWith('regras/')).sort().map((k) => arquivos[k]!.toString('utf8')).join('\n\n');
  const conteudo = resolverRuntime(md.toString('utf8'), id, c);
  const m = (manifesto.entrega ?? {}) as Record<string, unknown>;
  const estruturado = {
    request_id: c.requestId, conteudo, ...(regras ? { regras: resolverRuntime(regras, id, c) } : {}),
    manifesto: { versao, runtime_min: String(manifesto.runtime_min_cli ?? '0.0.0'), prerequisitos: (m.prerequisitos as string[]) ?? [], agentes: (m.agentes as string[]) ?? [], proximos: skill.proximo, colecoes: (m.colecoes as string[]) ?? [], referencias: Object.keys(arquivos).filter((k) => k.startsWith('references/')).sort() },
  };
  const texto = `Skill ${skill.nome} ${versao}. PRIMEIRO PASSO OBRIGATÓRIO: rode \`odin ensure ${id}\` no terminal e só continue se ele responder ok.\n\n${conteudo}${regras ? `\n\n## Regras\n${estruturado.regras}` : ''}`;
  return { estruturado, texto, skill: id, versao };
};
