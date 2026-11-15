// Políticas globais do odin-guard, PG-01 a PG-08 (segurança 06, seção 3), com equivalentes para PowerShell e cmd.
// Função pura: recebe o evento do hook PreToolUse e o ambiente, devolve a decisão. Sem E/S, para ser testável.
import { isAbsolute, posix, win32 } from 'node:path';

export interface Evento { tool_name: string; tool_input: Record<string, unknown>; cwd?: string; session_id?: string }
export interface Ambiente { home: string; odinHome: string; claudeHome: string; cwd: string; orgs: Record<string, string>; windows?: boolean }
export interface Decisao { decisao: 'permitir' | 'negar' | 'alertar'; politica?: string; motivo?: string }

const negar = (politica: string, motivo: string): Decisao => ({ decisao: 'negar', politica, motivo: `${motivo} (política ${politica} do Odin; se for um engano, rode \`odin doctor\`)` });
export const MARCA_INICIO = 'odin:inicio'; export const MARCA_FIM = 'odin:fim';

const SEGREDO = /(^|[\\/])(\.env[^\\/\s]*|[^\\/\s]*\.(pem|key|p12|pfx|jks)|id_(rsa|ed25519|ecdsa)[^\\/\s]*|\.netrc|\.npmrc|\.pypirc|credentials(\.json)?|\.claude\.json)$/i;
const PASTA_SEGREDO = /(^|[\\/])(\.aws|\.ssh|\.gnupg|\.sfdx|\.sf|\.config[\\/]gcloud|\.azure|\.kube)([\\/]|$)/i;
const DESTINOS = /(^|\.)(github\.com|githubusercontent\.com|npmjs\.org|salesforce\.com|force\.com|run\.app|googleapis\.com|localhost|127\.0\.0\.1)$/i;

