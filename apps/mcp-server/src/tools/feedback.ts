import type { Ferramenta } from '../contexto.ts';

export const odin_feedback: Ferramenta = async (a, c, s) => {
  await s.cfg.store.set('feedback', String(a.request_id), { userId: c.direitos.userId, nota: Number(a.nota), comentario: a.comentario ? String(a.comentario).slice(0, 500) : undefined, em: Date.now() });
  return { estruturado: { ok: true } };
};
