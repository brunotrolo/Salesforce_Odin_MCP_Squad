// Peças de nuvem que podem ser provadas sem nuvem: conversão de assinatura do KMS, disjuntor, rotinas e ativação provisória.
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { criarDisjuntor, decidir } from '../apps/disjuntor/src/disjuntor.ts';
import { tick } from '../apps/jobs/src/rotinas.ts';
import { criarSts } from '../apps/sts/src/sts.ts';
import { coletorMemoria } from '../packages/shared/src/auditoria.ts';
import { AssinadorLocal, verificarAssinatura } from '../packages/shared/src/chaves.ts';
import { derParaP1363 } from '../packages/shared/src/nuvem/kms.ts';
import { semearNuvem } from '../packages/shared/src/nuvem/semente.ts';
import { MemoryStore } from '../packages/shared/src/store.ts';
import { RAIZ } from '../dev/ambiente.ts';

test('KMS: assinatura DER vira r||s de 64 bytes e continua válida (inclusive com zeros à esquerda)', () => {
  for (let i = 0; i < 200; i++) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const dados = Buffer.from(`mensagem ${i}`);
    const der = sign('sha256', dados, privateKey); // DER, como o KMS devolve
    const p1363 = derParaP1363(der);
    assert.equal(p1363.length, 64);
    const { kty, crv, x, y } = publicKey.export({ format: 'jwk' });
    assert.ok(verificarAssinatura({ kty, crv, x, y }, dados, p1363), `amostra ${i}`);
  }
  assert.throws(() => derParaP1363(Buffer.from([0x31, 0x00])), /DER inválida/);
});

test('disjuntor: só fecha a partir de 300% do orçamento, e simulação nunca fecha (CT-28)', async (t) => {
  assert.equal(decidir({ costAmount: 10, budgetAmount: 30 }).fechar, false);
  assert.equal(decidir({ costAmount: 89.9, budgetAmount: 30 }).fechar, false);
  assert.equal(decidir({ costAmount: 90, budgetAmount: 30 }).fechar, true);
  assert.equal(decidir({}).fechar, false); assert.equal(decidir({ costAmount: 1, budgetAmount: 0 }).fechar, false);
  const fechados: string[] = []; const { coletor, eventos } = coletorMemoria();
  const srv = createServer(criarDisjuntor({ projeto: 'p', regiao: 'r', servicos: ['odin-mcp', 'odin-sts'], coletor, fecharIngress: async (s) => { fechados.push(s); } }));
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok)); t.after(() => srv.close());
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const aviso = (cost: number) => JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ costAmount: cost, budgetAmount: 30 })).toString('base64') } });
  assert.equal(((await (await fetch(url, { method: 'POST', body: aviso(20) })).json()) as { fechou: boolean }).fechou, false); assert.deepEqual(fechados, []);
  assert.equal(((await (await fetch(`${url}?simular=1`, { method: 'POST', body: aviso(95) })).json()) as { simulado: boolean }).simulado, true); assert.deepEqual(fechados, []);
  const r = (await (await fetch(url, { method: 'POST', body: aviso(95) })).json()) as { fechou: boolean };
  assert.equal(r.fechou, true); assert.deepEqual(fechados, ['odin-mcp', 'odin-sts']);
  assert.ok(eventos.some((e) => e.acao === 'custo.disjuntor' && e.resultado === 'negado'));
  assert.equal((await fetch(url, { method: 'POST', body: 'lixo' })).status, 400); assert.equal((await fetch(url)).status, 405);
});

test('rotinas: remove só o que venceu e registra o último tick', async () => {
  const s = new MemoryStore(); const agora = 1_000_000_000;
  await s.set('device_codes', 'velho', { expiraEm: agora - 3_600_000 }); await s.set('device_codes', 'novo', { expiraEm: agora + 60_000 });
  await s.set('grants', 'g1', { expiraEm: agora - 1 }); await s.set('grants', 'g2', { expiraEm: agora + 9999 });
  await s.set('revocations', 'r1', { tipo: 'jti', ate: agora - 1 }); await s.set('revocations', 'global', { desde: agora });
  assert.deepEqual(await tick(s, agora), { codigos_expirados: 1, concessoes_expiradas: 1, revogacoes_expiradas: 1 });
  assert.ok(await s.get('device_codes', 'novo') && await s.get('grants', 'g2') && await s.get('revocations', 'global'));
  assert.equal((await s.get('settings', 'jobs'))!.ultimoTick, agora);
});

