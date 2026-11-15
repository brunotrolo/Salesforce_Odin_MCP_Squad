// Ativação do dispositivo (RFC 8628) e token de acesso. A credencial só renova com a prova de posse da chave do dispositivo.
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmdirSync, statSync } from 'node:fs';
import { hostname, platform } from 'node:os';
import { join } from 'node:path';
import { AssinadorLocal } from '../../shared/src/chaves.ts';
import { assinarJwt } from '../../shared/src/jwt.ts';
import { caminhos, gravarConfig, lerConfig, VERSAO_CLI, type Config } from './ambiente.ts';
import { CofreArquivo, type Cofre } from './cofre.ts';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const so = () => (platform() === 'win32' ? 'windows' : platform() === 'darwin' ? 'macos' : 'linux');

async function post(url: string, corpo: Record<string, unknown>): Promise<{ status: number; json: Record<string, any> }> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as Record<string, any> };
}
async function prova(cofre: Cofre, cfg: Config, sujeito: string): Promise<string> {
  const pem = cofre.ler('chave-dispositivo'); if (!pem) throw new Error('Chave do dispositivo ausente. Rode: odin setup');
  const t = Math.floor(Date.now() / 1000);
  return assinarJwt(new AssinadorLocal('dispositivo', pem), { iss: 'odin-cli', sub: sujeito, aud: cfg.emissor, iat: t, exp: t + 60, jti: randomBytes(12).toString('hex') }, 'JWT');
}

export async function ativar(cfg: Config, mostrar: (linha: string) => void, cofre: Cofre = new CofreArquivo(), esperaMaxMs = 600_000): Promise<string> {
  const { assinador, pem } = AssinadorLocal.gerar('dispositivo');
  cofre.gravar('chave-dispositivo', pem);
  const da = await post(`${cfg.sts}/oauth/device_authorization`, { client_id: 'odin-cli', chave_publica_jwk: assinador.publica().jwk, nome: hostname().slice(0, 40), so: so() });
  if (da.status !== 200) throw new Error(`Não foi possível iniciar a ativação: ${da.json.mensagem ?? da.status}`);
  mostrar(`Abra no navegador: ${da.json.verification_uri_complete}`);
  mostrar(`Confira o código:  ${da.json.user_code}  (vale 10 minutos)`);
  const fim = Date.now() + esperaMaxMs;
  while (Date.now() < fim) {
    await dormir((da.json.interval ?? 2) * 1000);
    const r = await post(`${cfg.sts}/oauth/token`, { grant_type: DEVICE_GRANT, device_code: da.json.device_code, client_assertion: await prova(cofre, cfg, 'pendente') });
    if (r.status === 200) { guardarTokens(cofre, r.json); gravarConfig({ ...cfg, deviceId: r.json.device_id }); return r.json.device_id as string; }
    if (r.json.error !== 'authorization_pending') throw new Error(`Ativação recusada (${r.json.error ?? r.json.mensagem ?? r.status}). Rode "odin setup" de novo.`);
  }
  throw new Error('O código de ativação venceu. Rode "odin setup" de novo.');
}

function guardarTokens(cofre: Cofre, j: Record<string, any>): void {
  cofre.gravar('refresh', j.refresh_token); cofre.gravar('acesso', JSON.stringify({ token: j.access_token, exp: Math.floor(Date.now() / 1000) + Number(j.expires_in) }));
}

/** Trava entre processos: dois `odin token` ao mesmo tempo não podem renovar com a mesma credencial (o reuso revogaria a família). */
async function comTrava<T>(fn: () => Promise<T>): Promise<T> {
  const trava = join(caminhos().cache, 'renovando.lock'); mkdirSync(caminhos().cache, { recursive: true });
  for (let i = 0; i < 100; i++) {
    try { mkdirSync(trava); break; } catch { try { if (Date.now() - statSync(trava).mtimeMs > 15_000) rmdirSync(trava); } catch { /* outra instância liberou */ } await dormir(100); if (i === 99) throw new Error('Outra renovação de token está travada. Tente de novo.'); }
  }
  try { return await fn(); } finally { try { rmdirSync(trava); } catch { /* já removida */ } }
}

export async function tokenDeAcesso(cofre: Cofre = new CofreArquivo()): Promise<string> {
  const valido = () => { const a = JSON.parse(cofre.ler('acesso') ?? 'null') as { token: string; exp: number } | null; return a && a.exp - Math.floor(Date.now() / 1000) > 120 ? a.token : null; };
  const t = valido(); if (t) return t;
  return comTrava(async () => {
    const depois = valido(); if (depois) return depois; // outro processo já renovou
    const cfg = lerConfig(); const refresh = cofre.ler('refresh');
    if (!refresh || !cfg.deviceId) throw new Error('Este dispositivo não está ativado. Rode: odin setup');
    const r = await post(`${cfg.sts}/oauth/token`, { grant_type: 'refresh_token', refresh_token: refresh, client_assertion: await prova(cofre, cfg, cfg.deviceId) });
    if (r.status !== 200) throw new Error('A credencial deste dispositivo não vale mais (revogada ou vencida). Rode: odin login');
    guardarTokens(cofre, r.json);
    return r.json.access_token as string;
  });
}

export async function cabecalhos(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await tokenDeAcesso()}`, 'X-Odin-Runtime': caminhos().runtime, 'X-Odin-Cli': VERSAO_CLI };
}
