// Dados iniciais do ambiente de nuvem (idempotente): perfis e catálogo a partir de catalog/, e o mantenedor.
// Sem conhecimento de cliente e sem pessoas fictícias: só o que o Odin precisa para a primeira ativação.
import { lerCatalogo } from '../../../router/src/catalogo.ts';
import type { Store } from '../store.ts';

export async function semearNuvem(store: Store, raiz: string, mantenedor: { id: string; githubId: number; githubLogin: string; nome: string }): Promise<{ skills: number; perfis: number }> {
  const { skills, perfis } = lerCatalogo(raiz);
  for (const [nome, p] of Object.entries(perfis)) await store.set('profiles', nome, { ...p, skills: [...new Set([...p.skills, 'odin-ambiente'])] });
  for (const s of skills) await store.update('catalog_skills', s.id, (atual) => ({ ...s, ...(atual?.canais ? { canais: atual.canais } : { canais: {} }) }));
  await store.set('squads', 'squad-mantenedores', { nome: 'Mantenedores', projetos: [] });
  await store.update('users', mantenedor.id, (u) => ({ githubId: mantenedor.githubId, githubLogin: mantenedor.githubLogin, nome: mantenedor.nome, status: 'ativo', policyVersion: Number(u?.policyVersion ?? 1) }));
  await store.set('memberships', `${mantenedor.id}_squad-mantenedores`, { userId: mantenedor.id, squadId: 'squad-mantenedores', perfis: ['mantenedor'], origem: 'portal' });
  return { skills: skills.length, perfis: Object.keys(perfis).length };
}
