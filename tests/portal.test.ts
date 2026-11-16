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

async function subirGithub(respostas: { token?: Record<string, unknown>; usuario?: Record<string, unknown> }) {
  const store = new MemoryStore(); const { coletor, eventos } = coletorMemoria(); const chamadas: string[] = [];
  await store.set('profiles', 'mantenedor', { skills: [], colecoes: {}, canais: ['stable', 'beta'] }); await store.set('profiles', 'dev', { skills: [], colecoes: {}, canais: ['stable'] });
  await store.set('squads', 'squad-a', { nome: 'Squad A', projetos: [] });
  await store.set('users', 'usr_mant', { githubId: 111, githubLogin: 'maint', nome: 'Maint', status: 'ativo', policyVersion: 1 }); await store.set('memberships', 'm1', { userId: 'usr_mant', squadId: 'squad-a', perfis: ['mantenedor'] });
  await store.set('users', 'usr_dev', { githubId: 0, githubLogin: 'Pessoa-Dev', nome: 'Dev', status: 'ativo', policyVersion: 1 }); await store.set('memberships', 'm2', { userId: 'usr_dev', squadId: 'squad-a', perfis: ['dev'] });
  const http = (async (url: string | URL | Request, init?: RequestInit) => { const u = String(url); chamadas.push(u); const corpo = u.includes('access_token') ? (respostas.token ?? { access_token: 'tk' }) : (respostas.usuario ?? { id: 111, login: 'maint' }); return new Response(JSON.stringify(corpo), { status: 200 }); }) as typeof fetch;
  const portal = criarPortal({ store, coletor, pimenta: 'pimenta-de-teste', adminSegredo: SEGREDO, emissor: 'https://odin.exemplo', aprovarDispositivo: async () => ({ nome: 'x' }), github: { clientId: 'Ov23teste', clientSecret: 'segredo-oauth', http } });
  const srv = createServer((req, res) => { void portal.handler(req, res).then((ok) => { if (!ok) { res.writeHead(404); res.end(); } }); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r)); return { store, srv, base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, eventos, chamadas };
}
async function entrarGithub(base: string, cookies = jar()) {
  const r = await fetch(`${base}/auth/github/login`, { redirect: 'manual' }); const loc = new URL(r.headers.get('location')!); const estadoCookie = r.headers.get('set-cookie')!.split(';')[0]!;
  const cb = await fetch(`${base}/auth/github/callback?code=abc&state=${loc.searchParams.get('state')}`, { redirect: 'manual', headers: { cookie: estadoCookie } });
  return { r, loc, cb, sessao: (cb.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('odin_sessao='))?.split(';')[0] ?? '' };
}

test('login com GitHub: redireciona com estado assinado, administrador entra no /admin e o segredo do OAuth nunca vai à tela', async () => {
  const { base, srv, eventos, chamadas } = await subirGithub({}); const { r, loc, cb, sessao } = await entrarGithub(base);
  assert.equal(r.status, 302); assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(loc.searchParams.get('client_id'), 'Ov23teste'); assert.equal(loc.searchParams.get('redirect_uri'), 'https://odin.exemplo/auth/github/callback'); assert.equal(loc.searchParams.get('scope'), 'read:user');
  assert.match(r.headers.get('set-cookie')!, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(cb.status, 200); const corpo = await cb.text(); assert.match(corpo, /url=\/admin/); assert.doesNotMatch(corpo, /segredo-oauth/); assert.ok(sessao.length > 20);
  assert.match(await (await fetch(`${base}/admin`, { headers: { cookie: sessao } })).text(), /Pessoas ativas/);
  assert.ok(eventos.some((e) => e.acao === 'portal.github_login' && e.resultado === 'ok')); assert.deepEqual(chamadas.map((c) => new URL(c).host), ['github.com', 'api.github.com']);
  assert.doesNotMatch(JSON.stringify(eventos), /segredo-oauth|tk/); srv.close();
});

test('login com GitHub: pessoa convidada pelo login entra na conta (vincula o id); desconhecido, estado falso e erro do GitHub são recusados', async () => {
  const dev = await subirGithub({ usuario: { id: 222, login: 'pessoa-dev' } }); const e1 = await entrarGithub(dev.base);
  assert.match(await e1.cb.text(), /url=\/conta/); assert.equal(Number((await dev.store.get('users', 'usr_dev'))!.githubId), 222);
  assert.equal((await fetch(`${dev.base}/admin`, { headers: { cookie: e1.sessao } })).status, 200); assert.doesNotMatch(await (await fetch(`${dev.base}/admin/pessoas`, { headers: { cookie: e1.sessao } })).text(), /Nova pessoa/); dev.srv.close();
  const desc = await subirGithub({ usuario: { id: 999, login: 'estranho' } }); const e2 = await entrarGithub(desc.base); assert.equal(e2.cb.status, 403); assert.equal(e2.sessao, ''); desc.srv.close();
  const s = await subirGithub({}); const r = await fetch(`${s.base}/auth/github/login`, { redirect: 'manual' }); const ck = r.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal((await fetch(`${s.base}/auth/github/callback?code=abc&state=falso`, { headers: { cookie: ck } })).status, 400);
  assert.equal((await fetch(`${s.base}/auth/github/callback?code=abc&state=${new URL(r.headers.get('location')!).searchParams.get('state')}`)).status, 400); // sem o cookie
  s.srv.close();
  const err = await subirGithub({ token: { error: 'bad_verification_code' } }); const e3 = await entrarGithub(err.base); assert.equal(e3.cb.status, 400); assert.equal(e3.sessao, ''); err.srv.close();
  const sem = await subir(); assert.equal((await fetch(`${sem.base}/auth/github/login`, { redirect: 'manual' })).status, 404); sem.srv.close();
});
