import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';
import { avaliarDeterministico, conferirComposicao, lerCasos, portaoDePromocao, type CasoEval } from '../pipeline/avaliar.ts';

function skillComEvals(falhar = false): string {
  const repo = mkdtempSync(join(tmpdir(), 'odin-evalskill-')); mkdirSync(join(repo, 'evals/graders'), { recursive: true });
  for (const f of ['bom', 'ruim']) { mkdirSync(join(repo, 'evals/fixtures', f), { recursive: true }); writeFileSync(join(repo, 'evals/fixtures', f, 'resultado.md'), f === 'bom' ? 'linha\n'.repeat(5) : 'linha\n'.repeat(60)); }
  writeFileSync(join(repo, 'evals/graders/tem-linha.mjs'), `import { readFileSync } from 'node:fs'; import { join } from 'node:path'; export default ({ dir, args }) => ({ ok: readFileSync(join(dir, 'resultado.md'), 'utf8').includes(args.texto), motivo: 'texto ausente' });`);
  const tipos = ['positivo', 'positivo', 'positivo', 'positivo', 'negativo', 'negativo', 'negativo', 'injecao', 'injecao', 'limite'] as const;
  const casos: CasoEval[] = tipos.map((tipo, i) => ({ id: `EV-${String(i + 1).padStart(3, '0')}`, titulo: `Caso de teste número ${i + 1} do tipo ${tipo}`, tipo, critico: i === 0, camada: i === 9 ? 'modelo' : 'deterministica', fixture: `fixtures/${falhar && i === 0 ? 'ruim' : 'bom'}`, ...(i === 9 ? { pedido: 'faça o trabalho pedido' } : {}), esperado: [{ grader: 'graders/tem-linha.mjs', args: { texto: 'linha' } }, { max_linhas: { arquivo: 'resultado.md', linhas: 40 } }, { arquivo_ausente: 'segredo-*.txt' }] }));
  writeFileSync(join(repo, 'evals/casos.yaml'), YAML.stringify(casos)); return repo;
}

test('avaliações: composição mínima, schema, camada determinística e casos de modelo ignorados', async () => {
  const repo = skillComEvals(); const casos = lerCasos(repo); assert.deepEqual(conferirComposicao(casos), []);
  assert.deepEqual(conferirComposicao(casos.slice(0, 6)).length > 0, true);
  const r = await avaliarDeterministico({ repo, skill: 'sf-exemplo', sha: 'a'.repeat(40), versao: '0.1.0' });
  assert.equal(r.nota, 100); assert.deepEqual(r.ignorados, ['EV-010']); assert.equal(r.casos.length, 9);
});

test('avaliações: caso crítico que falha reprova o portão; relatório de outro SHA e queda de nota também', async () => {
  const bom = await avaliarDeterministico({ repo: skillComEvals(), skill: 'sf-exemplo', sha: 'a'.repeat(40), versao: '0.1.0' });
  assert.equal(portaoDePromocao(bom, 'a'.repeat(40), 95).ok, true);
  assert.match(portaoDePromocao(bom, 'b'.repeat(40)).motivos.join(), /SHA/);
  assert.match(portaoDePromocao({ ...bom, nota: 80 }, 'a'.repeat(40), 90).motivos.join(), /caiu/);
  const ruim = await avaliarDeterministico({ repo: skillComEvals(true), skill: 'sf-exemplo', sha: 'a'.repeat(40), versao: '0.1.0' });
  assert.equal(ruim.casos[0]!.resultado, 'falhou'); assert.match(ruim.casos[0]!.motivo!, /linhas/);
  const p = portaoDePromocao(ruim, 'a'.repeat(40)); assert.equal(p.ok, false); assert.match(p.motivos.join(), /crítico EV-001/);
});
