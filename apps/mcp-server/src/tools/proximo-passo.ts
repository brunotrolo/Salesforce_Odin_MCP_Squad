import type { Ferramenta } from '../contexto.ts';

export const odin_proximo_passo: Ferramenta = async (a, c, s) => {
  const { roteador } = await s.catalogo();
  return { estruturado: { request_id: c.requestId, ...roteador.proximoPasso((a.artefatos as string[]) ?? [], new Set(c.direitos.skills.keys())) } };
};
