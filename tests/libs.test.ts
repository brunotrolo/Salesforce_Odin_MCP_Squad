import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conferirUso, lerLib } from '../packages/lint/src/libs.ts';
import { lint } from '../packages/lint/src/lint.ts';
import { publicar } from '../pipeline/publicar.ts';
import { desempacotar } from '../packages/shared/src/pacote.ts';
import { ArmazenamentoMemoria } from '../packages/shared/src/armazenamento.ts';
import { AssinadorLocal } from '../packages/shared/src/chaves.ts';

function libs() {
  const d = mkdtempSync(join(tmpdir(), 'odin-libs-')); const base = join(d, 'lib-demo'); mkdirSync(join(base, 'conteudo', 'tdd'), { recursive: true });
  writeFileSync(join(base, 'lib.yaml'), 'id: lib-demo\nversao: 1.2.0\ngrupo: terceiros\nlicenca: MIT\norigem: Fulano\nitens:\n  - tdd\n'); writeFileSync(join(base, 'LICENSE'), 'MIT'); writeFileSync(join(base, 'conteudo', 'tdd', 'SKILL.md'), '# TDD\n');
  return d;
}
function skill() {
  const d = mkdtempSync(join(tmpdir(), 'odin-skill-')); mkdirSync(join(d, '.claude/skills/sf-l/scripts'), { recursive: true }); mkdirSync(join(d, '.claude/agents'), { recursive: true }); mkdirSync(join(d, 'evals'), { recursive: true });
  writeFileSync(join(d, '.claude/skills/sf-l/SKILL.md'), '---\nname: sf-l\ndescription: x\n---\nrode `odin ensure sf-l`. Leia `.claude/skills/terceiros/tdd/SKILL.md` antes de escrever o teste.\n');
  writeFileSync(join(d, '.claude/skills/sf-l/scripts/a.mjs'), 'export {}\n'); writeFileSync(join(d, '.claude/agents/dev.md'), '---\nname: dev\ndescription: y\ntools: Read, Grep\n---\nUse `.claude/skills/terceiros/tdd/SKILL.md`.\n');
  writeFileSync(join(d, 'odin.yaml'), `id: sf-l\nnome: Skill L\ndominio: salesforce\ndono: mantenedor\ndescricao: Skill de teste das bibliotecas compartilhadas.\nintencoes:\n${Array.from({ length: 8 }, (_, i) => `  - frase de teste número ${i + 1} da skill l`).join('\n')}\n  - texto: nada a ver\n    negativa: true\n  - texto: outra coisa\n    negativa: true\nperfis_sugeridos: [dev]\nskills:\n  - path: .claude/skills/sf-l/SKILL.md\nagentes:\n  - .claude/agents/dev.md\nusa:\n  - lib-demo@^1\nruntime:\n  dir: .claude/skills/sf-l/scripts\n  prerequisitos: [node]\n`);
  return d;
}
test('libs: versão compatível (^, ~, exata), incompatível e inexistente', () => {
  const d = libs();
  assert.ok(conferirUso(d, 'lib-demo@^1').lib); assert.ok(conferirUso(d, 'lib-demo@^1.1').lib); assert.ok(conferirUso(d, 'lib-demo@~1.2').lib); assert.ok(conferirUso(d, 'lib-demo@1.2.0').lib);
  assert.match(conferirUso(d, 'lib-demo@^2').erro!, /não é satisfeita/); assert.match(conferirUso(d, 'lib-demo@^1.3').erro!, /não é satisfeita/); assert.match(conferirUso(d, 'lib-outra@^1').erro!, /não existe/); assert.match(conferirUso(d, 'x').erro!, /não segue/);
  assert.equal(lerLib(d, 'lib-demo')?.licenca, 'MIT');
});
test('libs: o lint reprova biblioteca inexistente e o publicador inclui a lib no runtime assinado, reescrevendo os caminhos', async () => {
  const d = libs(); const s = skill();
  assert.match(lint(s, { libsDir: mkdtempSync(join(tmpdir(), 'vazio-')) }).erros.join('\n'), /não existe em libs/);
  const arm = new ArmazenamentoMemoria(); const ass = AssinadorLocal.gerar('teste').assinador;
  const r = await publicar({ repo: s, versao: '1.0.0', canal: 'beta', fonte: { repo: 'x/y', sha: 'a'.repeat(40) }, assinador: ass, armazenamento: arm, libsDir: d });
  assert.deepEqual((r.manifesto.entrega as { libs: unknown[] }).libs, [{ id: 'lib-demo', versao: '1.2.0', licenca: 'MIT' }]);
  const rt = desempacotar((await arm.ler(`pacotes/sf-l/1.0.0/runtime.odinpkg`))!);
  assert.equal(rt['libs/lib-demo/tdd/SKILL.md']!.toString(), '# TDD\n'); assert.equal(rt['libs/lib-demo/LICENSE']!.toString(), 'MIT');
  assert.match(rt['agentes/odin-sf-l-dev.md']!.toString(), /\{\{ODIN_RUNTIME\}\}\/libs\/lib-demo\/tdd\/SKILL\.md/);
  assert.match(rt['conteudo/SKILL.md']!.toString(), /\{\{ODIN_RUNTIME\}\}\/libs\/lib-demo\/tdd\/SKILL\.md/); assert.ok(!/\.claude\/skills\/terceiros/.test(rt['conteudo/SKILL.md']!.toString()));
  assert.ok((r.manifesto.arquivos as Record<string, string>)['runtime/libs/lib-demo/tdd/SKILL.md'], 'a lib entra nos hashes do manifesto assinado');
});