function expandir(p: string, a: Ambiente): string {
  let x = p.replace(/^["']|["']$/g, '');
  x = x.replace(/^~(?=$|[\\/])/, a.home).replace(/\$\{?HOME\}?|\$env:USERPROFILE|%USERPROFILE%|\$env:HOME/gi, a.home);
  const m = a.windows || /^[A-Za-z]:[\\/]/.test(x) || /^[A-Za-z]:[\\/]/.test(a.cwd) ? win32 : posix;
  return m.normalize(m.isAbsolute(x) || isAbsolute(x) ? x : m.join(a.cwd, x));
}
const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const dentro = (filho: string, pai: string) => { const f = norm(filho), p = norm(pai); return f === p || f.startsWith(`${p}/`); };

function caminhoDoOdin(abs: string, a: Ambiente): boolean {
  if (dentro(abs, a.odinHome)) return true;
  const rel = norm(abs).slice(norm(a.claudeHome).length + 1);
  return dentro(abs, a.claudeHome) && (/^agents\/odin-/.test(rel) || /^skills\/odin(\/|$)/.test(rel));
}
const arquivoComBloco = (abs: string, a: Ambiente) => [`${a.claudeHome}/settings.json`, `${a.claudeHome}/CLAUDE.md`].some((f) => norm(f) === norm(abs));
const ehSegredo = (abs: string, a: Ambiente) => SEGREDO.test(abs) || PASTA_SEGREDO.test(abs) || norm(abs) === norm(`${a.home}/.claude.json`);

/** Divide uma linha de comando em comandos simples (&&, ||, ;, |, quebra de linha). */
export const segmentos = (cmd: string): string[] => cmd.split(/&&|\|\||[;\n|]/).map((s) => s.trim()).filter(Boolean);
const palavras = (s: string): string[] => s.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];

function avaliarComando(cmd: string, a: Ambiente): Decisao {
  for (const seg of segmentos(cmd)) {
    const w = palavras(seg); const bin = (w[0] ?? '').replace(/^.*[\\/]/, '').replace(/\.(exe|cmd)$/i, '').toLowerCase();
    const args = w.slice(1); const caminhos = args.filter((x) => !/^[-/][A-Za-z?]/.test(x) || /[\\/].*[\\/]/.test(x)).map((x) => expandir(x, a));
    // PG-08 Elevação
    if (/^(sudo|doas|runas|su)$/.test(bin) || /-Verb\s+RunAs/i.test(seg)) return negar('PG-08', 'Comando com elevação de privilégio');
    if (/^(chmod|chown|icacls|takeown)$/.test(bin) && caminhos.some((p) => /^(\/(etc|usr|bin|sbin|system|library)\b|[a-z]:\/(windows|program files))/i.test(norm(p)))) return negar('PG-08', 'Alteração de permissão em pasta do sistema');
    // PG-01 Segredos (o sf CLI pode usar a própria pasta)
    if (bin !== 'sf' && bin !== 'sfdx' && bin !== 'odin' && args.some((x) => ehSegredo(expandir(x, a), a))) return negar('PG-01', 'Leitura ou uso direto de arquivo de segredo ou credencial');
    // PG-02 Odin
    if (bin !== 'odin' && args.some((x) => caminhoDoOdin(expandir(x, a), a)) && /^(rm|mv|cp|sed|tee|echo|printf|cat|del|rd|rmdir|remove-item|move-item|copy-item|set-content|add-content|out-file|ren|rename-item|touch|truncate|chmod|icacls|ln|mklink|new-item)$/.test(bin)) return negar('PG-02', 'Alteração das pastas do Odin');
    if (/>>?\s*\S/.test(seg) && palavras(seg.replace(/.*>>?\s*/, '')).slice(0, 1).some((x) => { const p = expandir(x, a); return caminhoDoOdin(p, a) || arquivoComBloco(p, a); })) return negar('PG-02', 'Escrita nas pastas ou nos arquivos do Odin');
    // PG-03 Destruição
    const recursivo = (bin === 'rm' && /(^|\s)-[a-z]*r[a-z]*\b|--recursive/i.test(seg)) || (bin === 'remove-item' && /-Recurse/i.test(seg)) || (/^(rd|rmdir)$/.test(bin) && /\/s\b/i.test(seg)) || (bin === 'del' && /\/s\b/i.test(seg));
    if (recursivo && caminhos.some((p) => !dentro(p, a.cwd) || norm(p) === norm(a.cwd) && dentro(a.home, a.cwd))) return negar('PG-03', 'Remoção recursiva fora da pasta do projeto');
    if (bin === 'git' && args[0] === 'clean' && /-[a-z]*f/i.test(seg) && dentro(a.home, a.cwd)) return negar('PG-03', 'git clean na pasta pessoal');
    if (/^(mkfs(\.\w+)?|diskpart|format-volume|clear-disk|fdisk)$/.test(bin) || (bin === 'format' && /^[a-z]:$/i.test(args[0] ?? '')) || (bin === 'dd' && /\bof=\/dev\//.test(seg))) return negar('PG-03', 'Formatação ou escrita direta em disco');
    // PG-04 Histórico
    if (bin === 'git' && args[0] === 'push') {
      const alvoPrincipal = /\b(main|master)\b/.test(seg);
      if (alvoPrincipal && /(^|\s)(-f|--force|--force-with-lease)(\s|=|$)|\s\+\S*(main|master)/.test(seg)) return negar('PG-04', 'Reescrita do histórico remoto da branch principal');
      if (/--delete\s+\S*\b(main|master)\b|\s:(main|master)\b/.test(seg)) return negar('PG-04', 'Remoção da branch principal remota');
    }
    // PG-05 Produção Salesforce
    if ((bin === 'sf' || bin === 'sfdx') && (/^project\s+deploy\b/.test(args.join(' ')) || /^data\s+(create|update|delete|upsert|import|bulk)\b/.test(args.join(' ')) || /^apex\s+run\b/.test(args.join(' ')))) {
      const i = args.findIndex((x) => x === '-o' || x === '--target-org'); const igual = args.find((x) => x.startsWith('--target-org='));
      const alias = igual ? igual.split('=')[1]! : i >= 0 ? (args[i + 1] ?? '') : '(padrão)';
      const tipo = a.orgs[alias.replace(/^["']|["']$/g, '')];
      if (tipo !== 'sandbox' && tipo !== 'scratch') return negar('PG-05', tipo === 'producao' ? `A org "${alias}" é de produção` : `Não sei se a org "${alias}" é sandbox; rode \`odin doctor --orgs\` para classificar`);
    }
    // PG-07 Persistência
    if ((bin === 'crontab' && !/\s-l\b/.test(seg)) || (bin === 'launchctl' && /\b(load|bootstrap|enable)\b/.test(seg)) || (bin === 'schtasks' && /\/create\b/i.test(seg)) || /^(register-scheduledtask|new-service)$/.test(bin) || (bin === 'systemctl' && /\benable\b/.test(seg)) || (bin === 'sc' && /\bcreate\b/i.test(seg))) return negar('PG-07', 'Criação de tarefa agendada ou serviço');
    if (/>>?\s*\S/.test(seg) && /(\.bashrc|\.zshrc|\.profile|\.bash_profile|profile\.ps1|\$PROFILE)\b/i.test(seg.replace(/.*>>?\s*/, ''))) return negar('PG-07', 'Alteração do perfil do shell');
    // PG-06 Exfiltração (modo alerta na prova de conceito)
    const envio = (/^(curl)$/.test(bin) && /(\s-(T|F|d)\b|--data|--upload-file|--form)/.test(seg) && /@|--upload-file|-T\b/.test(seg)) || (bin === 'wget' && /--post-file/.test(seg)) || (/^(invoke-webrequest|invoke-restmethod|iwr|irm)$/.test(bin) && /-InFile/i.test(seg)) || /^(scp|rsync|ftp|sftp|nc|ncat)$/.test(bin);
    if (envio) {
      const hosts = [...seg.matchAll(/(?:https?:\/\/|@)([A-Za-z0-9.-]+\.[A-Za-z]{2,}|localhost|127\.0\.0\.1)/g)].map((m) => m[1]!);
      if (!hosts.length || hosts.some((h) => !DESTINOS.test(h))) return { decisao: 'alertar', politica: 'PG-06', motivo: 'Envio de arquivo para destino fora da lista permitida' };
    }
  }
  return { decisao: 'permitir' };
}

export function avaliar(e: Evento, a: Ambiente): Decisao {
  const t = e.tool_name; const i = e.tool_input ?? {};
  if (t === 'Bash' || t === 'PowerShell') return avaliarComando(String(i.command ?? ''), a);
  const alvo = typeof i.file_path === 'string' ? i.file_path : typeof i.notebook_path === 'string' ? i.notebook_path : typeof i.path === 'string' ? i.path : null;
  if (!alvo) return { decisao: 'permitir' };
  const abs = expandir(alvo, a);
  if (t === 'Read' || t === 'Grep' || t === 'Glob') return ehSegredo(abs, a) ? negar('PG-01', 'Leitura de arquivo de segredo ou credencial') : { decisao: 'permitir' };
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(t)) {
    if (ehSegredo(abs, a)) return negar('PG-01', 'Escrita em arquivo de segredo ou credencial');
    if (caminhoDoOdin(abs, a)) return negar('PG-02', 'Alteração das pastas do Odin');
    if (arquivoComBloco(abs, a)) {
      const texto = [i.old_string, i.new_string, i.content, JSON.stringify(i.edits ?? '')].map((x) => String(x ?? '')).join('\n');
      if (t === 'Write' || texto.includes(MARCA_INICIO) || texto.includes(MARCA_FIM) || /odin[- ]guard|ODIN\.md/.test(texto)) return negar('PG-02', 'Alteração do bloco do Odin neste arquivo (o resto do arquivo é seu: use uma edição que não toque o bloco)');
    }
    if (/(\.bashrc|\.zshrc|\.profile|\.bash_profile|profile\.ps1)$/i.test(abs)) return negar('PG-07', 'Alteração do perfil do shell');
  }
  return { decisao: 'permitir' };
}