test('semente da nuvem: idempotente, 11 skills no catálogo, só o mantenedor como pessoa', async () => {
  const s = new MemoryStore(); const m = { id: 'usr_mantenedor', githubId: 1, githubLogin: 'mantenedor-exemplo', nome: 'Mantenedor' };
  const a = await semearNuvem(s, RAIZ, m); await s.update('catalog_skills', 'sf-test', (x) => ({ ...x!, canais: { stable: '1.0.0' } }));
  await semearNuvem(s, RAIZ, m);
  assert.equal(a.skills, 10); assert.equal((await s.list('users')).length, 1);
  assert.deepEqual(((await s.get('catalog_skills', 'sf-test'))!.canais), { stable: '1.0.0' }, 'não apaga versões já publicadas');
  assert.ok(((await s.get('profiles', 'mantenedor'))!.skills as string[]).includes('odin-ambiente'));
});

test('ativação provisória do mantenedor: exige o segredo, compara em tempo constante e audita a negativa', async (t) => {
  const store = new MemoryStore(); await semearNuvem(store, RAIZ, { id: 'usr_mantenedor', githubId: 1, githubLogin: 'm', nome: 'M' });
  const { coletor, eventos } = coletorMemoria(); const { assinador } = AssinadorLocal.gerar('k');
  const srv = createServer(); await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok)); t.after(() => srv.close());
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const sts = criarSts({ store, assinador, coletor, emissor: url, audiencias: ['https://mcp'], portalUrl: url, pimenta: 'p', ativacaoSegredo: 'segredo-correto-123' });
  srv.on('request', (q, r) => { void sts.handler(q, r); });
  const da = await (await fetch(`${url}/oauth/device_authorization`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'odin-cli', chave_publica_jwk: AssinadorLocal.gerar('d').assinador.publica().jwk }) })).json() as any;
  const aprovar = (segredo: string) => fetch(`${url}/ativar`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: da.user_code, user: 'usr_mantenedor', segredo }) });
  assert.match(await (await fetch(`${url}/ativar`)).text(), /Segredo de ativação/);
  assert.equal((await aprovar('errado')).status, 403); assert.equal((await aprovar('')).status, 403);
  assert.ok(eventos.some((e) => e.acao === 'sts.device.approve' && e.resultado === 'negado'));
  assert.equal((await aprovar('segredo-correto-123')).status, 200);
});

test('direitos: dispositivo ativado depois da última leitura funciona na hora; revogação segue o cache de 30 s', async () => {
  const { ResolvedorDeDireitos } = await import('../apps/mcp-server/src/direitos.ts');
  const s = new MemoryStore(); let agora = 1_000_000;
  await s.set('users', 'u', { status: 'ativo', policyVersion: 1 }); await s.set('devices', 'dev_a', { userId: 'u', status: 'ativo' });
  const r = new ResolvedorDeDireitos(s, () => agora);
  await r.resolver('u', 'dev_a', Math.floor(agora / 1000)); // enche o cache
  await s.set('devices', 'dev_b', { userId: 'u', status: 'ativo' }); // dispositivo novo
  await r.resolver('u', 'dev_b', Math.floor(agora / 1000)); // não pode ser recusado
  await assert.rejects(r.resolver('u', 'dev_desconhecido', Math.floor(agora / 1000)), /revogado/);
  await s.set('devices', 'dev_a', { userId: 'u', status: 'revogado' });
  await r.resolver('u', 'dev_a', Math.floor(agora / 1000)); // ainda dentro dos 30 s
  agora += 31_000;
  await assert.rejects(r.resolver('u', 'dev_a', Math.floor(agora / 1000)), /revogado/);
});
