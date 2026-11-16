import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { MemoryStore } from '../packages/shared/src/store.ts';
import { criarPortal } from '../apps/portal/src/portal.ts';
import { codigoTotp, verificarTotp, cifrar, decifrar, cborCodificar, cborDecodificar } from '../apps/portal/src/mfa.ts';
import { AutenticadorSoft } from './apoio/autenticador.ts';

const EMISSOR = 'https://odin.exemplo'; let agoraMs = Date.UTC(2026, 10, 16, 12, 0, 0);
const base32Dec = (s: string): Buffer => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const o: number[] = []; for (const c of s) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
async function subir() {
  const store = new MemoryStore(); const { coletor, eventos } = coletorMemoria();
  await store.set('profiles', 'dev', { skills: [], colecoes: {}, canais: ['stable'] }); await store.set('squads', 'sq', { nome: 'Sq', projetos: [] });
  await store.set('users', 'usr_a', { githubId: 1, githubLogin: 'a', nome: 'A', status: 'ativo', policyVersion: 1 }); await store.set('memberships', 'm', { userId: 'usr_a', squadId: 'sq', perfis: ['dev'] });
  await store.set('invites', 'i1', { userId: 'usr_a', hash: 'x', expiraEm: 9e15, usado: false });
  const portal = criarPortal({ store, coletor, pimenta: 'pimenta-de-teste', adminSegredo: 'seg-admin', emissor: EMISSOR, exigirMfa: true, agora: () => agoraMs, aprovarDispositivo: async () => ({ nome: 'N' }) });
  const srv: Server = createServer((req, res) => { void portal.handler(req, res).then((ok) => { if (!ok) { res.writeHead(404); res.end(); } }); });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r)); return { store, srv, eventos, base: `http://127.0.0.1:${(srv.address() as AddressInfo).port}` };
}
const jar = () => { let c = ''; return { async req(url: string, init: RequestInit = {}) { const r = await fetch(url, { ...init, redirect: 'manual', headers: { ...(init.headers as object), ...(c ? { cookie: c } : {}) } }); const sc = r.headers.get('set-cookie'); if (sc) c = sc.split(';')[0]!.endsWith('=') ? '' : sc.split(';')[0]!; return r; } }; };
const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
const json = (o: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const csrfDe = (h: string) => /name="csrf" value="([^"]+)"/.exec(h)![1]!;
const tok = (b: Buffer) => codigoTotp(b, Math.floor(agoraMs / 1000 / 30));
/** Cria a sessão da pessoa a partir do convite (primeiro acesso). */
async function entrar(s: Awaited<ReturnType<typeof subir>>) {
  const { hashConviteDe } = { hashConviteDe: (t: string) => t }; void hashConviteDe;
  const { createHmac } = await import('node:crypto'); const t = 'tok-' + Math.random().toString(36).slice(2); await s.store.set('invites', 'i_' + t, { userId: 'usr_a', hash: createHmac('sha256', 'pimenta-de-teste').update(`convite:${t}`).digest('hex'), expiraEm: 9e15, usado: false });
  const j = jar(); assert.equal((await j.req(`${s.base}/convite`, form({ t }))).status, 303); return j;
}
async function cadastrarTotp(s: Awaited<ReturnType<typeof subir>>, j: ReturnType<typeof jar>) {
  let r = await j.req(`${s.base}/conta`); assert.equal(r.headers.get('location'), '/mfa'); const h0 = await (await j.req(`${s.base}/mfa`)).text(); const c = csrfDe(h0);
  const ini = await (await j.req(`${s.base}/mfa/totp/iniciar`, form({ csrf: c }))).text(); const seg = base32Dec(/<code>([A-Z2-7]{32})<\/code>/.exec(ini)![1]!);
  assert.equal((await j.req(`${s.base}/mfa/totp/confirmar`, form({ csrf: c, codigo: '000000' }))).status, 400);
  r = await j.req(`${s.base}/mfa/totp/confirmar`, form({ csrf: c, codigo: tok(seg) })); const h = await r.text(); assert.equal(r.status, 200);
  const codigos = [...h.matchAll(/<code>([a-f0-9]{5}-[a-f0-9]{5})<\/code>/g)].map((m) => m[1]!); assert.equal(codigos.length, 10); return { seg, codigos, c };
}

