import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { MemoryStore } from '../packages/shared/src/store.ts';
import { criarPortal } from '../apps/portal/src/portal.ts';

const SEGREDO = 'segredo-de-administracao-de-teste';
async function subir() {
  const store = new MemoryStore(); const { coletor, eventos } = coletorMemoria();
  await store.set('profiles', 'dev', { skills: ['sf-test', 'odin-ambiente'], colecoes: {}, canais: ['stable'] });
  await store.set('profiles', 'mantenedor', { skills: ['sf-test'], colecoes: {}, canais: ['stable', 'beta'] });
  await store.set('squads', 'squad-a', { nome: 'Squad A', projetos: [] });
  await store.set('catalog_skills', 'sf-test', { id: 'sf-test', nome: 'Test Automator', etapa: 5, canais: { beta: '0.1.0-rascunho' } });
  const ativados: string[] = [];
  const portal = criarPortal({ store, coletor, pimenta: 'pimenta-de-teste', adminSegredo: SEGREDO, emissor: 'https://odin.exemplo', aprovarDispositivo: async (code, userId) => { ativados.push(`${code}:${userId}`); return { nome: 'Notebook' }; } });
  const srv: Server = createServer((req, res) => { void portal.handler(req, res).then((ok) => { if (!ok) { res.writeHead(404); res.end(); } }); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { store, base, srv, ativados, eventos };
}
const jar = () => { let c = ''; return { get: () => c, async req(url: string, init: RequestInit = {}) { const r = await fetch(url, { ...init, redirect: 'manual', headers: { ...(init.headers as object), ...(c ? { cookie: c } : {}) } }); const sc = r.headers.get('set-cookie'); if (sc) c = sc.split(';')[0]!.endsWith('=') ? '' : sc.split(';')[0]!; return r; } }; };
const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
const csrfDe = (html: string) => /name="csrf" value="([^"]+)"/.exec(html)![1]!;

test('portal: administração exige o segredo, sessão com CSRF, criação de pessoa e convite de uso único', async () => {
  const { base, srv, store, eventos } = await subir(); const adm = jar();
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.match(await (await adm.req(`${base}/admin`)).text(), /Segredo de administração/);
  assert.equal((await adm.req(`${base}/admin/entrar`, form({ segredo: 'errado' }))).status, 403);
  assert.equal((await adm.req(`${base}/admin/pessoas`)).status, 200); // sem sessão: mostra o login, não os dados
  assert.doesNotMatch(await (await adm.req(`${base}/admin/pessoas`)).text(), /Nova pessoa/);
  assert.equal((await adm.req(`${base}/admin/entrar`, form({ segredo: SEGREDO }))).status, 303);
  const painel = await (await adm.req(`${base}/admin`)).text(); const csrf = csrfDe(painel); assert.match(painel, /Pessoas ativas/);
  assert.equal((await adm.req(`${base}/admin/global`, form({ csrf: 'falso' }))).status, 403); // CSRF
  assert.equal((await store.get('revocations', 'global')), null);
  const criada = await (await adm.req(`${base}/admin/pessoas/criar`, form({ csrf, nome: '<script>alert(1)</script>', login: 'fulana', squad: 'squad-a', perfil: 'dev' }))).text();
  assert.doesNotMatch(criada, /<script>alert/); assert.match(criada, /&lt;script&gt;/);
  const link = /https:\/\/odin\.exemplo(\/convite\?t=[A-Za-z0-9_-]+)/.exec(criada)![1]!;
  const pessoa = jar(); assert.match(await (await pessoa.req(`${base}${link}`)).text(), /Confirme para entrar/);
  const t = new URL(`${base}${link}`).searchParams.get('t')!;
  assert.equal((await pessoa.req(`${base}/convite`, form({ t }))).status, 303);
  assert.equal((await jar().req(`${base}/convite`, form({ t }))).status, 400); // uso único
  assert.equal((await jar().req(`${base}/convite?t=invalido`)).status, 400);
  assert.ok(eventos.some((e) => e.acao === 'portal.admin_login' && e.resultado === 'negado'));
  assert.ok(eventos.some((e) => e.acao === 'admin.pessoa.criar' && e.resultado === 'ok'));
  assert.doesNotMatch(JSON.stringify(eventos), new RegExp(SEGREDO)); srv.close();
});

