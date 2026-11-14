import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoTemp, hook, ADR } from './helpers.mjs';

const edit = (raiz, p) => ({ tool_name: 'Edit', tool_input: { file_path: join(raiz, p) }, cwd: raiz });

test('guard: bloqueia edição de documento protegido sem ADR aberto', () => {
  const r = repoTemp();
  for (const p of ['docs/DECISOES.md', 'docs/PLANO.md', 'docs/arquitetura/03-arquitetura-tecnica.md', 'docs/seguranca/03-tokens-sessoes-e-chaves.md', 'docs/portal/06-consumo-cotas-e-metricas.md']) {
    const h = hook(r, edit(r, p));
    assert.equal(h.codigo, 2, p);
    assert.match(h.erro, /ADR/);
  }
});

test('guard: libera documentos não protegidos e arquivos fora do repositório', () => {
  const r = repoTemp();
  for (const p of ['docs/ESTADO.md', 'docs/adr/0016-x.md', 'docs/F0-ROTEIRO.md', 'scripts/x.mjs', 'apps/mcp-server/src/a.ts']) assert.equal(hook(r, edit(r, p)).codigo, 0, p);
  assert.equal(hook(r, { tool_name: 'Edit', tool_input: { file_path: '/tmp/fora/docs/PLANO.md' }, cwd: r }).codigo, 0);
  assert.equal(hook(r, { tool_name: 'Read', tool_input: { file_path: join(r, 'docs/PLANO.md') }, cwd: r }).codigo, 0);
});

test('guard: com ADR Proposto ou Aceito e marcador válido, libera; vencido, rejeitado ou ausente, bloqueia', () => {
  const r = repoTemp({ 'docs/adr/0016-teste.md': ADR('0016', 'Proposto') });
  mkdirSync(join(r, '.odin-dev'), { recursive: true });
  writeFileSync(join(r, '.odin-dev/adr-ativo.json'), JSON.stringify({ adr: '0016', aberto_em: new Date().toISOString() }));
  assert.equal(hook(r, edit(r, 'docs/PLANO.md')).codigo, 0);
  writeFileSync(join(r, '.odin-dev/adr-ativo.json'), JSON.stringify({ adr: '0016', aberto_em: new Date(Date.now() - 13 * 3600_000).toISOString() }));
  assert.equal(hook(r, edit(r, 'docs/PLANO.md')).codigo, 2, 'vencido');
  writeFileSync(join(r, 'docs/adr/0016-teste.md'), ADR('0016', 'Rejeitado'));
  writeFileSync(join(r, '.odin-dev/adr-ativo.json'), JSON.stringify({ adr: '0016', aberto_em: new Date().toISOString() }));
  assert.equal(hook(r, edit(r, 'docs/PLANO.md')).codigo, 2, 'rejeitado');
  writeFileSync(join(r, '.odin-dev/adr-ativo.json'), JSON.stringify({ adr: '0099', aberto_em: new Date().toISOString() }));
  assert.equal(hook(r, edit(r, 'docs/PLANO.md')).codigo, 2, 'inexistente');
});

test('guard: detecta escrita por Bash e PowerShell em documento protegido; leitura passa', () => {
  const r = repoTemp();
  const bash = (c, t = 'Bash') => hook(r, { tool_name: t, tool_input: { command: c }, cwd: r }).codigo;
  assert.equal(bash("sed -i 's/a/b/' docs/PLANO.md"), 2);
  assert.equal(bash('echo x >> docs/seguranca/03-tokens.md'), 2);
  assert.equal(bash("python3 - <<'EOF'\nopen('docs/arquitetura/01.md','w')\nEOF"), 2);
  assert.equal(bash('Set-Content docs/DECISOES.md x', 'PowerShell'), 2);
  assert.equal(bash('cat docs/PLANO.md'), 0);
  assert.equal(bash('grep -n token docs/seguranca/03-tokens.md'), 0);
});

test('guard: fail-closed com entrada ilegível', () => {
  const r = repoTemp();
  assert.equal(hook(r, '{isto não é json').codigo, 2);
});
