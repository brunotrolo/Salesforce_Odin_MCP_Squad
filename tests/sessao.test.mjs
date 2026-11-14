import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { repoTemp, RAIZ } from './helpers.mjs';
import { secaoEstado, contarVerificar } from '../scripts/sessao.mjs';

test('sessão: lê as seções do ESTADO e conta [VERIFICAR]', () => {
  const r = repoTemp({
    'docs/ESTADO.md': '# Estado\n## Agora\nFase F0\n## Próximo passo\n1. Roteiro\n## Pendências\n- x\n',
    'docs/a.md': 'um [VERIFICAR] e outro **[VERIFICAR]** aqui\n',
  });
  assert.equal(secaoEstado(r, 'Agora'), 'Fase F0');
  assert.equal(secaoEstado(r, 'Próximo passo'), '1. Roteiro');
  assert.equal(secaoEstado(r, 'Inexistente'), null);
  assert.equal(contarVerificar(r), 2);
});

test('sessão: o início de sessão roda no repositório real e mostra o próximo passo', () => {
  const s = spawnSync(process.execPath, [join(RAIZ, 'scripts/sessao.mjs'), 'inicio'], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(s.status, 0);
  assert.match(s.stdout, /Próximo passo/);
  assert.match(s.stdout, /Leia antes de agir/);
});
