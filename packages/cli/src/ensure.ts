// `odin ensure <skill>`: verifica, instala e libera o uso (plano, seção 7.2). Primeiro passo obrigatório de toda skill.
// Confere a assinatura do manifesto com a chave fixada no CLI, o hash de cada arquivo, a integridade no uso (ADR 0017)
// e a prova de vida do guard. O modelo nunca monta comando de instalação: só roda este.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { canonico, sha256hex, verificarAssinatura } from '../../shared/src/chaves.ts';
import { OFFLINE_COPY_DAYS } from '../../shared/src/limites.ts';
import { desempacotar } from '../../shared/src/pacote.ts';
import { caminhos, gravarAtomico, lerConfig, lerJsonArquivo, VERSAO_CLI } from './ambiente.ts';
import { cabecalhos } from './credenciais.ts';

export interface ResultadoEnsure { ok: boolean; skill: string; versao?: string; runtime?: string; modo?: 'online' | 'degradado'; instalado?: boolean; reparado?: boolean; mensagem?: string }
type Manifesto = Record<string, any>;
const sessaoAtual = () => (process.env.CLAUDE_SESSION_ID ?? process.env.ODIN_SESSAO ?? `ppid-${process.ppid}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

function assinaturaValida(m: Manifesto, sigB64: string): boolean {
  const chave = lerConfig().chavesDePacote.find((c) => c.kid === m.kid);
  return !!chave && verificarAssinatura(chave.jwk, Buffer.from(canonico(m)), Buffer.from(sigB64, 'base64'));
}
/** Compara os arquivos instalados com os hashes do manifesto assinado. Devolve os caminhos divergentes. */
export function divergencias(dirVersao: string, m: Manifesto): string[] {
  const ruins: string[] = [];
  for (const [caminho, hash] of Object.entries(m.arquivos as Record<string, string>)) {
    if (!caminho.startsWith('runtime/')) continue;
    const f = join(dirVersao, caminho.slice('runtime/'.length));
    if (!existsSync(f) || `sha256:${sha256hex(readFileSync(f))}` !== hash) ruins.push(caminho);
  }
  return ruins;
}
function apontarCurrent(dirSkill: string, versao: string): void {
  const atual = join(dirSkill, 'current');
  rmSync(atual, { recursive: true, force: true });
  symlinkSync(join(dirSkill, versao), atual, 'junction'); // junção no Windows (sem privilégio); link simbólico nos demais
}
function materializarAgentes(dirVersao: string, skill: string, runtimeAtual: string): void {
  const destino = join(caminhos().claude, 'agents'); mkdirSync(destino, { recursive: true });
  const origem = join(dirVersao, 'agentes'); const novos = existsSync(origem) ? readdirSync(origem) : [];
  for (const f of readdirSync(destino)) if (f.startsWith(`odin-${skill}-`) && !novos.includes(f)) rmSync(join(destino, f), { force: true });
  const caminho = runtimeAtual.replace(/\\/g, '/'); // os agentes são cópias locais: o marcador vira o caminho real do runtime
  for (const f of novos) writeFileSync(join(destino, f), readFileSync(join(origem, f), 'utf8').replaceAll('{{ODIN_RUNTIME}}', caminho));
}
async function instalar(skill: string, m: Manifesto, sig: string, h: Record<string, string>, mcp: string): Promise<void> {
  const base = new URL(mcp).origin;
  const u = await fetch(`${base}/v1/bundles/${skill}/${m.versao}/url`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ pacote: 'runtime' }) });
  if (!u.ok) throw new Error(`o servidor não liberou o pacote (${u.status})`);
  const { url } = (await u.json()) as { url: string };
  const pacote = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (sha256hex(pacote) !== m.pacotes.runtime.sha256) throw new Error('o pacote baixado não confere com o manifesto assinado');
  const arquivos = desempacotar(pacote);
  const dirSkill = join(caminhos().runtime, skill); const tmp = join(dirSkill, `.${m.versao}.${process.pid}.tmp`); const fim = join(dirSkill, m.versao);
  rmSync(tmp, { recursive: true, force: true });
  for (const [c, b] of Object.entries(arquivos)) {
    if (`sha256:${sha256hex(b)}` !== m.arquivos[`runtime/${c}`]) throw new Error(`arquivo fora do manifesto: ${c}`);
    mkdirSync(dirname(join(tmp, c)), { recursive: true }); writeFileSync(join(tmp, c), b);
  }
  writeFileSync(join(tmp, 'manifesto.json'), JSON.stringify(m)); writeFileSync(join(tmp, 'manifesto.sig'), sig);
  rmSync(fim, { recursive: true, force: true }); renameSync(tmp, fim);
}

export async function ensure(skill: string, o: { exigirGuard?: boolean } = {}): Promise<ResultadoEnsure> {
  const c = caminhos(); const dirSkill = join(c.runtime, skill);
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(skill)) return { ok: false, skill, mensagem: 'Nome de skill inválido.' };
  if (o.exigirGuard !== false) {
    const visto = lerJsonArquivo<{ ts: number }>(join(c.cache, 'guard-visto.json'));
    if (!visto || Date.now() - visto.ts > 60_000) return { ok: false, skill, mensagem: 'O odin-guard não está ativo nesta sessão. Reinicie a sessão do Claude Code e repita o pedido (ou rode `odin doctor`).' };
  }
  const estado = lerJsonArquivo<Record<string, { versao: string; contato: number }>>(join(c.cache, 'instalados.json')) ?? {};
  const fixadas = lerJsonArquivo<Record<string, string>>(join(c.cache, 'sessoes', `${sessaoAtual()}.json`)) ?? {};
  const telemetria: Array<Record<string, unknown>> = [];
  let m: Manifesto, sig: string, proibidas: string[] = [], h: Record<string, string>, modo: 'online' | 'degradado' = 'online';
  const cfg = lerConfig();
  try {
    h = await cabecalhos();
    const r = await fetch(`${new URL(cfg.mcp).origin}/v1/manifest/${skill}`, { headers: { ...h, 'x-odin-sessao': sessaoAtual() } });
    if (r.status === 401 || r.status === 403 || r.status === 404) { const j = (await r.json().catch(() => ({}))) as { mensagem?: string }; if (r.status !== 404) { rmSync(dirSkill, { recursive: true, force: true }); } return { ok: false, skill, mensagem: j.mensagem ?? 'Sem acesso a esta skill.' }; }
    if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
    ({ manifesto: m, assinatura: sig, versoes_proibidas: proibidas } = (await r.json()) as { manifesto: Manifesto; assinatura: string; versoes_proibidas: string[] });
  } catch (e) {
    // Modo degradado (decisão 14): cópia local assinada, por até 7 dias desde o último contato.
    const inst = estado[skill]; const dir = inst ? join(dirSkill, inst.versao) : '';
    if (!inst || Date.now() - inst.contato > OFFLINE_COPY_DAYS * 86_400_000 || !existsSync(join(dir, 'manifesto.json'))) return { ok: false, skill, mensagem: `Não consegui falar com o Odin (${(e as Error).message}) e não há cópia local válida desta skill.` };
    m = JSON.parse(readFileSync(join(dir, 'manifesto.json'), 'utf8')); sig = readFileSync(join(dir, 'manifesto.sig'), 'utf8'); h = {}; modo = 'degradado';
  }
  if (!assinaturaValida(m, sig)) { telemetria.push({ tipo: 'assinatura_invalida', skill }); return { ok: false, skill, mensagem: 'A assinatura do pacote não confere com a chave do Odin. Nada foi instalado. Avise o mantenedor.' }; }
  if (m.skill !== skill) return { ok: false, skill, mensagem: 'O manifesto recebido é de outra skill.' };

  // Versão fixa por sessão (decisão 15); versão proibida bloqueia sempre.
  let versao: string = m.versao;
  const fixa = fixadas[skill];
  if (fixa && fixa !== versao && !proibidas.includes(fixa) && existsSync(join(dirSkill, fixa, 'manifesto.json'))) { m = JSON.parse(readFileSync(join(dirSkill, fixa, 'manifesto.json'), 'utf8')); sig = readFileSync(join(dirSkill, fixa, 'manifesto.sig'), 'utf8'); versao = fixa; if (!assinaturaValida(m, sig)) return { ok: false, skill, mensagem: 'A cópia local desta sessão está corrompida. Reinicie a sessão.' }; }
  if (proibidas.includes(versao)) { rmSync(join(dirSkill, versao), { recursive: true, force: true }); return { ok: false, skill, mensagem: `A versão ${versao} desta skill foi retirada de circulação. Reinicie a sessão para receber a versão atual.` }; }

  const dirVersao = join(dirSkill, versao); let instalado = false, reparado = false;
  const precisaInstalar = !existsSync(join(dirVersao, 'manifesto.json'));
  const primeiraNaSessao = !fixa;
  if (!precisaInstalar && primeiraNaSessao && divergencias(dirVersao, m).length) { reparado = true; telemetria.push({ tipo: 'runtime_divergente', skill, versao }); } // integridade no uso (DT-19)
  if (precisaInstalar || reparado) {
    if (modo === 'degradado') return { ok: false, skill, mensagem: 'A cópia local desta skill está incompleta ou foi alterada, e o Odin está fora do ar para reinstalar.' };
    try { await instalar(skill, m, sig, h!, cfg.mcp); instalado = true; } catch (e) { telemetria.push({ tipo: 'ensure_falha', skill, versao }); await enviar(telemetria, h!, cfg.mcp); return { ok: false, skill, mensagem: `Falha ao instalar a skill: ${(e as Error).message}.` }; }
  }
  apontarCurrent(dirSkill, versao);
  materializarAgentes(dirVersao, skill, join(dirSkill, 'current'));
  gravarAtomico(join(c.cache, 'sessoes', `${sessaoAtual()}.json`), JSON.stringify({ ...fixadas, [skill]: versao }));
  if (modo === 'online') { gravarAtomico(join(c.cache, 'instalados.json'), JSON.stringify({ ...estado, [skill]: { versao, contato: Date.now() } })); telemetria.push({ tipo: 'ensure_ok', skill, versao }); await enviar(telemetria, h!, cfg.mcp); }
  return { ok: true, skill, versao, runtime: join(dirSkill, 'current'), modo, ...(instalado ? { instalado } : {}), ...(reparado ? { reparado } : {}) };
}

async function enviar(eventos: Array<Record<string, unknown>>, h: Record<string, string>, mcp: string): Promise<void> {
  if (!eventos.length) return;
  const so = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
  try { await fetch(`${new URL(mcp).origin}/v1/telemetry`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ eventos: eventos.map((e) => ({ ...e, ts: new Date().toISOString(), cli: VERSAO_CLI, so })) }) }); } catch { /* telemetria nunca bloqueia a skill */ }
}
