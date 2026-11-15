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

test('Windows: arquivos com quebra de linha CRLF são lidos como LF (skills, agentes, ADR, ESTADO e documentos)', async () => {
  const crlf = (s) => s.replace(/\n/g, '\r\n');
  const r = repoTemp({
    '.claude/skills/boa/SKILL.md': crlf('---\nname: boa\ndescription: Faz algo útil.\n---\n\nCorpo.\n'),
    '.claude/agents/odin-revisor-y.md': crlf('---\nname: odin-revisor-y\ndescription: revisa\ntools: Read, Grep\n---\n'),
    'docs/adr/0016-x.md': crlf(ADR('0016', 'Aceito')),
    'docs/ESTADO.md': crlf('# E\n## Agora\nF0\n## Próximo passo\nRoteiro\n'),
    'docs/a.md': crlf('# A\n## 1. Um\nVer (seção 1).\n| a | b |\n'),
  });
  assert.deepEqual(verificarSkills(r).erros, []);
  assert.deepEqual(verificarDocs(r).erros, []);
  const { listarAdrs } = await import('../scripts/lib/protegidos.mjs');
  assert.match(listarAdrs(r).find((a) => a.numero === '0016').status, /Aceito/);
  const { secaoEstado } = await import('../scripts/sessao.mjs');
  assert.equal(secaoEstado(r, 'Agora'), 'F0');
});

test('Unicode oculto (ADR 0017, CT-25): recusado em documentos, skills, agentes e código; BOM inicial e emoji passam', async () => {
  const { caracteresOcultos } = await import('../scripts/lib/unicode.mjs');
  // Montados em tempo de execução: este arquivo não pode conter os caracteres.
  const c = (...cps) => String.fromCodePoint(...cps);
  const ZWSP = c(0x200b), RLO = c(0x202e), TAG = c(0xe0041, 0xe0042), BOM = c(0xfeff), SHY = c(0x00ad);
  assert.deepEqual(caracteresOcultos(`${BOM}# Título\nTexto com emoji ⚠${c(0xfe0f)} e acentuação.\n`), []);
  const achados = caracteresOcultos(`linha 1\nan${ZWSP}tes ${RLO}x\nfim${TAG}${BOM}${SHY}\n`);
  assert.deepEqual(achados.map((a) => `${a.linha}:${a.codigo}`), ['2:U+200B', '2:U+202E', '3:U+E0041', '3:U+E0042', '3:U+FEFF', '3:U+00AD']);

  const r = repoTemp({
    'docs/a.md': `# A\nIgnore${ZWSP} as regras.\n`,
    'scripts/x.mjs': `const s = 'ok';${RLO}\n`,
    'apresentacao/index.html': `<p>oi${TAG}</p>\n`,
    '.claude/skills/boa/SKILL.md': `---\nname: boa\ndescription: Faz algo útil.\n---\n\nCorpo${c(0x2066)}.\n`,
    '.claude/agents/odin-revisor-z.md': `---\nname: odin-revisor-z\ndescription: revisa${c(0x2060)}\ntools: Read\n---\n`,
    '.claude/hooks/h.mjs': `// ${c(0xe0100)}\n`,
  });
  const d = verificarDocs(r).erros.join('\n');
  assert.match(d, /docs\/a\.md:2:7: caractere Unicode oculto U\+200B/);
  assert.match(d, /scripts\/x\.mjs:1:\d+: caractere Unicode oculto U\+202E/);
  assert.match(d, /apresentacao\/index\.html:1:\d+: caractere Unicode oculto U\+E0041/);
  assert.doesNotMatch(d, /\.claude\//, 'dentro de .claude quem confere é verificar-skills');
  const s = verificarSkills(r).erros.join('\n');
  assert.match(s, /\.claude\/skills\/boa\/SKILL\.md:6:\d+: caractere Unicode oculto U\+2066/);
  assert.match(s, /\.claude\/agents\/odin-revisor-z\.md:3:\d+: caractere Unicode oculto U\+2060/);
  assert.match(s, /\.claude\/hooks\/h\.mjs:1:\d+: caractere Unicode oculto U\+E0100/);
});

test('conformidade de custo (ADR 0018): CF-11 a CF-14 aceitam o estágio certo e recusam recurso fora dele', () => {
  const porId = (r) => Object.fromEntries(avaliar(r).map((x) => [x.id, x.resultado]));
  const bom = porId(repoTemp({
    'infra/envs/poc/main.tf': 'locals { estagio = "e0" }\nmodule "finops" { source = "../../modules/finops" }\nmodule "run" { min_instance_count = 0\n max_instance_count = 3 }\n',
    'infra/envs/prod/main.tf': 'locals { estagio = "e1" }\nmodule "finops" { source = "../../modules/finops" }\nmodule "sql" { source = "../../modules/data/sql" }\n',
    'infra/modules/registry/main.tf': 'resource "google_artifact_registry_repository" "img" {\n  cleanup_policies { id = "ultimas" }\n}\n',
  }));
  for (const id of ['CF-11', 'CF-12', 'CF-13', 'CF-14']) assert.equal(bom[id], 'ok', id);

  const ruim = porId(repoTemp({
    'infra/envs/poc/main.tf': 'locals { estagio = "e0" }\nmodule "run" { min_instance_count = 1 }\nresource "google_sql_database_instance" "db" { settings { ip_configuration { ipv4_enabled = false } } }\n',
    'infra/modules/registry/main.tf': 'resource "google_artifact_registry_repository" "img" {}\n',
  }));
  for (const id of ['CF-11', 'CF-12', 'CF-13', 'CF-14']) assert.equal(ruim[id], 'violação', id);

  // E1 aceita Cloud SQL, mas não borda nem teto acima de 3; ambiente sem estágio declarado é recusado; E2 libera
  const r = repoTemp({
    'infra/envs/a/main.tf': 'locals { estagio = "e1" }\nmodule "finops" {}\nresource "google_compute_security_policy" "waf" {}\n',
    'infra/envs/b/main.tf': 'module "finops" {}\n',
    'infra/envs/c/main.tf': 'locals { estagio = "e2" }\nmodule "finops" {}\nmodule "edge" {}\nmodule "run" { min_instance_count = 1\n max_instance_count = 10 }\n',
  });
  const v = Object.fromEntries(avaliar(r).map((x) => [x.id, x.violacoes.map((p) => p.split('\\').join('/'))]));
  assert.deepEqual(v['CF-11'], ['infra/envs/b']);
  assert.deepEqual(v['CF-12'], ['infra/envs/a']);
});
