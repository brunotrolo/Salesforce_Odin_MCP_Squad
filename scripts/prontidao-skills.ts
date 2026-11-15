#!/usr/bin/env node
// Prontidão de migração das skills reais (F6): gera o rascunho do odin.yaml de cada uma a partir do catálogo e da
// estrutura do repositório, roda o `odin lint` e escreve docs/MIGRACAO-SKILLS.md. Não altera os repositórios das skills.
// Uso: node scripts/prontidao-skills.ts [--repos <pasta com os repositórios clonados>]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { lint, listar, type ResultadoLint } from '../packages/lint/src/lint.ts';
import { lerCatalogo, type SkillDoCatalogo } from '../packages/router/src/catalogo.ts';
import { estimarTokens } from '../packages/shared/src/http.ts';

/** Skill principal e subskills próprias de cada repositório (bibliotecas de terceiros ficam para o pacote compartilhado). */
export const ESTRUTURA: Record<string, { principal: string; extras: string[] }> = {
  'sf-archaeologist': { principal: 'sf-archaeologist', extras: [] },
  'sf-discovery': { principal: 'sf-discover', extras: ['sf-backlog-publish', 'sf-discovery-status', 'sf-po-pack'] },
  'sf-data-architect': { principal: 'sf-data-architect', extras: [] },
  'sf-journey-designer': { principal: 'sf-spec', extras: ['sf-status'] },
  'sf-journey-developer': { principal: 'sf-build', extras: ['sf-gate'] },
  'sf-lwc-developer': { principal: 'lwc-pattern-generator', extras: ['lwc-pattern-documenter', 'lwc-spec-writer'] },
  'sf-callouts-developer': { principal: 'apex-callouts-developer', extras: [] },
  'sf-apex-cover-loop': { principal: 'apex-test-loop', extras: [] },
  'sf-test': { principal: 'sf-test', extras: ['sf-test-status'] },
  'sf-deep-debugger': { principal: 'sf-deep-debugger', extras: [] },
};

export function acharRepo(base: string, nome: string): string | null {
  const alvo = nome.toLowerCase();
  const achado = existsSync(base) ? readdirSync(base).find((d) => d.toLowerCase() === alvo) : undefined;
  return achado ? join(base, achado) : null;
}

export function rascunho(s: SkillDoCatalogo, repo: string): Record<string, unknown> {
  const e = ESTRUTURA[s.id]!; const arquivos = listar(repo);
  const dirScripts = `.claude/skills/${e.principal}/scripts`;
  return {
    id: s.id, nome: s.nome, dominio: 'salesforce', dono: 'mantenedor', descricao: s.descricao, intencoes: s.intencoes.map((i) => (i.negativa ? i : i.texto)),
    perfis_sugeridos: s.perfis, proximo: s.proximo,
    skills: [e.principal, ...e.extras].map((n) => ({ path: `.claude/skills/${n}/SKILL.md` })),
    agentes: arquivos.filter((f) => /^\.claude\/agents\/[^/]+\.md$/.test(f) && !/README\.md$/i.test(f)),
    regras: arquivos.filter((f) => /^\.claude\/rules\/[^/]+\.md$/.test(f)),
    ...(arquivos.some((f) => f.startsWith(`${dirScripts}/`)) ? { runtime: { dir: dirScripts, node: '>=20', prerequisitos: ['node', 'git'] } } : {}),
  };
}