test('portal: a pessoa vê só o que é dela, ativa dispositivo, revoga o próprio e não entra na administração', async () => {
  const { base, srv, store, ativados } = await subir(); const adm = jar(); await adm.req(`${base}/admin/entrar`, form({ segredo: SEGREDO }));
  const csrfA = csrfDe(await (await adm.req(`${base}/admin`)).text());
  const criada = await (await adm.req(`${base}/admin/pessoas/criar`, form({ csrf: csrfA, nome: 'Fulana', login: '', squad: 'squad-a', perfil: 'dev' }))).text();
  const t = new URL(`${base}${/(\/convite\?t=[A-Za-z0-9_-]+)/.exec(criada)![1]}`).searchParams.get('t')!;
  const eu = jar(); await eu.req(`${base}/convite`, form({ t }));
  const conta = await (await eu.req(`${base}/conta`)).text(); const csrf = csrfDe(conta);
  assert.match(conta, /Olá, Fulana/); assert.match(conta, /sf-test/); assert.match(conta, /Nenhum dispositivo ainda/);
  assert.doesNotMatch(await (await eu.req(`${base}/admin/pessoas`)).text(), /Nova pessoa/); // pessoa não é admin
  const userId = (await store.list('users', (u) => u.nome === 'Fulana'))[0]!.id;
  await eu.req(`${base}/conta/ativar`, form({ csrf, code: 'ABCD-EFGH' })); assert.deepEqual(ativados, [`ABCD-EFGH:${userId}`]);
  await store.set('devices', 'dev_meu', { userId, nome: 'Meu note', so: 'win32', status: 'ativo', ultimoUso: Date.now() });
  await store.set('devices', 'dev_alheio', { userId: 'usr_outro', nome: 'Alheio', so: 'linux', status: 'ativo', ultimoUso: Date.now() });
  assert.equal((await eu.req(`${base}/conta/dispositivos/revogar`, form({ csrf, id: 'dev_alheio' }))).status, 403);
  assert.equal((await store.get('devices', 'dev_alheio'))!.status, 'ativo');
  assert.equal((await eu.req(`${base}/conta/dispositivos/revogar`, form({ csrf, id: 'dev_meu' }))).status, 303);
  assert.equal((await store.get('devices', 'dev_meu'))!.status, 'revogado');
  // administrador suspende: a conta deixa de abrir
  await adm.req(`${base}/admin/pessoas/acao`, form({ csrf: csrfA, id: userId, acao: 'suspender' }));
  assert.equal((await eu.req(`${base}/conta`)).status, 403); srv.close();
});

test('portal: cookie adulterado é recusado; revogação global e propostas funcionam', async () => {
  const { base, srv, store } = await subir(); const adm = jar(); await adm.req(`${base}/admin/entrar`, form({ segredo: SEGREDO }));
  const cookie = adm.get(); const falso = `${cookie.slice(0, -3)}AAA`;
  const r = await fetch(`${base}/admin`, { headers: { cookie: falso } }); assert.match(await r.text(), /Segredo de administração/);
  const csrf = csrfDe(await (await adm.req(`${base}/admin`)).text());
  await store.set('proposals', 'prop_1', { texto: 'Padrão de teste do portal.', colecao: 'tecnico', projeto: 'global', fonte: 'x', tipo: 'padrao', status: 'na_fila', criadaEm: Date.now(), userId: 'u' });
  assert.match(await (await adm.req(`${base}/admin/propostas`)).text(), /Padrão de teste do portal/);
  await adm.req(`${base}/admin/propostas/decidir`, form({ csrf, id: 'prop_1', decisao: 'aprovar' }));
  assert.equal((await store.get('proposals', 'prop_1'))!.status, 'aprovada'); assert.equal((await store.list('kb_chunks')).length, 1);
  assert.match(await (await adm.req(`${base}/admin/skills`)).text(), /0\.1\.0-rascunho/);
  await adm.req(`${base}/admin/global`, form({ csrf })); assert.ok(Number((await store.get('revocations', 'global'))!.desde) > 0);
  const hdr = (await fetch(`${base}/`)).headers; assert.match(hdr.get('content-security-policy')!, /default-src 'none'/); srv.close();
});

test('portal: tentativas erradas de segredo são limitadas por IP e o segredo certo também é bloqueado depois do limite', async () => {
  const { base, srv } = await subir(); let limitado = false;
  for (let i = 0; i < 12; i++) { const r = await fetch(`${base}/admin/entrar`, { ...form({ segredo: `errado-${i}` }), redirect: 'manual' }); if (r.status === 429) { limitado = true; break; } }
  assert.equal(limitado, true, 'deveria limitar as tentativas');
  assert.equal((await fetch(`${base}/admin/entrar`, { ...form({ segredo: SEGREDO }), redirect: 'manual' })).status, 429); srv.close();
});
