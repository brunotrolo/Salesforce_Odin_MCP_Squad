#!/usr/bin/env node
// Teste de fumaça pós-deploy (modelo). Uso: node smoke.mjs --base <url> --servico <odin-mcp|odin-sts|odin-portal>
// Requer ODIN_TOKEN_TESTE (token de acesso da conta de teste, perfil dev, projeto sintético) para o MCP.
const a = process.argv.slice(2);
const arg = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = arg('--base', '').replace(/\/$/, '');
const servico = arg('--servico', 'odin-mcp');
const token = process.env.ODIN_TOKEN_TESTE || '';
const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };

async function rpc(metodo, params, id) {
  const r = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: metodo, params }),
  });
  const texto = await r.text();
  const linha = texto.split('\n').find((l) => l.startsWith('data:'));
  return { status: r.status, corpo: JSON.parse(linha ? linha.slice(5) : texto || '{}') };
}

async function main() {
  if (!base) throw new Error('informe --base');
  const h = await fetch(`${base}/healthz`).catch(() => ({ status: 0 }));
  ok(h.status === 200, `${servico}: /healthz responde 200`);

  if (servico === 'odin-sts') {
    const j = await fetch(`${base}/.well-known/jwks.json`).then((r) => r.json()).catch(() => ({}));
    ok(Array.isArray(j.keys) && j.keys.length >= 1 && j.keys.every((k) => k.kty === 'EC' && k.crv === 'P-256'), 'STS: JWKS com chaves P-256');
  }
  if (servico === 'odin-portal') {
    const r = await fetch(`${base}/entrar`);
    ok(r.status === 200, 'portal: /entrar responde 200');
    ok(/max-age/.test(r.headers.get('strict-transport-security') || ''), 'portal: HSTS presente');
    ok(!!r.headers.get('content-security-policy'), 'portal: CSP presente');
  }
  if (servico === 'odin-mcp') {
    const semToken = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    ok(semToken.status === 401, 'MCP: sem token → 401');
    const ini = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'odin-smoke', version: '1' } }, 1);
    ok(ini.status === 200 && ini.corpo.result, 'MCP: initialize');
    const lista = await rpc('tools/list', {}, 2);
    const nomes = (lista.corpo.result?.tools || []).map((t) => t.name);
    ok(nomes.length > 0 && nomes.length <= 7, `MCP: tools/list com 1 a 7 ferramentas (${nomes.length})`);
    ok(nomes.includes('odin_rotear'), 'MCP: odin_rotear disponível');
    const rot = await rpc('tools/call', { name: 'odin_rotear', arguments: { pedido: 'testar a capacidade de exemplo na sandbox' } }, 3);
    ok(rot.status === 200 && !rot.corpo.error, 'MCP: odin_rotear responde para a conta de teste');
  }
  if (falhas.length) { console.error(`\n${falhas.length} falha(s) na fumaça.`); process.exit(1); }
  console.log('\nFumaça verde.');
}
main().catch((e) => { console.error(`Erro na fumaça: ${e.message}`); process.exit(1); });