export function avaliar(raiz: string, base: string): Array<{ skill: SkillDoCatalogo; repo: string | null; r?: ResultadoLint; tokens?: number; yaml?: string }> {
  return lerCatalogo(raiz).skills.map((skill) => {
    const repo = acharRepo(base, skill.repo); if (!repo) return { skill, repo };
    const dir = join(raiz, 'catalog', 'migracao', skill.id); mkdirSync(dir, { recursive: true });
    const yaml = join(dir, 'odin.yaml');
    writeFileSync(yaml, `# Rascunho gerado por scripts/prontidao-skills.ts a partir do catálogo e da estrutura do repositório.\n# Na migração (F6), este arquivo vai para a raiz do repositório da skill, revisado.\n${YAML.stringify(rascunho(skill, repo), { lineWidth: 0 })}`);
    const r = lint(repo, { odinYaml: yaml, rascunho: true });
    const principal = join(repo, '.claude/skills', ESTRUTURA[skill.id]!.principal, 'SKILL.md');
    return { skill, repo, r, yaml, tokens: existsSync(principal) ? estimarTokens(readFileSync(principal, 'utf8')) : 0 };
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop()!)) {
  const raiz = process.cwd(); const a = process.argv.slice(2);
  const base = resolve(a.includes('--repos') ? a[a.indexOf('--repos') + 1]! : '..');
  const res = avaliar(raiz, base);
  const L: string[] = ['# Migração das skills: prontidão', '', '> Gerado por `node scripts/prontidao-skills.ts` (não edite à mão). Cada skill real passa pelo `odin lint` com o rascunho de contrato em `catalog/migracao/<id>/odin.yaml`. Os repositórios das skills não são alterados.', '> Etapas e encadeamento: [PIPELINE.md](PIPELINE.md). Checklist da migração: skill `odin-curador`.', '', '## Resumo', '', '| Etapa | Skill | Situação | Bloqueios | Avisos | `SKILL.md` principal | Arquivos entregues |', '|---|---|---|---|---|---|---|'];
  for (const x of res) {
    if (!x.r) { L.push(`| ${x.skill.etapa} | ${x.skill.nome} | Repositório não encontrado | — | — | — | — |`); continue; }
    const n = Object.values(x.r.arquivos).reduce((s, v) => s + v.length, 0);
    L.push(`| ${x.skill.etapa} | ${x.skill.nome} | ${x.r.erros.length ? '**Bloqueada**' : 'Publicável em rascunho'} | ${x.r.erros.length} | ${x.r.avisos.length} | ~${x.tokens} tokens | ${n} |`);
  }
  L.push('', '**Publicável em rascunho** = passa no `odin lint` com o contrato gerado; o pipeline insere o passo `odin ensure`. Para sair do rascunho falta o checklist do `odin-curador`: contrato no repositório da skill, regras do `CLAUDE.md` movidas, hooks como políticas do guard, bibliotecas de terceiros num pacote compartilhado, 20 intenções revisadas e avaliações de comportamento.', '', '## Detalhe por skill', '');
  for (const x of res) {
    if (!x.r) continue;
    const q = x.r.arquivos;
    L.push(`### ${x.skill.nome} (\`${x.skill.id}\`)`, '', `Entrega: ${q.skills.length} \`SKILL.md\`, ${q.agentes.length} agentes, ${q.regras.length} regras, ${q.referencias.length} referências, ${q.runtime.length} arquivos de runtime.`, '');
    if (x.r.erros.length) L.push('Bloqueios:', ...x.r.erros.slice(0, 25).map((e) => `- ${e}`), ...(x.r.erros.length > 25 ? [`- (mais ${x.r.erros.length - 25})`] : []), '');
    if (x.r.avisos.length) L.push('Avisos:', ...x.r.avisos.slice(0, 15).map((e) => `- ${e}`), ...(x.r.avisos.length > 15 ? [`- (mais ${x.r.avisos.length - 15})`] : []), '');
  }
  writeFileSync(join(raiz, 'docs', 'MIGRACAO-SKILLS.md'), `${L.join('\n')}\n`);
  for (const x of res) console.log(`${x.r ? (x.r.erros.length ? '✗' : '✓') : '?'} ${x.skill.id.padEnd(24)} ${x.r ? `${x.r.erros.length} bloqueio(s), ${x.r.avisos.length} aviso(s)` : 'repositório não encontrado'}`);
}
