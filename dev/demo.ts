#!/usr/bin/env node
// `npm run demo`: o Odin de ponta a ponta em poucos segundos, numa pasta temporária, sem tocar na sua máquina.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { revogarDispositivo } from '../apps/sts/src/sts.ts';
import { lerConfig } from '../packages/cli/src/ambiente.ts';
import { cabecalhos } from '../packages/cli/src/credenciais.ts';
import { ensure } from '../packages/cli/src/ensure.ts';
import { principal } from '../packages/cli/src/odin.ts';
import { executarGuard } from '../packages/guard/src/guard.ts';
import { RAIZ, subirLocal } from './ambiente.ts';

const cor = (c: number, s: string) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
let n = 0; const passo = (t: string) => console.log(`\n${cor(36, `${++n}.`)} ${cor(1, t)}`); const ok = (s: string) => console.log(`   ${cor(32, '✓')} ${s}`); const nao = (s: string) => console.log(`   ${cor(31, '✗')} ${s}`);

let adiantado = 0;
const amb = await subirLocal({ agora: () => Date.now() + adiantado });
const casa = mkdtempSync(join(tmpdir(), 'odin-demo-casa-')); const projeto = mkdtempSync(join(tmpdir(), 'odin-demo-projeto-'));
Object.assign(process.env, { ODIN_TESTE_HOME: casa, ODIN_CHAVES_DE_PACOTE: amb.arquivoChaves, ODIN_BIN: 'odin', ODIN_SESSAO: 'demo' });
console.log(cor(1, 'Odin MCP Squad · demonstração local') + '\nTudo roda nesta máquina, numa pasta temporária. Nada é instalado no seu usuário.');

passo('O mantenedor publica uma skill (lint → pacote → assinatura → registro que confere a assinatura)');
await amb.publicarSkill(join(RAIZ, 'skills/odin-ambiente'), '1.0.0'); ok('odin-ambiente 1.0.0 assinada e no catálogo, ao lado das 10 skills do ciclo');

passo('O dev roda `odin setup` uma vez e aprova o dispositivo no navegador');
await principal(['setup', '--servidor', amb.sts], (l) => { const m = /código:\s+([A-Z]{4}-[A-Z]{4})/.exec(l); if (m) { ok(`código ${m[1]} aprovado como Dev Exemplo`); void amb.aprovar(m[1]!, 'usr_dev'); } });
ok('credencial ligada à chave deste dispositivo; Claude Code conectado; guard instalado'); ok(`arquivos escritos no projeto do dev: ${readdirSync(projeto).length}`);

const cli = new Client({ name: 'demo', version: '1.0.0' });
await cli.connect(new StreamableHTTPClientTransport(new URL(amb.mcp), { requestInit: { headers: await cabecalhos() } }));
const chamar = async (name: string, args: Record<string, unknown>) => (await cli.callTool({ name, arguments: args })) as { structuredContent?: any; content: Array<{ text: string }>; isError?: boolean };

passo('O dev pede em linguagem natural, e o Odin escolhe a skill entre as que ele pode usar');
for (const pedido of ['crie a classe de teste do CaseRouter', 'investigue esse erro que apareceu no log', 'tenho um curl da API do parceiro, crie o callout', 'teste a jornada de proposta na sandbox', 'transforme a transcrição da reunião em backlog', 'qual a previsão do tempo amanhã?']) {
  const r = (await chamar('odin_rotear', { pedido })).structuredContent;
  if (r.nao_sei) nao(`"${pedido}" → não sei: ${r.pergunta}`); else ok(`"${pedido}" → ${r.candidatas[0].skill} (${r.candidatas[0].confianca})`);
}
console.log('   (o backlog é do perfil PO: para o dev, o Discovery nem aparece como opção)');

