import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { MemoryStore } from '../packages/shared/src/store.ts';
import { criarPortal } from '../apps/portal/src/portal.ts';

const ouvir = (srv: ReturnType<typeof createServer>) => new Promise<string>((r) => srv.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`)));
const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });

test('portal: painel e página do MCP mostram estado ao vivo, ferramentas, catálogo e conhecimento; MCP fora do ar aparece como erro', async () => {
  const mcp = createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(q.url?.includes('/v1/cli') ? JSON.stringify({ manifesto: { versao: '9.8.7' } }) : '{"ok":true}'); }); const mcpUrl = await ouvir(mcp);
  const store = new MemoryStore(); const { coletor } = coletorMemoria();
  await store.set('catalog_skills', 'sf-x', { id: 'sf-x', nome: 'Skill X', etapa: 1, descricao: 'Faz X <b>', canais: { stable: '1.0.3' }, perfis: ['dev'] });
  await store.set('kb_chunks', 'a', { colecao: 'tecnico', projeto: 'global', documento: 'D1', secao: 's', texto: 't', vetor: [1] }); await store.set('kb_chunks', 'b', { colecao: 'tecnico', projeto: 'global', documento: 'D2', secao: 's', texto: 't' });
  const portal = criarPortal({ store, coletor, pimenta: 'p', adminSegredo: 'seg', emissor: 'https://odin.exemplo', mcpUrl, aprovarDispositivo: async () => ({ nome: 'x' }) });
  const srv = createServer((q, r) => { void portal.handler(q, r).then((ok) => { if (!ok) { r.writeHead(404); r.end(); } }); }); const base = await ouvir(srv);
  const login = await fetch(`${base}/admin/entrar`, { ...form({ segredo: 'seg' }), redirect: 'manual' }); const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  const ver = async (p: string) => (await fetch(`${base}${p}`, { headers: { cookie } })).text();
  const painel = await ver('/admin'); assert.match(painel, /no ar/); assert.match(painel, /9\.8\.7/); assert.match(painel, /Skills em stable/i); assert.match(painel, /7 ferramentas/);
  const m = await ver('/admin/mcp'); assert.match(m, /odin_rotear/); assert.match(m, /odin_conhecimento_buscar/); assert.match(m, /tecnico/); assert.match(m, /50%/); assert.match(m, /No ar/);
  const s = await ver('/admin/skills'); assert.match(s, /Skill X/); assert.match(s, /stable 1\.0\.3/); assert.ok(!s.includes('Faz X <b>'), 'descrição sem escape'); assert.match(s, /&lt;b&gt;/);
  mcp.close(); // MCP fora do ar: o painel continua abrindo e mostra o erro
  const fora = await ver('/admin'); assert.match(fora, /sem resposta/); srv.close();
});
test('portal: sem endereço do MCP o painel avisa em vez de quebrar', async () => {
  const store = new MemoryStore(); const { coletor } = coletorMemoria(); const portal = criarPortal({ store, coletor, pimenta: 'p', adminSegredo: 'seg', emissor: 'https://odin.exemplo', aprovarDispositivo: async () => ({ nome: 'x' }) });
  const srv = createServer((q, r) => { void portal.handler(q, r).then((ok) => { if (!ok) { r.writeHead(404); r.end(); } }); }); const base = await ouvir(srv);
  const c = (await fetch(`${base}/admin/entrar`, { ...form({ segredo: 'seg' }), redirect: 'manual' })).headers.get('set-cookie')!.split(';')[0]!;
  const html = await (await fetch(`${base}/admin/mcp`, { headers: { cookie: c } })).text(); assert.match(html, /não configurado/); assert.equal((await fetch(`${base}/`)).status, 200); srv.close();
});
