#!/usr/bin/env node
// Valida skills (.claude/skills/*/SKILL.md) e agentes (.claude/agents/*.md) segundo as boas práticas:
//  - frontmatter com name (minúsculas, números e hífens, ≤ 64, igual à pasta) e description (≤ 1024)
//  - corpo do SKILL.md com no máximo 500 linhas
//  - arquivos citados em `references/`, `scripts/`, `templates/` existem
//  - agentes têm name, description e tools; revisores e auditor são somente leitura
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function frontmatter(t) {
  const m = t.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const l of m[1].split('\n')) { const k = l.match(/^([A-Za-z-]+):\s*(.*)$/); if (k) fm[k[1]] = k[2].trim(); }
  return { fm, corpo: t.slice(m[0].length) };
}

export function verificar(raiz) {
  const erros = [];
  const sk = join(raiz, '.claude/skills');
  const skills = existsSync(sk) ? readdirSync(sk).filter((d) => statSync(join(sk, d)).isDirectory()) : [];
  for (const d of skills) {
    const p = join(sk, d, 'SKILL.md');
    if (!existsSync(p)) { erros.push(`skill ${d}: falta SKILL.md`); continue; }
    const r = frontmatter(readFileSync(p, 'utf8'));
    if (!r) { erros.push(`skill ${d}: sem frontmatter`); continue; }
    const { fm, corpo } = r;
    if (!/^[a-z0-9-]{1,64}$/.test(fm.name || '')) erros.push(`skill ${d}: name inválido`);
    if (fm.name !== d) erros.push(`skill ${d}: name "${fm.name}" diferente da pasta`);
    if (!fm.description || fm.description.length > 1024) erros.push(`skill ${d}: description ausente ou acima de 1024 caracteres`);
    if (corpo.split('\n').length > 500) erros.push(`skill ${d}: SKILL.md acima de 500 linhas`);
    for (const m of corpo.matchAll(/`((?:references|scripts|templates)\/[^`*<>\s]+)`/g)) {
      if (!existsSync(join(sk, d, m[1])) && !existsSync(join(raiz, m[1]))) erros.push(`skill ${d}: arquivo citado não existe: ${m[1]}`);
    }
  }
  const ag = join(raiz, '.claude/agents');
  const agentes = existsSync(ag) ? readdirSync(ag).filter((f) => f.endsWith('.md')) : [];
  for (const f of agentes) {
    const r = frontmatter(readFileSync(join(ag, f), 'utf8'));
    if (!r) { erros.push(`agente ${f}: sem frontmatter`); continue; }
    const { fm } = r;
    if (fm.name !== f.replace(/\.md$/, '')) erros.push(`agente ${f}: name diferente do arquivo`);
    if (!fm.description) erros.push(`agente ${f}: sem description`);
    if (!fm.tools) erros.push(`agente ${f}: sem tools (defina explicitamente)`);
    if (/revisor|auditor/.test(f) && /\b(Edit|Write|MultiEdit|Bash|NotebookEdit)\b/.test(fm.tools || '')) erros.push(`agente ${f}: revisor/auditor precisa ser somente leitura`);
  }
  return { erros, skills: skills.length, agentes: agentes.length };
}

function main() {
  const r = verificar(process.cwd());
  if (r.erros.length) { r.erros.forEach((e) => console.log(`ERRO: ${e}`)); process.exit(1); }
  console.log(`✓ ${r.skills} skill(s) e ${r.agentes} agente(s) válidos`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
