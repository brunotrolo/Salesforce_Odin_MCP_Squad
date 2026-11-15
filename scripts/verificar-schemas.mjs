#!/usr/bin/env node
// Valida os contratos do Odin em schemas/ (ADR 0018).
// Uso: node scripts/verificar-schemas.mjs [--raiz <dir>]
//  - todo *.schema.json compila em modo estrito (JSON Schema 2020-12)
//  - todo exemplos/<nome>.exemplo.(json|yaml) é válido contra <nome>.schema.json
//  - o modelo de odin.yaml do curador é válido contra odin.schema.json
//  - mcp-tools.json: no máximo 7 ferramentas, nomes únicos com prefixo odin_, descrições curtas,
//    schemas de entrada e saída válidos, anotações presentes; os nomes batem com a documentação
//  - openapi/*.yaml: versão 3.1, operationId único, toda rota com resposta de erro e todo $ref resolvido
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';

const lerDados = (p) => (/\.ya?ml$/.test(p) ? YAML.parse(readFileSync(p, 'utf8')) : JSON.parse(readFileSync(p, 'utf8')));
const novoAjv = () => { const a = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, allowUnionTypes: true }); addFormats(a); return a; };
const msg = (erros) => (erros || []).slice(0, 3).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

export function verificar(raiz) {
  const erros = [];
  const dir = join(raiz, 'schemas');
  if (!existsSync(dir)) return { erros: ['pasta schemas/ não existe'], schemas: 0, exemplos: 0, ferramentas: 0 };
  const ajv = novoAjv();
  const validadores = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.schema.json')).sort()) {
    try { validadores[f.replace('.schema.json', '')] = ajv.compile(lerDados(join(dir, f))); }
    catch (e) { erros.push(`schemas/${f}: schema inválido: ${e.message}`); }
  }

  // exemplos
  let exemplos = 0;
  const dex = join(dir, 'exemplos');
  for (const f of existsSync(dex) ? readdirSync(dex).sort() : []) {
    const m = f.match(/^(.+)\.exemplo\.(json|ya?ml)$/);
    if (!m) { erros.push(`schemas/exemplos/${f}: nome fora do padrão <schema>.exemplo.(json|yaml)`); continue; }
    const v = validadores[m[1]];
    if (!v) { erros.push(`schemas/exemplos/${f}: não existe schemas/${m[1]}.schema.json`); continue; }
    exemplos++;
    let dados; try { dados = lerDados(join(dex, f)); } catch (e) { erros.push(`schemas/exemplos/${f}: não é ${m[2]} válido: ${e.message}`); continue; }
    if (!v(dados)) erros.push(`schemas/exemplos/${f}: ${msg(v.errors)}`);
  }
  for (const nome of Object.keys(validadores)) if (!existsSync(dex) || !readdirSync(dex).some((f) => f.startsWith(`${nome}.exemplo.`))) erros.push(`schemas/${nome}.schema.json: sem exemplo em schemas/exemplos/`);

  // modelo do curador
  const modelo = join(raiz, '.claude/skills/odin-curador/templates/odin.yaml');
  if (existsSync(modelo) && validadores.odin && !validadores.odin(lerDados(modelo))) erros.push(`.claude/skills/odin-curador/templates/odin.yaml: ${msg(validadores.odin.errors)}`);

  // ferramentas MCP
  let ferramentas = 0;
  const pt = join(dir, 'mcp-tools.json');
  if (!existsSync(pt)) erros.push('schemas/mcp-tools.json não existe');
  else {
    const t = lerDados(pt); const lim = t.limites || {}; const fs = t.ferramentas || [];
    ferramentas = fs.length;
    if (fs.length > (lim.max_ferramentas ?? 7) || (lim.max_ferramentas ?? 7) > 7) erros.push(`schemas/mcp-tools.json: ${fs.length} ferramentas (máximo 7)`);
    const nomes = fs.map((f) => f.name);
    if (new Set(nomes).size !== nomes.length) erros.push('schemas/mcp-tools.json: nome de ferramenta repetido');
    for (const f of fs) {
      const onde = `schemas/mcp-tools.json: ${f.name}`;
      if (!/^odin_[a-z_]{3,40}$/.test(f.name || '')) erros.push(`${onde}: nome fora do padrão odin_<nome>`);
      if (!f.description || f.description.length > (lim.max_descricao_caracteres ?? 600)) erros.push(`${onde}: descrição ausente ou acima de ${lim.max_descricao_caracteres ?? 600} caracteres`);
      if (!f.annotations || typeof f.annotations.readOnlyHint !== 'boolean') erros.push(`${onde}: sem anotações (readOnlyHint)`);
      for (const k of ['inputSchema', 'outputSchema']) {
        if (!f[k] || f[k].type !== 'object' || f[k].additionalProperties !== false) { erros.push(`${onde}: ${k} precisa ser objeto com additionalProperties: false`); continue; }
        try { novoAjv().compile(f[k]); } catch (e) { erros.push(`${onde}: ${k} inválido: ${e.message}`); }
      }
    }
    try { novoAjv().compile(t.erro); } catch (e) { erros.push(`schemas/mcp-tools.json: schema de erro inválido: ${e.message}`); }
    // os nomes precisam bater com a documentação
    for (const doc of ['docs/arquitetura/03-arquitetura-tecnica.md', 'docs/PLANO.md']) {
      const p = join(raiz, doc); if (!existsSync(p)) continue;
      const texto = readFileSync(p, 'utf8');
      const naDoc = new Set([...texto.matchAll(/^\| `(odin_[a-z_]+)` \|/gm)].map((m) => m[1]));
      for (const n of nomes) if (!naDoc.has(n)) erros.push(`${doc}: a ferramenta ${n} está em schemas/mcp-tools.json mas não na tabela de ferramentas`);
      for (const n of naDoc) if (!nomes.includes(n)) erros.push(`schemas/mcp-tools.json: a ferramenta ${n} está em ${doc} mas não no schema`);
    }
  }

  // OpenAPI
  const dapi = join(dir, 'openapi');
  for (const f of existsSync(dapi) ? readdirSync(dapi).filter((x) => /\.ya?ml$/.test(x)) : []) {
    const onde = `schemas/openapi/${f}`;
    let api; try { api = lerDados(join(dapi, f)); } catch (e) { erros.push(`${onde}: YAML inválido: ${e.message}`); continue; }
    if (!/^3\.1\./.test(api.openapi || '')) erros.push(`${onde}: openapi precisa ser 3.1.x`);
    const ids = [];
    for (const [rota, ops] of Object.entries(api.paths || {})) for (const [metodo, op] of Object.entries(ops)) {
      if (!op.operationId) erros.push(`${onde}: ${metodo.toUpperCase()} ${rota} sem operationId`); else ids.push(op.operationId);
      if (!Object.keys(op.responses || {}).some((c) => /^[45]/.test(c))) erros.push(`${onde}: ${metodo.toUpperCase()} ${rota} sem resposta de erro`);
    }
    if (new Set(ids).size !== ids.length) erros.push(`${onde}: operationId repetido`);
    if (!api.security?.length) erros.push(`${onde}: sem security global (toda rota exige token)`);
    const resolver = (ref) => ref.replace(/^#\//, '').split('/').reduce((o, k) => (o == null ? o : o[k.replace(/~1/g, '/').replace(/~0/g, '~')]), api);
    const andar = (o) => { if (!o || typeof o !== 'object') return; if (typeof o.$ref === 'string' && (!o.$ref.startsWith('#/') || resolver(o.$ref) === undefined)) erros.push(`${onde}: $ref não resolvido: ${o.$ref}`); for (const v of Object.values(o)) andar(v); };
    andar(api);
  }
  return { erros, schemas: Object.keys(validadores).length, exemplos, ferramentas };
}

function main() {
  const a = process.argv.slice(2);
  const r = verificar(a.includes('--raiz') ? a[a.indexOf('--raiz') + 1] : process.cwd());
  if (r.erros.length) { r.erros.forEach((e) => console.log(`ERRO: ${e}`)); process.exit(1); }
  console.log(`✓ ${r.schemas} schema(s), ${r.exemplos} exemplo(s) e ${r.ferramentas} ferramenta(s) MCP válidos`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
