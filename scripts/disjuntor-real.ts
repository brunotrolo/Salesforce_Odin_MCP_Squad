#!/usr/bin/env node
// Teste real do disjuntor de custo (RB-13): envia um aviso de orçamento a 316%, confirma que o acesso externo do STS e do MCP fecha,
// e reabre em seguida. Sempre reabre (bloco finally). Só roda por workflow manual com confirmação explícita.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
const PROJETO = env('PROJETO'), REGIAO = env('REGIAO'), STS = env('URL_STS'), MCP = env('URL_MCP'), DISJ = env('URL_DISJUNTOR');
const SERVICOS: Record<string, string> = { 'odin-sts': STS, 'odin-mcp': MCP };
const L: string[] = ['# Teste real do disjuntor de custo', '', `Gerado em ${new Date().toISOString()} contra \`${PROJETO}\` (${REGIAO}).`, ''];
let falhou = false; const ok = (c: boolean, m: string) => { L.push(`- ${c ? '✓' : '✗'} ${m}`); console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhou = true; };
const saude = async (u: string) => { try { return (await fetch(`${u}/saude`)).status; } catch { return 0; } };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ate(cond: () => Promise<boolean>, limiteMs: number): Promise<number> { const t0 = Date.now(); while (Date.now() - t0 < limiteMs) { if (await cond()) return Math.round((Date.now() - t0) / 1000); await espera(3000); } return -1; }
async function idToken(aud: string): Promise<string> {
  const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  return (await c.request<{ token: string }>({ url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/sa-ci-infra@${PROJETO}.iam.gserviceaccount.com:generateIdToken`, method: 'POST', data: { audience: aud, includeEmail: true } })).data.token;
}
const ingress = (s: string) => execFileSync('gcloud', ['run', 'services', 'describe', s, `--region=${REGIAO}`, `--project=${PROJETO}`, '--format=value(metadata.annotations["run.googleapis.com/ingress"])'], { encoding: 'utf8' }).trim();
const reabrir = () => { for (const s of Object.keys(SERVICOS)) execFileSync('gcloud', ['run', 'services', 'update', s, `--region=${REGIAO}`, `--project=${PROJETO}`, '--ingress=all', '--quiet'], { stdio: 'ignore' }); };

try {
  L.push('## Antes');
  for (const [s, u] of Object.entries(SERVICOS)) ok((await saude(u)) === 200 && ingress(s) === 'all', `${s} aberto (ingress=all, /saude 200)`);
  L.push('', '## Aviso real de 316% do orçamento (sem simulação)');
  const r = await fetch(DISJ, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${await idToken(DISJ)}` }, body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ costAmount: 95, budgetAmount: 30 })).toString('base64') } }) });
  const corpo = (await r.json().catch(() => ({}))) as { fechou?: boolean; servicos?: string[] }; ok(r.status === 200 && corpo.fechou === true, `o disjuntor respondeu ${r.status} e fechou=${corpo.fechou}`);
  for (const [s, u] of Object.entries(SERVICOS)) { const seg = await ate(async () => (await saude(u)) !== 200, 120_000); ok(seg >= 0 && ingress(s) === 'internal', `${s} fechado para a internet em ${seg} s (ingress=${ingress(s)})`); }
  ok((await fetch(`${DISJ}/saude`)).status === 200, 'o próprio disjuntor continua de pé (protegido por identidade)');
} finally {
  L.push('', '## Reabertura');
  try { reabrir(); for (const [s, u] of Object.entries(SERVICOS)) { const seg = await ate(async () => (await saude(u)) === 200, 180_000); ok(seg >= 0 && ingress(s) === 'all', `${s} reaberto em ${seg} s (ingress=${ingress(s)})`); } }
  catch (e) { ok(false, `FALHA AO REABRIR: ${(e as Error).message}. Reabra com o workflow infra (aplicar) ou "gcloud run services update <serviço> --ingress=all".`); }
  writeFileSync(process.env.SAIDA ?? 'disjuntor-real.md', `${L.join('\n')}\n`);
}
process.exit(falhou ? 1 : 0);
