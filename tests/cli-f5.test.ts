// F5: odin update (CLI assinado), cópias antigas (arquivar e devolver) e recusa de CLI adulterado.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { RAIZ, subirLocal } from '../dev/ambiente.ts';
import { atualizarCli, maisNovo } from '../packages/cli/src/atualizar.ts';
import { arquivosDoCli, publicarCli } from '../pipeline/cli.ts';
import { restaurarCopias } from '../packages/cli/src/copias.ts';
import { principal } from '../packages/cli/src/odin.ts';
import { AssinadorLocal } from '../packages/shared/src/chaves.ts';

test('maisNovo compara versões', () => { assert.equal(maisNovo('0.3.0', '0.2.0'), true); assert.equal(maisNovo('0.2.0', '0.2.0'), false); assert.equal(maisNovo('1.0.0', '0.9.9'), true); assert.equal(maisNovo('0.1.9', '0.2.0'), false); });
test('o CLI só depende de código do repositório e do Node (nenhum pacote de terceiros)', () => { const f = arquivosDoCli(RAIZ); assert.ok(f.includes('packages/cli/src/odin.ts') && f.includes('packages/cli/src/atualizar.ts') && f.some((x) => x.startsWith('packages/guard/'))); });

test('odin update: instala o CLI assinado, confere hashes, recusa assinatura falsa e pacote adulterado', async (t) => {
  const amb = await subirLocal(); t.after(() => amb.fechar());
  const casa = mkdtempSync(join(tmpdir(), 'odin-casa-f5-')); const cli = AssinadorLocal.gerar('cli-2026-a');
  const chaves = join(casa, 'chaves.json'); writeFileSync(chaves, JSON.stringify([amb.assinadorPacotes.publica(), cli.assinador.publica()]));
  Object.assign(process.env, { ODIN_TESTE_HOME: casa, ODIN_CHAVES_DE_PACOTE: chaves, ODIN_BIN: 'odin', ODIN_SESSAO: 'f5' }); delete process.env.ODIN_HOME; delete process.env.CLAUDE_CONFIG_DIR; delete process.env.ODIN_CLAUDE_JSON;
  const cod = await principal(['setup', '--servidor', amb.sts], (l) => { const m = /código:\s+([A-Z]{4}-[A-Z]{4})/.exec(l); if (m) void amb.aprovar(m[1]!, 'usr_dev'); }); assert.equal(cod, 0);
  const pub = (versao: string, assinador = cli.assinador) => publicarCli({ raiz: RAIZ, versao, assinador, armazenamento: amb.armazenamento, store: amb.store, chaves: [amb.assinadorPacotes.publica(), cli.assinador.publica()] });

  assert.match((await atualizarCli('0.2.0')).mensagem, /não foi publicado|publicado|consultar/i); // nada publicado ainda
  await pub('0.3.0'); const r = await atualizarCli('0.2.0'); assert.equal(r.atualizou, true); assert.equal(r.versao, '0.3.0');
  const entrada = join(casa, '.odin', 'cli', '0.3.0', 'packages', 'cli', 'src', 'odin.ts'); assert.ok(existsSync(entrada), 'arquivos extraídos');
  assert.ok(existsSync(join(casa, '.odin', 'bin', process.platform === 'win32' ? 'odin.cmd' : 'odin')), 'atalho odin criado');
  const v = spawnSync(process.execPath, [entrada, '--version'], { encoding: 'utf8' }); assert.equal(v.status, 0, v.stderr); assert.match(v.stdout, /0\.2\.0/);
  assert.equal((await atualizarCli('0.3.0')).atualizou, false, 'já está na mais nova');

  await pub('0.4.0', AssinadorLocal.gerar('cli-2026-a').assinador); // assinada por outra chave, com o mesmo kid
  await assert.rejects(atualizarCli('0.2.0'), /assinatura válida/); assert.ok(!existsSync(join(casa, '.odin', 'cli', '0.4.0')), 'nada instalado');
  await pub('0.5.0'); await amb.armazenamento.gravar('cli/0.5.0/cli.odinpkg', Buffer.from('conteúdo trocado'));
  await assert.rejects(atualizarCli('0.2.0'), /não bate com o manifesto/); assert.ok(!existsSync(join(casa, '.odin', 'cli', '0.5.0')), 'nada instalado');
});

