import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { repoTemp, RAIZ } from './helpers.mjs';
import { verificar } from '../scripts/verificar-schemas.mjs';

const copia = () => { const r = repoTemp(); cpSync(join(RAIZ, 'schemas'), join(r, 'schemas'), { recursive: true }); return r; };

test('schemas do repositório: compilam, exemplos válidos, 7 ferramentas MCP e nomes iguais aos da documentação', () => {
  const r = verificar(RAIZ);
  assert.deepEqual(r.erros, []);
  assert.ok(r.schemas >= 6 && r.exemplos >= r.schemas);
  assert.equal(r.ferramentas, 7);
});

test('schemas: odin.yaml com campo desconhecido, id inválido ou caminho fora de .claude é recusado', () => {
  const r = copia();
  const p = join(r, 'schemas/exemplos/odin.exemplo.yaml');
  const base = YAML.parse(readFileSync(p, 'utf8'));
  writeFileSync(p, YAML.stringify({ ...base, id: 'SF Test', surpresa: true, skills: [{ path: '../fora/SKILL.md' }] }));
  const t = verificar(r).erros.join('\n');
  assert.match(t, /odin\.exemplo\.yaml/);
  assert.match(t, /additional properties|pattern/);
});

test('schemas: manifesto sem hash por arquivo, eval com menos de 10 casos e evento com texto do pedido são recusados', () => {
  const r = copia();
  const ex = (f) => join(r, 'schemas/exemplos', f);
  const m = JSON.parse(readFileSync(ex('manifesto.exemplo.json'), 'utf8')); m.arquivos = { 'runtime/x.mjs': 'md5:abc' };
  writeFileSync(ex('manifesto.exemplo.json'), JSON.stringify(m));
  const e = JSON.parse(readFileSync(ex('eval-resultado.exemplo.json'), 'utf8')); e.casos = e.casos.slice(0, 3);
  writeFileSync(ex('eval-resultado.exemplo.json'), JSON.stringify(e));
  const a = JSON.parse(readFileSync(ex('evento-auditoria.exemplo.json'), 'utf8')); a.pedido = 'texto do usuário';
  writeFileSync(ex('evento-auditoria.exemplo.json'), JSON.stringify(a));
  const t = verificar(r).erros.join('\n');
  assert.match(t, /manifesto\.exemplo\.json/);
  assert.match(t, /eval-resultado\.exemplo\.json/);
  assert.match(t, /evento-auditoria\.exemplo\.json/);
});

test('schemas: oitava ferramenta MCP, nome fora do padrão, descrição longa e schema aberto são recusados', () => {
  const r = copia();
  const p = join(r, 'schemas/mcp-tools.json');
  const t = JSON.parse(readFileSync(p, 'utf8'));
  t.ferramentas.push({ ...t.ferramentas[0], name: 'outra_coisa', description: 'x'.repeat(700), inputSchema: { type: 'object' }, annotations: {} });
  writeFileSync(p, JSON.stringify(t));
  const e = verificar(r).erros.join('\n');
  assert.match(e, /8 ferramentas \(máximo 7\)/);
  assert.match(e, /outra_coisa: nome fora do padrão/);
  assert.match(e, /outra_coisa: descrição ausente ou acima/);
  assert.match(e, /outra_coisa: sem anotações/);
  assert.match(e, /outra_coisa: inputSchema precisa ser objeto com additionalProperties: false/);
});

test('schemas: ferramenta que existe no schema mas não na documentação (e o contrário) é apontada', () => {
  const r = copia();
  mkdirSync(join(r, 'docs/arquitetura'), { recursive: true });
  writeFileSync(join(r, 'docs/arquitetura/03-arquitetura-tecnica.md'), '| Ferramenta | x |\n|---|---|\n| `odin_rotear` | a |\n| `odin_fantasma` | b |\n');
  const e = verificar(r).erros.join('\n');
  assert.match(e, /odin_carregar_skill está em schemas\/mcp-tools\.json mas não na tabela/);
  assert.match(e, /odin_fantasma está em docs\/arquitetura\/03-arquitetura-tecnica\.md mas não no schema/);
});

test('schemas: OpenAPI sem operationId, sem resposta de erro ou com $ref quebrado é recusado', () => {
  const r = copia();
  const p = join(r, 'schemas/openapi/v1.yaml');
  const api = YAML.parse(readFileSync(p, 'utf8'));
  delete api.paths['/v1/me'].get.operationId;
  api.paths['/v1/policies'].get.responses = { 200: { description: 'ok' } };
  api.paths['/v1/telemetry'].post.responses['400'] = { $ref: '#/components/responses/NaoExiste' };
  writeFileSync(p, YAML.stringify(api));
  const e = verificar(r).erros.join('\n');
  assert.match(e, /GET \/v1\/me sem operationId/);
  assert.match(e, /GET \/v1\/policies sem resposta de erro/);
  assert.match(e, /\$ref não resolvido: #\/components\/responses\/NaoExiste/);
});
