#!/usr/bin/env node
// Confere as bibliotecas de terceiros compartilhadas (ADR 0028): lib.yaml completo, LICENSE, itens existentes,
// nenhum Unicode oculto nem segredo, e nenhum item com o mesmo nome em duas libs (colisão).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import YAML from 'yaml';
import { caracteresOcultos } from './lib/unicode.mjs';

const RAIZ = join(import.meta.dirname, '..'); const LIBS = join(RAIZ, 'libs'); const erros = [];
const SEGREDO = /odin_(rt|pat)_[A-Za-z0-9_-]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{20,})\b/;
const TEXTO = /\.(md|txt|ya?ml|json|mjs|js|ts|css|html|cls|xml)$/i; const vistos = new Map();
const andar = (d) => readdirSync(d).flatMap((e) => (statSync(join(d, e)).isDirectory() ? andar(join(d, e)) : [join(d, e)]));
for (const id of existsSync(LIBS) ? readdirSync(LIBS).filter((e) => statSync(join(LIBS, e)).isDirectory()) : []) {
  const base = join(LIBS, id); const y = existsSync(join(base, 'lib.yaml')) ? YAML.parse(readFileSync(join(base, 'lib.yaml'), 'utf8')) : null;
  if (!y) { erros.push(`${id}: sem lib.yaml`); continue; }
  if (y.id !== id) erros.push(`${id}: lib.yaml tem id "${y.id}"`);
  if (!/^\d+\.\d+\.\d+$/.test(String(y.versao))) erros.push(`${id}: versão inválida`);
  for (const k of ['grupo', 'licenca', 'origem']) if (!y[k]) erros.push(`${id}: falta ${k}`);
  if (!existsSync(join(base, 'LICENSE'))) erros.push(`${id}: sem LICENSE`);
  if (!Array.isArray(y.itens) || !y.itens.length) erros.push(`${id}: sem itens`);
  for (const item of y.itens ?? []) {
    if (!existsSync(join(base, 'conteudo', item))) erros.push(`${id}: item ausente: ${item}`);
    const nome = `${y.grupo}/${item}`; if (vistos.has(nome)) erros.push(`colisão: ${nome} está em ${vistos.get(nome)} e ${id}`); vistos.set(nome, id);
  }
  for (const f of andar(base).filter((p) => TEXTO.test(p))) {
    const t = readFileSync(f, 'utf8'); const rel = relative(RAIZ, f);
    if (caracteresOcultos(t).length) erros.push(`${rel}: Unicode oculto`); if (SEGREDO.test(t)) erros.push(`${rel}: parece conter segredo`);
  }
}
if (erros.length) { console.error(`✗ libs: ${erros.length} problema(s)\n- ${erros.join('\n- ')}`); process.exit(1); }
console.log(`✓ libs: ${vistos.size} item(ns) em ${existsSync(LIBS) ? readdirSync(LIBS).length : 0} biblioteca(s), sem colisão`);