test('TOTP: vetor RFC 6238 (SHA-1), janela ±1 passo e recusa de repetição', () => {
  const seg = Buffer.from('12345678901234567890'); assert.equal(codigoTotp(seg, Math.floor(59 / 30)), '287082'); assert.equal(codigoTotp(seg, Math.floor(1111111109 / 30)), '081804');
  const p = verificarTotp(seg, '287082', 59, 0); assert.equal(p, 1); assert.equal(verificarTotp(seg, '287082', 59, 1), null); assert.equal(verificarTotp(seg, '287082', 59 + 30, 0), 1); assert.equal(verificarTotp(seg, '287082', 59 + 90, 0), null); assert.equal(verificarTotp(seg, '12345', 59, 0), null);
});
test('segredo cifrado: ida e volta, chave errada e adulteração falham; CBOR ida e volta', () => {
  const s = Buffer.from('segredo-totp-20bytes'); const c = cifrar('p1', s); assert.deepEqual(decifrar('p1', c), s); assert.throws(() => decifrar('p2', c)); const b = Buffer.from(c, 'base64url'); b[b.length - 1]! ^= 1; assert.throws(() => decifrar('p1', b.toString('base64url')));
  const m = new Map<number, number | Buffer>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.alloc(32, 7)]]); const d = cborDecodificar(cborCodificar(m)).v as Map<number, unknown>; assert.equal(d.get(3), -7); assert.deepEqual(d.get(-2), Buffer.alloc(32, 7));
});
test('portal: sem fator cadastrado, a conta redireciona ao cadastro; TOTP + códigos de recuperação; 15 min de validade', async () => {
  const s = await subir(); const j = await entrar(s); const { seg, codigos } = await cadastrarTotp(s, j);
  assert.equal((await j.req(`${s.base}/conta`)).status, 200); // acabou de confirmar
  const stored = await s.store.get('mfa', 'usr_a'); assert.ok(!JSON.stringify(stored).includes(seg.toString('hex')) && !JSON.stringify(stored).includes(codigos[0]!), 'segredo ou código em claro no banco');
  agoraMs += 16 * 60_000; const r = await j.req(`${s.base}/conta`); assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/mfa'); // venceu
  const c = csrfDe(await (await j.req(`${s.base}/mfa`)).text());
  assert.equal((await j.req(`${s.base}/mfa/verificar`, form({ csrf: c, tipo: 'totp', codigo: '111111' }))).status, 400);
  agoraMs += 31_000; assert.equal((await j.req(`${s.base}/mfa/verificar`, form({ csrf: c, tipo: 'totp', codigo: tok(seg) }))).status, 303); assert.equal((await j.req(`${s.base}/conta`)).status, 200);
  // repetição: outra sessão da mesma pessoa, no mesmo intervalo de 30 s, não pode reutilizar o código já gasto
  const j2 = await entrar(s); await j2.req(`${s.base}/conta`); const cc = csrfDe(await (await j2.req(`${s.base}/mfa`)).text());
  assert.equal((await j2.req(`${s.base}/mfa/verificar`, form({ csrf: cc, tipo: 'totp', codigo: tok(seg) }))).status, 400, 'código TOTP repetido aceito'); s.srv.close();
});
test('recuperação: código vale uma vez; novos códigos invalidam os antigos; admin zera o fator', async () => {
  const s = await subir(); const j = await entrar(s); const { codigos } = await cadastrarTotp(s, j);
  agoraMs += 16 * 60_000; await j.req(`${s.base}/conta`); const c = csrfDe(await (await j.req(`${s.base}/mfa`)).text());
  assert.equal((await j.req(`${s.base}/mfa/verificar`, form({ csrf: c, tipo: 'recuperacao', codigo: codigos[0]! }))).status, 303);
  agoraMs += 16 * 60_000; await j.req(`${s.base}/conta`); const c2 = csrfDe(await (await j.req(`${s.base}/mfa`)).text());
  assert.equal((await j.req(`${s.base}/mfa/verificar`, form({ csrf: c2, tipo: 'recuperacao', codigo: codigos[0]! }))).status, 400, 'código de recuperação reutilizado');
  assert.equal((await j.req(`${s.base}/mfa/verificar`, form({ csrf: c2, tipo: 'recuperacao', codigo: codigos[1]! }))).status, 303);
  const rg = await j.req(`${s.base}/mfa/recuperacao`, form({ csrf: c2 })); const novos = [...(await rg.text()).matchAll(/<code>([a-f0-9]{5}-[a-f0-9]{5})<\/code>/g)].map((m) => m[1]!); assert.equal(novos.length, 10);
  agoraMs += 16 * 60_000; await j.req(`${s.base}/conta`); const c3 = csrfDe(await (await j.req(`${s.base}/mfa`)).text()); assert.equal((await j.req(`${s.base}/mfa/verificar`, form({ csrf: c3, tipo: 'recuperacao', codigo: codigos[2]! }))).status, 400, 'código antigo aceito');
  const adm = jar(); await adm.req(`${s.base}/admin/entrar`, form({ segredo: 'seg-admin' })); const ca = csrfDe(await (await adm.req(`${s.base}/admin`)).text());
  await adm.req(`${s.base}/admin/pessoas/acao`, form({ csrf: ca, id: 'usr_a', acao: 'resetar_mfa' })); assert.equal(await s.store.get('mfa', 'usr_a'), null); assert.ok(s.eventos.some((e) => e.acao === 'admin.pessoa.resetar_mfa'));
  s.srv.close();
});
test('passkey: cadastro, login com assinatura, contador, origem errada, desafio reutilizado e flags sem verificação', async () => {
  const s = await subir(); const j = await entrar(s); const aut = new AutenticadorSoft('odin.exemplo', EMISSOR);
  // primeiro fator: passkey (sem TOTP)
  await j.req(`${s.base}/conta`); const c = csrfDe(await (await j.req(`${s.base}/mfa`)).text());
  const op = await (await j.req(`${s.base}/mfa/passkey/opcoes`, json({ csrf: c }))).json() as { challenge: string; rp: { id: string } }; assert.equal(op.rp.id, 'odin.exemplo');
  const ruim = await j.req(`${s.base}/mfa/passkey/registrar`, json({ csrf: c, dados: JSON.stringify(aut.registrar(op.challenge, { origem: 'https://falso.exemplo' })) })); assert.equal(ruim.status, 400);
  const op2 = await (await j.req(`${s.base}/mfa/passkey/opcoes`, json({ csrf: c }))).json() as { challenge: string };
  assert.equal((await j.req(`${s.base}/mfa/passkey/registrar`, json({ csrf: c, dados: JSON.stringify(aut.registrar(op2.challenge, { flags: 0x41 })) }))).status, 400, 'passkey sem verificação do usuário aceita');
  const op3 = await (await j.req(`${s.base}/mfa/passkey/opcoes`, json({ csrf: c }))).json() as { challenge: string };
  assert.equal((await j.req(`${s.base}/mfa/passkey/registrar`, json({ csrf: c, dados: JSON.stringify(aut.registrar(op3.challenge)) }))).status, 200);
  assert.equal((await j.req(`${s.base}/conta`)).status, 200);
  agoraMs += 16 * 60_000; await j.req(`${s.base}/conta`); const c2 = csrfDe(await (await j.req(`${s.base}/mfa`)).text());
  const d1 = await (await j.req(`${s.base}/mfa/passkey/desafio`, json({ csrf: c2 }))).json() as { challenge: string; ids: string[] }; assert.deepEqual(d1.ids, [aut.id.toString('base64url')]);
  assert.equal((await j.req(`${s.base}/mfa/passkey/verificar`, json({ csrf: c2, dados: JSON.stringify(aut.assinar(d1.challenge, { origem: 'https://falso.exemplo' })) }))).status, 400);
  assert.equal((await j.req(`${s.base}/mfa/passkey/verificar`, json({ csrf: c2, dados: JSON.stringify(aut.assinar(d1.challenge)) }))).status, 400, 'desafio reutilizado'); // consumido na tentativa anterior
  const d2 = await (await j.req(`${s.base}/mfa/passkey/desafio`, json({ csrf: c2 }))).json() as { challenge: string };
  assert.equal((await j.req(`${s.base}/mfa/passkey/verificar`, json({ csrf: c2, dados: JSON.stringify(aut.assinar(d2.challenge)) }))).status, 200); assert.equal((await j.req(`${s.base}/conta`)).status, 200);
  agoraMs += 16 * 60_000; await j.req(`${s.base}/conta`); const c3 = csrfDe(await (await j.req(`${s.base}/mfa`)).text()); const d3 = await (await j.req(`${s.base}/mfa/passkey/desafio`, json({ csrf: c3 }))).json() as { challenge: string };
  assert.equal((await j.req(`${s.base}/mfa/passkey/verificar`, json({ csrf: c3, dados: JSON.stringify(aut.assinar(d3.challenge, { naoAvancar: true })) }))).status, 400, 'contador repetido aceito');
  assert.ok(s.eventos.some((e) => e.acao === 'portal.mfa.passkey' && e.resultado === 'ok')); s.srv.close();
});
test('portal: o segredo de emergência não exige segundo fator e a página de passkey liga o script só por hash', async () => {
  const s = await subir(); const adm = jar(); await adm.req(`${s.base}/admin/entrar`, form({ segredo: 'seg-admin' })); assert.equal((await adm.req(`${s.base}/admin`)).status, 200);
  const j = await entrar(s); await j.req(`${s.base}/conta`); const r = await j.req(`${s.base}/mfa`); const csp = r.headers.get('content-security-policy')!; assert.match(csp, /script-src 'sha256-[A-Za-z0-9+/=]+'/); assert.ok(!/unsafe-inline'?[^;]*script/.test(csp.split('style-src')[0]!)); s.srv.close();
});
