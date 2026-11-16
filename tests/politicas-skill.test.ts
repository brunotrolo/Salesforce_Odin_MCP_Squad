import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executarGuardCompleto } from '../packages/guard/src/guard.ts';
import { registrarSkillNaSessao, skillsDaSessao } from '../packages/guard/src/politicas-skill.ts';
import { lint } from '../packages/lint/src/lint.ts';

function ambiente(politicas: Record<string, string>) {
  const home = mkdtempSync(join(tmpdir(), 'odin-pol-')); const odin = join(home, '.odin'); process.env.ODIN_TESTE_HOME = home; process.env.ODIN_HOME = odin;
  for (const [skill, codigo] of Object.entries(politicas)) { const d = join(odin, 'runtime', skill, 'current', 'scripts', 'politicas'); mkdirSync(d, { recursive: true }); writeFileSync(join(d, `${skill}.mjs`), codigo); }
  return { home, odin };
}
const POL = `export default (e) => { const c = String(e.tool_input?.command ?? ''); if (/mutar-dados/.test(c)) return { decisao: 'negar', motivo: 'sem mutar dados' }; if (/confirmar-deploy/.test(c)) return { decisao: 'perguntar', motivo: 'confirme o deploy' }; if (/avisar-algo/.test(c)) return { decisao: 'alertar', motivo: 'atenção' }; return null; };`;
const ev = (command: string, sessao = 's1') => JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp/projeto', session_id: sessao });

test('políticas por skill: só valem depois do `odin ensure` na sessão; negar, perguntar e alertar; sessão diferente não herda', async () => {
  const { odin } = ambiente({ 'sf-x': POL });
  assert.equal((await executarGuardCompleto(ev('echo mutar-dados'))).codigo, 0, 'sem ensure a política da skill não vale');
  assert.equal((await executarGuardCompleto(ev('odin ensure sf-x'))).codigo, 0); assert.deepEqual(skillsDaSessao(odin, 's1'), ['sf-x']);
  const n = await executarGuardCompleto(ev('echo mutar-dados')); assert.equal(n.codigo, 2); assert.match(n.mensagem!, /sem mutar dados.*sf-x/);
  const p = await executarGuardCompleto(ev('echo confirmar-deploy')); assert.equal(p.codigo, 0); assert.equal(JSON.parse(p.saida!).hookSpecificOutput.permissionDecision, 'ask');
  const al = await executarGuardCompleto(ev('echo avisar-algo')); assert.equal(al.codigo, 0); assert.match(readFileSync(join(odin, 'cache', 'guard.log'), 'utf8'), /alertar/);
  assert.equal((await executarGuardCompleto(ev('echo mutar-dados', 's2'))).codigo, 0, 'outra sessão não herda');
});
test('políticas por skill: a política global continua mandando e uma política quebrada nega (fail-closed)', async () => {
  ambiente({ 'sf-y': 'export default () => { throw new Error("bug"); };', 'sf-z': 'export const nada = 1;' });
  await executarGuardCompleto(ev('odin ensure sf-y')); const q = await executarGuardCompleto(ev('ls')); assert.equal(q.codigo, 2); assert.match(q.mensagem!, /sf-y.*falhou/);
  const g = await executarGuardCompleto(ev('sudo ls', 's9')); assert.equal(g.codigo, 2); assert.match(g.mensagem!, /PG-08/);
});
test('políticas por skill: id inválido não é registrado e o mapa guarda só as 50 sessões mais recentes', () => {
  const { odin } = ambiente({}); registrarSkillNaSessao(odin, 's', '../../etc'); registrarSkillNaSessao(odin, undefined, 'sf-a'); assert.deepEqual(skillsDaSessao(odin, 's'), []);
  for (let i = 0; i < 60; i++) registrarSkillNaSessao(odin, `s${i}`, 'sf-a'); assert.equal(Object.keys(JSON.parse(readFileSync(join(odin, 'cache', 'sessoes-skills.json'), 'utf8'))).length, 50);
});
test('lint: política declarada precisa do arquivo no runtime', () => {
  const d = mkdtempSync(join(tmpdir(), 'odin-lint-')); mkdirSync(join(d, '.claude/skills/sf-w/scripts'), { recursive: true }); mkdirSync(join(d, 'evals'), { recursive: true });
  writeFileSync(join(d, '.claude/skills/sf-w/SKILL.md'), '---\nname: sf-w\ndescription: x\n---\nrode `odin ensure sf-w`\n'); writeFileSync(join(d, '.claude/skills/sf-w/scripts/a.mjs'), 'export {}\n');
  const y = (p: string) => `id: sf-w\nnome: Wtest\ndominio: salesforce\ndono: mantenedor\ndescricao: Skill de teste para a política de guard.\nintencoes:\n${Array.from({ length: 8 }, (_, i) => `  - frase de teste número ${i + 1} da skill w`).join('\n')}\n  - texto: nada a ver\n    negativa: true\n  - texto: outra coisa\n    negativa: true\nperfis_sugeridos: [dev]\nskills:\n  - path: .claude/skills/sf-w/SKILL.md\nruntime:\n  dir: .claude/skills/sf-w/scripts\n  prerequisitos: [node]\n${p}`;
  writeFileSync(join(d, 'odin.yaml'), y('politicas: [sf-w]\n')); assert.match(lint(d).erros.join('\n'), /politicas: arquivo ausente/);
  mkdirSync(join(d, '.claude/skills/sf-w/scripts/politicas'), { recursive: true }); writeFileSync(join(d, '.claude/skills/sf-w/scripts/politicas/sf-w.mjs'), 'export default () => null;\n');
  assert.ok(!lint(d).erros.some((e) => /politicas/.test(e)), lint(d).erros.join('\n'));
});