passo('O Odin entrega a skill, e o `odin ensure` só libera com o guard ativo e o pacote íntegro');
const sk = await chamar('odin_carregar_skill', { skill: 'odin-ambiente' }); ok(`SKILL.md da versão ${sk.structuredContent.manifesto.versao} entregue, com o caminho do runtime desta máquina`);
nao(`sem o guard: ${(await ensure('odin-ambiente')).mensagem}`);
executarGuard(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'odin ensure odin-ambiente' }, cwd: projeto }));
const e1 = await ensure('odin-ambiente'); ok(`com o guard: instalada em ${e1.runtime} (assinatura e hash de cada arquivo conferidos)`);

passo('Alguém altera um script do runtime depois da instalação');
writeFileSync(join(casa, '.odin/runtime/odin-ambiente/1.0.0/scripts/verificar-ambiente.mjs'), '// adulterado');
process.env.ODIN_SESSAO = 'demo-2'; executarGuard(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'odin ensure odin-ambiente' }, cwd: projeto }));
const e2 = await ensure('odin-ambiente'); ok(`detectado na sessão seguinte e reinstalado do pacote assinado (reparado: ${e2.reparado})`);

passo('O guard barra o que não pode, em código, não em instrução');
for (const [ferramenta, entrada] of [['Bash', { command: 'sf project deploy start --target-org producao' }], ['Read', { file_path: join(casa, '.claude.json') }], ['Bash', { command: 'rm -rf ~/.odin' }], ['Bash', { command: 'git push --force origin main' }], ['Bash', { command: 'npm test' }]] as Array<[string, Record<string, string>]>) {
  const r = executarGuard(JSON.stringify({ tool_name: ferramenta, tool_input: entrada, cwd: projeto }));
  const texto = entrada.command ?? `ler ${entrada.file_path!.replace(casa, '~')}`;
  if (r.codigo === 2) nao(`${texto} → ${r.mensagem!.split(' (')[0]}`); else ok(`${texto} → permitido`);
}

passo('Conhecimento com citação, só do projeto da pessoa');
const kb = (await chamar('odin_conhecimento_buscar', { consulta: 'prazo de primeira resposta para casos de prioridade alta' })).structuredContent.trechos[0];
ok(`"${kb.texto}"`); ok(`fonte: ${kb.citacao.documento} · ${kb.citacao.secao} · ${kb.citacao.vigencia}`);
const outro = (await chamar('odin_conhecimento_buscar', { consulta: 'aprovação de desconto pelo gerente regional' })).structuredContent.trechos;
ok(`regra de outro cliente (Projeto Boreal): ${outro.some((t: any) => /BOREAL/.test(t.citacao.documento)) ? 'VAZOU' : 'não aparece'}`);

passo('Um administrador revoga o dispositivo');
const me = async () => (await fetch(`${new URL(amb.mcp).origin}/v1/me`, { headers: await cabecalhos() })).status;
ok(`antes: o servidor responde ${await me()}`); await revogarDispositivo(amb.store, lerConfig().deviceId!); adiantado += 31_000; nao(`31 segundos depois: o servidor responde ${await me()}`);

passo('Tudo ficou registrado, sem o texto dos pedidos');
const porAcao = new Map<string, number>(); for (const e of amb.eventos) porAcao.set(e.acao, (porAcao.get(e.acao) ?? 0) + 1);
ok([...porAcao].map(([a, q]) => `${a} ×${q}`).join(' · '));
ok(`algum evento contém "CaseRouter"? ${JSON.stringify(amb.eventos).includes('CaseRouter') ? 'sim' : 'não'}`);

passo('O dev desinstala');
await principal(['uninstall'], () => {}); ok(`~/.odin existe? ${existsSync(join(casa, '.odin')) ? 'sim' : 'não'} · servidor MCP registrado? ${existsSync(join(casa, '.claude.json')) ? 'sim' : 'não'}`);

await cli.close(); await amb.fechar(); rmSync(casa, { recursive: true, force: true }); rmSync(projeto, { recursive: true, force: true });
console.log(`\n${cor(1, 'Fim.')} Para usar de verdade no seu Claude Code: npm run dev`);