test('cópias antigas: doctor --limpar-copias arquiva e remove; restore-copias devolve sem sobrescrever; expira em 30 dias', async () => {
  const casa = mkdtempSync(join(tmpdir(), 'odin-casa-cp-')); const projeto = mkdtempSync(join(tmpdir(), 'odin-proj-cp-'));
  Object.assign(process.env, { ODIN_TESTE_HOME: casa }); delete process.env.ODIN_HOME;
  mkdirSync(join(casa, '.odin', 'cache'), { recursive: true }); mkdirSync(join(casa, '.odin', 'runtime', 'sf-teste', '1.0.0'), { recursive: true });
  writeFileSync(join(casa, '.odin', 'cache', 'instalados.json'), JSON.stringify({ 'sf-teste': { versao: '1.0.0' } }));
  writeFileSync(join(casa, '.odin', 'runtime', 'sf-teste', '1.0.0', 'manifesto.json'), JSON.stringify({ entrega: { copias: ['.claude/skills/sf-teste', '.claude/agents/sf-teste-a.md'] } }));
  for (const [f, c] of [['.claude/skills/sf-teste/SKILL.md', '# antiga'], ['.claude/skills/sf-teste/scripts/x.mjs', 'export {}'], ['.claude/agents/sf-teste-a.md', 'agente'], ['.claude/skills/outra/SKILL.md', 'não é do Odin']] as const) { mkdirSync(join(projeto, f, '..'), { recursive: true }); writeFileSync(join(projeto, f), c); }
  const antes = process.cwd(); process.chdir(projeto);
  try {
    const linhas: string[] = [];
    assert.equal(await principal(['doctor', '--limpar-copias'], (l) => linhas.push(l)), 1, 'sem --sim só lista'); assert.ok(existsSync(join(projeto, '.claude/skills/sf-teste/SKILL.md')), 'nada removido sem confirmação'); assert.match(linhas.join('\n'), /sf-teste\/SKILL\.md/);
    assert.equal(await principal(['doctor', '--limpar-copias', '--sim'], (l) => linhas.push(l)), 0);
    assert.ok(!existsSync(join(projeto, '.claude/skills/sf-teste')) && !existsSync(join(projeto, '.claude/agents/sf-teste-a.md')), 'cópias removidas'); assert.ok(existsSync(join(projeto, '.claude/skills/outra/SKILL.md')), 'o que não é do Odin fica');
    assert.ok(existsSync(join(casa, '.odin', 'arquivo-copias', 'indice.json')), 'pacote de arquivo criado');
    mkdirSync(join(projeto, '.claude/agents'), { recursive: true }); writeFileSync(join(projeto, '.claude/agents/sf-teste-a.md'), 'editado depois');
    assert.equal(await principal(['restore-copias'], (l) => linhas.push(l)), 0);
    assert.equal(readFileSync(join(projeto, '.claude/skills/sf-teste/scripts/x.mjs'), 'utf8'), 'export {}', 'devolvido'); assert.equal(readFileSync(join(projeto, '.claude/agents/sf-teste-a.md'), 'utf8'), 'editado depois', 'não sobrescreve o que já existe');
    assert.throws(() => restaurarCopias(projeto, Date.now() + 31 * 86_400_000), /expirou/);
  } finally { process.chdir(antes); }
});

test('instalador: confere a assinatura com a chave fixada, instala o CLI e ativa o dispositivo (de ponta a ponta)', async (t) => {
  const amb = await subirLocal(); t.after(() => amb.fechar());
  const casa = mkdtempSync(join(tmpdir(), 'odin-casa-inst-')); const cli = AssinadorLocal.gerar('cli-2026-a'); const chaves = join(casa, 'chaves-publicas.json');
  writeFileSync(chaves, JSON.stringify([amb.assinadorPacotes.publica(), cli.assinador.publica()]));
  await publicarCli({ raiz: RAIZ, versao: '0.3.0', assinador: cli.assinador, armazenamento: amb.armazenamento, store: amb.store, chaves: [amb.assinadorPacotes.publica(), cli.assinador.publica()] });
  const env = { ...process.env, ODIN_TESTE_HOME: casa, ODIN_HOME: join(casa, '.odin'), ODIN_BIN: 'odin', ODIN_SESSAO: 'inst' };
  const { spawn } = await import('node:child_process');
  const executar = (extra: string[], chavesArq: string) => new Promise<{ codigo: number; saida: string }>((ok) => {
    const p = spawn(process.execPath, [join(RAIZ, 'instalador', 'instalar.mjs'), '--servidor', amb.sts, '--chaves', chavesArq, ...extra], { env }); let saida = '';
    let aprovado = false; const ler = (d: Buffer) => { saida += d.toString(); const m = /código:\s+([A-Z]{4}-[A-Z]{4})/.exec(saida); if (m && !aprovado) { aprovado = true; void amb.aprovar(m[1]!, 'usr_dev'); } };
    p.stdout.on('data', ler); p.stderr.on('data', ler); p.on('close', (c) => ok({ codigo: c ?? 1, saida }));
  });
  const ruim = join(casa, 'chaves-erradas.json'); writeFileSync(ruim, JSON.stringify([AssinadorLocal.gerar('cli-2026-a').assinador.publica()]));
  const negado = await executar([], ruim); assert.notEqual(negado.codigo, 0); assert.match(negado.saida, /assinatura do CLI não confere/); assert.ok(!existsSync(join(casa, '.odin', 'cli', '0.3.0')), 'nada instalado com chave errada');
  const ok = await executar([], chaves); assert.equal(ok.codigo, 0, ok.saida); assert.match(ok.saida, /Odin CLI 0\.3\.0 instalado/); assert.ok(existsSync(join(casa, '.odin', 'cli', '0.3.0', 'packages', 'cli', 'src', 'odin.ts')) && existsSync(join(casa, '.odin', 'config.json')), 'CLI instalado e dispositivo ativado');
});
