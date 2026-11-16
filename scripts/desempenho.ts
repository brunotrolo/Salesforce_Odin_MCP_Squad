#!/usr/bin/env node
// Medição de desempenho na nuvem: partida a frio (revisão nova = zero instâncias) e carga de 50 usuários simultâneos.
// Metas (plano): partida a frio p95 ≤ 3 s; 50 usuários sem erro e p95 ≤ 2 s com o máximo de 3 instâncias.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { FirestoreStore } from '../packages/shared/src/nuvem/firestore.ts';
import { AssinadorKms, versaoAtual } from '../packages/shared/src/nuvem/kms.ts';
import { assinarJwt } from '../packages/shared/src/jwt.ts';

const env = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`falta ${n}`); return v; };
const PROJETO = env('PROJETO'), REGIAO = env('REGIAO'), STS = env('URL_STS'), MCP = env('URL_MCP');
const p = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]!; };
const medir = async (url: string) => { const t0 = performance.now(); const r = await fetch(url); await r.text(); return { ms: performance.now() - t0, status: r.status }; };
const novaRevisao = (servico: string) => execFileSync('gcloud', ['run', 'services', 'update', servico, `--region=${REGIAO}`, `--project=${PROJETO}`, `--update-labels=medida=${Date.now()}`, '--quiet'], { stdio: 'ignore' });

const L: string[] = ['# Desempenho na nuvem', '', `Gerado em ${new Date().toISOString()} contra \`${PROJETO}\` (${REGIAO}).`, ''];
let reprovou = false; const ok = (c: boolean, m: string) => { L.push(`- ${c ? '✓' : '✗'} ${m}`); if (!c) reprovou = true; };

L.push('## Partida a frio (primeira chamada após uma revisão nova, sem instância ativa)');
const frios: number[] = [];
for (const [nome, servico, url] of [['STS', 'odin-sts', `${STS}/saude`], ['MCP', 'odin-mcp', `${MCP}/saude`]] as const) {
  const v: number[] = [];
  for (let i = 0; i < 3; i++) { novaRevisao(servico); await new Promise((r) => setTimeout(r, 5000)); const m = await medir(url); if (m.status !== 200) throw new Error(`${nome}: status ${m.status}`); v.push(m.ms); }
  frios.push(...v); L.push(`- ${nome}: ${v.map((x) => `${Math.round(x)} ms`).join(', ')}`);
}
ok(p(frios, 0.95) <= 3000, `p95 da partida a frio = ${Math.round(p(frios, 0.95))} ms (meta ≤ 3000 ms)`);

L.push('', '## Carga: 50 usuários simultâneos, 6 chamadas cada (descoberta do STS, chaves públicas, saúde do MCP)');
const alvos = [`${STS}/.well-known/oauth-authorization-server`, `${STS}/.well-known/jwks.json`, `${MCP}/saude`];
await Promise.all(alvos.map((u) => medir(u))); // aquece
const t0 = performance.now(); const tempos: number[] = []; let erros = 0;
await Promise.all(Array.from({ length: 50 }, async (_, u) => { for (let i = 0; i < 6; i++) { try { const m = await medir(alvos[(u + i) % alvos.length]!); tempos.push(m.ms); if (m.status !== 200) erros++; } catch { erros++; } } }));
const total = performance.now() - t0;
L.push(`- ${tempos.length + erros === 300 ? 300 : tempos.length + erros} chamadas em ${(total / 1000).toFixed(1)} s (${(300 / (total / 1000)).toFixed(0)} chamadas/s); p50 ${Math.round(p(tempos, 0.5))} ms, p95 ${Math.round(p(tempos, 0.95))} ms, máximo ${Math.round(Math.max(...tempos))} ms`);
ok(erros === 0, `erros: ${erros}`); ok(p(tempos, 0.95) <= 2000, `p95 sob carga = ${Math.round(p(tempos, 0.95))} ms (meta ≤ 2000 ms)`);

L.push('', '## Carga autenticada: 50 usuários, 6 chamadas cada a /v1/me (token assinado pelo KMS, direitos lidos do Firestore)');
{
  const store = new FirestoreStore(PROJETO); const key = await new AssinadorKms('jwt-kms-a', await versaoAtual(env('CHAVE_JWT'))).carregar();
  const ids = Array.from({ length: 50 }, (_, i) => ({ u: `usr_carga_${i}`, d: `dev_carga_${i}` }));
  try {
    for (const { u, d } of ids) { await store.set('users', u, { githubId: 998000, githubLogin: 'carga', nome: 'Carga', status: 'ativo', policyVersion: 1 }); await store.set('devices', d, { userId: u, status: 'ativo' }); }
    const s = Math.floor(Date.now() / 1000);
    const tokens = await Promise.all(ids.map(({ u, d }) => assinarJwt(key, { iss: STS, sub: u, client_id: 'odin-cli', gh: 998000, dev: d, fam: 'f', pv: 1, iat: s, nbf: s, exp: s + 600, jti: 'c', aud: MCP }, 'at+jwt')));
    const chamar = async (tk: string) => { const t0 = performance.now(); const r = await fetch(`${MCP}/v1/me`, { headers: { Authorization: `Bearer ${tk}` } }); await r.text(); return { ms: performance.now() - t0, status: r.status }; };
    await chamar(tokens[0]!);
    const a0 = performance.now(); const ts: number[] = []; let er = 0;
    await Promise.all(tokens.map(async (tk) => { for (let i = 0; i < 6; i++) { try { const m = await chamar(tk); ts.push(m.ms); if (m.status !== 200) er++; } catch { er++; } } }));
    const tot = performance.now() - a0;
    L.push(`- 300 chamadas em ${(tot / 1000).toFixed(1)} s (${(300 / (tot / 1000)).toFixed(0)} chamadas/s); p50 ${Math.round(p(ts, 0.5))} ms, p95 ${Math.round(p(ts, 0.95))} ms, máximo ${Math.round(Math.max(...ts))} ms`);
    ok(er === 0, `erros: ${er}`); ok(p(ts, 0.95) <= 2000, `p95 autenticado = ${Math.round(p(ts, 0.95))} ms (meta ≤ 2000 ms)`);
  } finally { for (const { u, d } of ids) { await store.delete('devices', d).catch(() => {}); await store.delete('users', u).catch(() => {}); } }
}

writeFileSync(process.env.SAIDA ?? 'desempenho.md', `${L.join('\n')}\n`); console.log(L.join('\n'));
process.exit(reprovou ? 1 : 0);
