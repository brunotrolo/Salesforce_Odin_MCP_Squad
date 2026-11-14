import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoTemp, RAIZ, ADR } from './helpers.mjs';
import { verificar as verificarDocs } from '../scripts/verificar-docs.mjs';
import { verificar as verificarSkills } from '../scripts/verificar-skills.mjs';
import { avaliar } from '../scripts/conformidade.mjs';

test('docs: detecta link quebrado, seção inexistente, bloco aberto, tabela sem "|" e termo descartado', () => {
  const r = repoTemp({
    'scripts/termos-proibidos.json': JSON.stringify([{ termo: '/admin/v1', motivo: 'teste' }]),
    'docs/a.md': '# A\n## 1. Um\nVer [b](b.md) e [c](nao-existe.md).\nComo na (seção 9).\n| x | y\n```\nsem fim\n',
    'docs/b.md': '# B\nRota antiga /admin/v1/users.\n| 3 | Histórico | /admin/v1 | ok |\n',
  });
  const { erros } = verificarDocs(r);
  const t = erros.join('\n');
  assert.match(t, /link quebrado → nao-existe\.md/);
  assert.match(t, /seção 9/);
  assert.match(t, /bloco de código sem fechamento/);
  assert.match(t, /linha de tabela sem/);
  assert.match(t, /docs\/b\.md:2: termo descartado/);
  assert.doesNotMatch(t, /docs\/b\.md:3/, 'tabela de histórico de revisão é ignorada');
});

test('docs: com --base, documento protegido alterado sem ADR é recusado; com ADR passa', () => {
  const r = repoTemp({ 'docs/PLANO.md': '# Plano\n', 'docs/ESTADO.md': '# Estado\n' });
  const g = (...a) => execFileSync('git', a, { cwd: r, encoding: 'utf8' });
  g('init', '-q', '-b', 'main'); g('-c', 'user.email=t@exemplo.com.br', '-c', 'user.name=t', 'add', '.'); g('-c', 'user.email=t@exemplo.com.br', '-c', 'user.name=t', 'commit', '-qm', 'base');
  g('checkout', '-qb', 'mudanca');
  writeFileSync(join(r, 'docs/PLANO.md'), '# Plano\nnovo\n');
  g('-c', 'user.email=t@exemplo.com.br', '-c', 'user.name=t', 'commit', '-qam', 'muda plano');
  assert.match(verificarDocs(r, { base: 'main' }).erros.join('\n'), /sem ADR/);
  writeFileSync(join(r, 'docs/adr/0016-teste.md'), ADR('0016', 'Proposto'));
  g('add', '.'); g('-c', 'user.email=t@exemplo.com.br', '-c', 'user.name=t', 'commit', '-qm', 'adr');
  assert.equal(verificarDocs(r, { base: 'main' }).erros.length, 0);
});

test('skills: valida frontmatter, nome igual à pasta, arquivos citados e agentes revisores somente leitura', () => {
  const r = repoTemp({
    '.claude/skills/boa/SKILL.md': '---\nname: boa\ndescription: Faz algo útil. Use quando precisar.\n---\n\nVer `references/x.md`.\n',
    '.claude/skills/boa/references/x.md': 'x',
    '.claude/skills/ruim/SKILL.md': '---\nname: Outra_Coisa\ndescription: x\n---\n\nVer `references/falta.md`.\n',
    '.claude/agents/odin-revisor-x.md': '---\nname: odin-revisor-x\ndescription: revisa\ntools: Read, Edit\n---\n',
    '.claude/agents/sem-tools.md': '---\nname: sem-tools\ndescription: d\n---\n',
  });
  const t = verificarSkills(r).erros.join('\n');
  assert.doesNotMatch(t, /skill boa/);
  assert.match(t, /skill ruim: name inválido/);
  assert.match(t, /arquivo citado não existe: references\/falta\.md/);
  assert.match(t, /odin-revisor-x\.md: revisor\/auditor precisa ser somente leitura/);
  assert.match(t, /sem-tools\.md: sem tools/);
});

test('conformidade: regras não aplicáveis sem código; violações detectadas quando o código existe', () => {
  const vazio = avaliar(repoTemp());
  assert.ok(vazio.filter((x) => x.id !== 'CF-08').every((x) => x.resultado === 'não aplicável'));
  const r = repoTemp({
    'infra/envs/poc/main.tf': 'resource "google_service_account_key" "k" {}\nresource "google_iam_workload_identity_pool_provider" "p" { attribute_condition = "assertion.repository_owner == \'x\'" }\n',
    'infra/modules/data/sql.tf': 'resource "google_sql_database_instance" "db" { settings { ip_configuration { ipv4_enabled = true } } }\n',
    'apps/sts/src/limites.ts': 'export const ACCESS_TOKEN_TTL_SECONDS = 3600;\n',
    'apps/mcp-server/src/verificar.ts': 'jwtVerify(t, k, { algorithms: ["ES256", "HS256"] })\n',
    '.github/workflows/ci.yml': 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n',
    'tests/fixture.txt': ['odin', 'pat', 'X'.repeat(32)].join('_') + '\n', // montado em tempo de execução para não versionar um token
  });
  for (let i = 1; i <= 8; i++) writeFileSync(join(r, `apps/mcp-server/src/t${i}.ts`), '');
  mkdirSync(join(r, 'apps/mcp-server/src/tools'), { recursive: true });
  for (let i = 1; i <= 8; i++) writeFileSync(join(r, `apps/mcp-server/src/tools/f${i}.ts`), '');
  const res = Object.fromEntries(avaliar(r).map((x) => [x.id, x.resultado]));
  for (const id of ['CF-01', 'CF-02', 'CF-04', 'CF-05', 'CF-06', 'CF-07', 'CF-08', 'CF-10']) assert.equal(res[id], 'violação', id);
});

test('repositório real: documentação íntegra, skills e agentes válidos, conformidade sem violação', () => {
  const d = verificarDocs(RAIZ);
  assert.deepEqual(d.erros, []);
  const s = verificarSkills(RAIZ);
  assert.deepEqual(s.erros, []);
  assert.ok(s.skills >= 4 && s.agentes >= 5);
  assert.deepEqual(avaliar(RAIZ).filter((x) => x.resultado === 'violação'), []);
});
