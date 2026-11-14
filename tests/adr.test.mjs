import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoTemp, hook, RAIZ, ADR } from './helpers.mjs';
import { novo, proximoNumero } from '../scripts/adr.mjs';
import { adrAtivo, listarAdrs } from '../scripts/lib/protegidos.mjs';

const cli = (raiz, ...args) => spawnSync(process.execPath, [join(RAIZ, 'scripts/adr.mjs'), ...args], { cwd: raiz, encoding: 'utf8' });

test('adr: numeração começa em 0016 e continua a partir do maior', () => {
  assert.equal(proximoNumero(repoTemp()), '0016');
  assert.equal(proximoNumero(repoTemp({ 'docs/adr/0021-x.md': ADR('0021', 'Aceito') })), '0022');
});

test('adr: novo cria o arquivo a partir do modelo, como Proposto, e abre o marcador que libera o hook', () => {
  const r = repoTemp();
  const { numero, arquivo } = novo(r, 'Trocar a ferramenta de empacotamento do CLI');
  assert.equal(numero, '0016');
  assert.match(arquivo, /^docs\/adr\/0016-trocar-a-ferramenta-de-empacotamento-do-cli\.md$/);
  const t = readFileSync(join(r, arquivo), 'utf8');
  assert.match(t, /^# 0016\. Trocar a ferramenta/m);
  assert.match(t, /\*\*Status:\*\* Proposto/);
  assert.equal(adrAtivo(r).ok, true);
  assert.equal(hook(r, { tool_name: 'Edit', tool_input: { file_path: join(r, 'docs/PLANO.md') }, cwd: r }).codigo, 0);
});

test('adr: aceitar, fechar e rejeitar pelo CLI', () => {
  const r = repoTemp();
  assert.equal(cli(r, 'novo', 'Decisão de teste do fluxo').status, 0);
  assert.equal(cli(r, 'aceitar', '16').status, 0);
  assert.match(listarAdrs(r).find((a) => a.numero === '0016').status, /Aceito/);
  assert.equal(cli(r, 'fechar').status, 0);
  assert.equal(existsSync(join(r, '.odin-dev/adr-ativo.json')), false);
  assert.equal(hook(r, { tool_name: 'Edit', tool_input: { file_path: join(r, 'docs/PLANO.md') }, cwd: r }).codigo, 2);
  assert.equal(cli(r, 'abrir', '16').status, 0);
  assert.equal(adrAtivo(r).ok, true);
  assert.equal(cli(r, 'rejeitar', '16').status, 0);
  assert.equal(adrAtivo(r).ok, false);
  assert.notEqual(cli(r, 'abrir', '16').status, 0, 'não reabre ADR rejeitado');
  assert.notEqual(cli(r, 'novo', 'x').status, 0, 'título curto recusado');
});
