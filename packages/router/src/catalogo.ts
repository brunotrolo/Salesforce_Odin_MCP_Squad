// Leitura do catálogo (catalog/skills.yaml e catalog/perfis.yaml) para o formato que o roteador e a semente usam.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import type { SkillRoteavel } from './router.ts';

export interface SkillDoCatalogo extends SkillRoteavel { repo: string; estado: string; perfis: string[]; sha?: string }
export interface Perfil { skills: string[]; colecoes: Record<string, 'ler' | 'propor' | 'curar'>; canais: string[] }

export function lerCatalogo(raiz: string): { skills: SkillDoCatalogo[]; perfis: Record<string, Perfil> } {
  const bruto = YAML.parse(readFileSync(join(raiz, 'catalog/skills.yaml'), 'utf8')).skills as Array<Record<string, unknown>>;
  const skills = bruto.map((s) => ({ ...s, proximo: s.proximo ?? [], intencoes: (s.intencoes as Array<string | { texto: string; negativa?: boolean }>).map((i) => (typeof i === 'string' ? { texto: i } : i)) })) as SkillDoCatalogo[];
  const perfis = YAML.parse(readFileSync(join(raiz, 'catalog/perfis.yaml'), 'utf8')).perfis as Record<string, Perfil>;
  for (const p of Object.values(perfis)) if (p.skills.includes('*')) p.skills = skills.map((s) => s.id);
  return { skills, perfis };
}

export function lerCasosDeRoteamento(raiz: string): Array<{ pedido: string; esperado: string }> {
  return YAML.parse(readFileSync(join(raiz, 'catalog/avaliacao-roteamento.yaml'), 'utf8')).casos;
}
