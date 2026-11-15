#!/usr/bin/env node
// Verifica os pré-requisitos das skills do Odin. Só lê. Imprime um resumo curto e grava o detalhe em arquivo
// (economia de contexto: o modelo recebe o resumo, não a saída bruta dos comandos).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const rodar = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000, shell: process.platform === 'win32' }).trim(); } catch { return null; } };
const itens = [];
const item = (nome, ok, detalhe, correcao) => itens.push({ nome, ok, detalhe, ...(ok ? {} : { correcao }) });

const node = process.versions.node; item('Node', Number(node.split('.')[0]) >= 20, `v${node}`, 'Instale o Node 20 ou mais novo (versão LTS).');
const git = rodar('git', ['--version']); item('Git', !!git, git ?? 'não encontrado', 'Instale o Git pelo instalador oficial.');
const sf = rodar('sf', ['--version']); item('Salesforce CLI', !!sf, sf ? sf.split('\n')[0] : 'não encontrado', 'npm install --global @salesforce/cli');
if (sf) {
  let org = null; try { org = JSON.parse(rodar('sf', ['org', 'display', '--json']) ?? 'null')?.result; } catch { /* sem org padrão */ }
  const tipo = org ? (org.isScratch || /scratch/i.test(org.instanceUrl ?? '') ? 'scratch' : /sandbox|--/i.test(org.instanceUrl ?? '') ? 'sandbox' : 'pode ser produção') : null;
  item('Org padrão', !!org && tipo !== 'pode ser produção', org ? `${org.alias ?? org.username ? 'definida' : 'definida'} (${tipo})` : 'nenhuma', org ? 'Defina uma sandbox ou scratch como padrão: sf config set target-org <apelido>' : 'sf org login web --alias <apelido> --set-default');
}
const cachePw = process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright') : process.platform === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : join(homedir(), '.cache/ms-playwright');
const pw = process.env.PLAYWRIGHT_BROWSERS_PATH ?? cachePw;
const temChromium = existsSync(pw) && readdirSync(pw).some((d) => d.startsWith('chromium'));
item('Navegador do Playwright', temChromium, temChromium ? 'chromium instalado' : 'não encontrado (só o Test Automator precisa)', 'npx playwright install chromium');

mkdirSync('.odin-ambiente', { recursive: true });
writeFileSync(join('.odin-ambiente', 'relatorio.json'), JSON.stringify({ em: new Date().toISOString(), so: process.platform, itens }, null, 2));
const faltam = itens.filter((i) => !i.ok);
console.log(faltam.length ? `Ambiente: ${faltam.length} item(ns) para corrigir.` : 'Ambiente pronto para as skills do Odin.');
for (const i of itens) console.log(`${i.ok ? '✓' : '✗'} ${i.nome}: ${i.detalhe}${i.ok ? '' : `\n    corrigir: ${i.correcao}`}`);
console.log('Detalhe em .odin-ambiente/relatorio.json');
