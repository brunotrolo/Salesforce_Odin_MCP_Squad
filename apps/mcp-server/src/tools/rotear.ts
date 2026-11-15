import type { Ferramenta } from '../contexto.ts';

export const odin_rotear: Ferramenta = async (a, c, s) => {
  const { roteador } = await s.catalogo();
  const r = roteador.rotear(String(a.pedido), new Set(c.direitos.skills.keys()), (a.artefatos as string[] | undefined) ?? [], a.skill_atual as string | undefined);
  return { estruturado: { request_id: c.requestId, ...r } };
};
