// odin-sts: emissor de tokens (arquitetura 03, seção 5; segurança 02 e 03).
// Device Authorization Grant (RFC 8628) com chave do dispositivo; refresh rotativo com prova de posse
// (private_key_jwt, RFC 7523) e detecção de reuso; token de acesso ES256 de 15 minutos, sem perfis dentro.
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { auditar, novoRequestId, type Coletor } from '../../../packages/shared/src/auditoria.ts';
import type { Assinador, Jwk } from '../../../packages/shared/src/chaves.ts';
import { OdinErro, paraOdinErro } from '../../../packages/shared/src/erros.ts';
import { ipDe, lerFormulario, LimiteDeTaxa, responder } from '../../../packages/shared/src/http.ts';
import { assinarJwt, verificarJwt } from '../../../packages/shared/src/jwt.ts';
import { ACCESS_TOKEN_TTL_SECONDS, ANON_RATE_PER_MIN, DEVICE_CODE_TTL_SECONDS, REFRESH_FAMILY_MAX_DAYS, REFRESH_IDLE_DAYS } from '../../../packages/shared/src/limites.ts';
import type { Store } from '../../../packages/shared/src/store.ts';

export interface Pessoa { githubId: number; githubLogin: string; nome: string; status: 'ativo' | 'suspenso'; policyVersion: number; [k: string]: unknown }
export interface Dispositivo { userId: string; nome: string; so: string; chavePublicaJwk: Jwk; refreshHash: string; anteriores: string[]; familia: string; familiaCriadaEm: number; ultimoUso: number; status: 'ativo' | 'revogado'; ip: string; [k: string]: unknown }
interface CodigoDispositivo { userCodeHash: string; jwk: Jwk; nome: string; so: string; expiraEm: number; ip: string; aprovadoPor?: string; usado?: boolean; [k: string]: unknown }

export interface ConfigSts {
  store: Store; assinador: Assinador; coletor: Coletor;
  emissor: string; audiencias: string[]; portalUrl: string; pimenta: string;
  agora?: () => number;
  /** Só desenvolvimento local: página /ativar com escolha de pessoa, no lugar do portal com GitHub + MFA. */
  loginDev?: boolean;
  /** Ativação provisória do mantenedor até o portal existir (E0): exige este segredo (Secret Manager) e só mostra as pessoas ativas. */
  ativacaoSegredo?: string;
  /** Documento de descoberta lido pelo CLI (/.well-known/odin-configuration); na nuvem quem publica é o portal. */
  descoberta?: Record<string, unknown>;
}

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const ALFABETO = 'BCDFGHJKLMNPQRSTVWXZ'; // sem vogais: não forma palavras

export function criarSts(cfg: ConfigSts) {
  const agora = cfg.agora ?? Date.now;
  const seg = () => Math.floor(agora() / 1000);
  const hmac = (v: string) => createHmac('sha256', cfg.pimenta).update(v).digest('hex');
  const limite = new LimiteDeTaxa(agora);
  const jtis = new Map<string, number>(); // repetição de client_assertion (por instância)
  const novoId = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;
  const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z]/g, '');

  /** Confere a prova de posse: JWT assinado pela chave do dispositivo, para este emissor, de uso único e curto. */
  function conferirProva(assertion: unknown, jwk: Jwk, sujeito?: string): void {
    if (typeof assertion !== 'string') throw new OdinErro('invalido', 'Falta a prova de posse (client_assertion).');
    let c;
    try { c = verificarJwt(assertion, { chaves: [{ kid: 'dispositivo', jwk }], typ: 'JWT', aud: [cfg.emissor], agora: seg(), exigirKid: false }); }
    catch { throw new OdinErro('sem_acesso', 'Prova de posse inválida para este dispositivo.'); }
    if (typeof c.exp !== 'number' || typeof c.iat !== 'number' || c.exp - c.iat > 120) throw new OdinErro('sem_acesso', 'Prova de posse com validade longa demais.');
    if (sujeito && c.sub !== sujeito) throw new OdinErro('sem_acesso', 'Prova de posse de outro dispositivo.');
    if (typeof c.jti !== 'string' || jtis.has(c.jti)) throw new OdinErro('sem_acesso', 'Prova de posse repetida.');
    jtis.set(c.jti, c.exp);
    if (jtis.size > 5000) for (const [k, e] of jtis) if (e < seg()) jtis.delete(k);
  }

  async function globalDesde(): Promise<number> { return Number((await cfg.store.get('revocations', 'global'))?.desde ?? 0); }

  async function emitir(deviceId: string, d: Dispositivo, p: Pessoa, userId: string) {
    const t = seg();
    const refresh = `odin_rt_${randomBytes(32).toString('base64url')}`;
    d.anteriores = [d.refreshHash, ...(d.anteriores ?? [])].filter(Boolean).slice(0, 8);
    d.refreshHash = hmac(refresh); d.ultimoUso = agora();
    await cfg.store.set('devices', deviceId, d);
    const access = await assinarJwt(cfg.assinador, {
      iss: cfg.emissor, aud: cfg.audiencias[0], sub: userId, client_id: 'odin-cli', gh: p.githubId, dev: deviceId, fam: d.familia,
      pv: p.policyVersion, amr: ['github', 'otp'], acr: 'N1', iat: t, nbf: t, exp: t + ACCESS_TOKEN_TTL_SECONDS, jti: novoId('jti'),
    }, 'at+jwt');
    return { token_type: 'Bearer', access_token: access, expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: refresh };
  }

  async function autorizacaoDeDispositivo(f: Record<string, string>, ip: string) {
    let jwk: Jwk;
    try { jwk = typeof f.chave_publica_jwk === 'string' ? JSON.parse(f.chave_publica_jwk) : f.chave_publica_jwk; } catch { throw new OdinErro('invalido', 'Chave pública do dispositivo inválida.'); }
    if (f.client_id !== 'odin-cli' || jwk?.kty !== 'EC' || jwk?.crv !== 'P-256' || !jwk.x || !jwk.y) throw new OdinErro('invalido', 'Pedido de ativação inválido.');
    const deviceCode = randomBytes(32).toString('base64url');
    const letras = Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
    const userCode = `${letras.slice(0, 4)}-${letras.slice(4)}`;
    const doc: CodigoDispositivo = { userCodeHash: hmac(letras), jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, nome: String(f.nome ?? 'dispositivo').slice(0, 60), so: String(f.so ?? '').slice(0, 20), expiraEm: agora() + DEVICE_CODE_TTL_SECONDS * 1000, ip };
    await cfg.store.set('device_codes', hmac(deviceCode), doc);
    return { device_code: deviceCode, user_code: userCode, verification_uri: `${cfg.portalUrl}/ativar`, verification_uri_complete: `${cfg.portalUrl}/ativar?code=${userCode}`, expires_in: DEVICE_CODE_TTL_SECONDS, interval: 2 };
  }

  /** Chamado pelo portal depois do login com GitHub e do segundo fator: liga o código à pessoa. */
  async function aprovarDispositivo(userCode: string, userId: string): Promise<{ nome: string; so: string; ip: string }> {
    const alvo = hmac(normalizarCodigo(userCode));
    const p = await cfg.store.get<Pessoa>('users', userId);
    if (!p || p.status !== 'ativo') throw new OdinErro('sem_acesso', 'Pessoa sem acesso ao Odin.');
    const achado = (await cfg.store.list<CodigoDispositivo>('device_codes', (d) => d.userCodeHash === alvo))[0];
    if (!achado || achado.expiraEm < agora() || achado.aprovadoPor || achado.usado) throw new OdinErro('invalido', 'Código inválido, vencido ou já usado. Rode "odin setup" de novo.');
    await cfg.store.update<CodigoDispositivo>('device_codes', achado.id, (d) => (d ? { ...d, aprovadoPor: userId } : null));
    auditar(cfg.coletor, 'odin-sts', { ator: userId, acao: 'sts.device.approve', resultado: 'ok', request_id: novoRequestId(), alvo: achado.nome });
    return { nome: achado.nome, so: achado.so, ip: achado.ip };
  }

  async function token(f: Record<string, string>, ip: string, rid: string) {
    if (f.grant_type === DEVICE_GRANT) {
      const id = hmac(String(f.device_code ?? ''));
      const dc = await cfg.store.get<CodigoDispositivo>('device_codes', id);
      if (!dc || dc.usado) return { erroOAuth: 'invalid_grant' };
      if (dc.expiraEm < agora()) return { erroOAuth: 'expired_token' };
      conferirProva(f.client_assertion, dc.jwk);
      if (!dc.aprovadoPor) return { erroOAuth: 'authorization_pending' };
      const p = await cfg.store.get<Pessoa>('users', dc.aprovadoPor);
      if (!p || p.status !== 'ativo') return { erroOAuth: 'access_denied' };
      await cfg.store.update<CodigoDispositivo>('device_codes', id, (d) => (d ? { ...d, usado: true } : null));
      const deviceId = novoId('dev');
      const d: Dispositivo = { userId: dc.aprovadoPor, nome: dc.nome, so: dc.so, chavePublicaJwk: dc.jwk, refreshHash: '', anteriores: [], familia: novoId('fam'), familiaCriadaEm: agora(), ultimoUso: agora(), status: 'ativo', ip };
      const r = await emitir(deviceId, d, p, dc.aprovadoPor);
      auditar(cfg.coletor, 'odin-sts', { ator: dc.aprovadoPor, dispositivo: deviceId, acao: 'sts.device.activate', resultado: 'ok', request_id: rid, ip });
      return { ...r, device_id: deviceId };
    }
    if (f.grant_type === 'refresh_token') {
      const h = hmac(String(f.refresh_token ?? ''));
      const achados = await cfg.store.list<Dispositivo>('devices', (d) => d.refreshHash === h || (d.anteriores ?? []).includes(h));
      const d = achados[0];
      if (!d) return { erroOAuth: 'invalid_grant' };
      const deviceId = d.id;
      if (d.refreshHash !== h) { // token antigo reapresentado: a família inteira cai (DT-01)
        await cfg.store.update<Dispositivo>('devices', deviceId, (x) => (x ? { ...x, status: 'revogado' } : null));
        auditar(cfg.coletor, 'odin-sts', { ator: d.userId, dispositivo: deviceId, acao: 'sts.refresh.reuse', resultado: 'negado', motivo: 'revogado', request_id: rid, ip });
        return { erroOAuth: 'invalid_grant' };
      }
      conferirProva(f.client_assertion, d.chavePublicaJwk, deviceId);
      const p = await cfg.store.get<Pessoa>('users', d.userId);
      const dia = 86_400_000;
      const vencido = agora() - d.familiaCriadaEm > REFRESH_FAMILY_MAX_DAYS * dia || agora() - d.ultimoUso > REFRESH_IDLE_DAYS * dia || d.familiaCriadaEm < (await globalDesde());
      if (d.status !== 'ativo' || !p || p.status !== 'ativo' || vencido) {
        auditar(cfg.coletor, 'odin-sts', { ator: d.userId, dispositivo: deviceId, acao: 'sts.token', resultado: 'negado', motivo: 'revogado', request_id: rid, ip });
        return { erroOAuth: 'invalid_grant' };
      }
      const { id: _id, ...semId } = d;
      const r = await emitir(deviceId, semId as Dispositivo, p, d.userId);
      auditar(cfg.coletor, 'odin-sts', { ator: d.userId, dispositivo: deviceId, acao: 'sts.token', resultado: 'ok', request_id: rid, ip });
      return r;
    }
    return { erroOAuth: 'unsupported_grant_type' };
  }

  const paginaAtivar = (code: string, pessoas: Array<Pessoa & { id: string }>, msg = '', pedeSegredo = false) => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ativar dispositivo · Odin (desenvolvimento)</title>
<body style="font:16px system-ui;max-width:520px;margin:48px auto;padding:0 16px"><h1>Ativar dispositivo</h1>
<p style="background:#fff3cd;padding:8px 12px;border-radius:8px">${pedeSegredo ? 'Ativação <b>provisória do mantenedor</b>: informe o segredo de ativação. No portal, este passo será o login com GitHub mais o segundo fator.' : 'Ambiente de <b>desenvolvimento local</b>: aqui você escolhe a pessoa. No portal real, este passo é o login com GitHub mais o segundo fator.'}</p>
${msg ? `<p><b>${msg}</b></p>` : ''}<form method="post" action="/ativar"><p><label>Código<br><input name="code" value="${code.replace(/[^A-Za-z-]/g, '')}" required style="font:20px monospace;padding:6px"></label></p>
${pedeSegredo ? '<p><label>Segredo de ativação<br><input name="segredo" type="password" required autocomplete="off" style="font:16px system-ui;padding:6px"></label></p>' : ''}<p><label>Entrar como<br><select name="user" style="font:16px system-ui;padding:6px">${pessoas.map((p) => `<option value="${p.id}">${p.nome} (@${p.githubLogin})</option>`).join('')}</select></label></p>
<button style="font:16px system-ui;padding:8px 16px">Aprovar este dispositivo</button></form></body></html>`;

  async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const rid = novoRequestId(); const ip = ipDe(req);
    const url = new URL(req.url ?? '/', 'http://local');
    try {
      const rota = `${req.method} ${url.pathname}`;
      if (rota === 'GET /healthz' || rota === 'GET /saude') return responder(res, 200, { ok: true });
      if (rota === 'GET /.well-known/jwks.json') return responder(res, 200, { keys: [{ ...cfg.assinador.publica().jwk, kid: cfg.assinador.kid, use: 'sig', alg: 'ES256' }] }, { 'cache-control': 'public, max-age=600' });
      if (rota === 'GET /.well-known/oauth-authorization-server') return responder(res, 200, { issuer: cfg.emissor, token_endpoint: `${cfg.emissor}/oauth/token`, device_authorization_endpoint: `${cfg.emissor}/oauth/device_authorization`, jwks_uri: `${cfg.emissor}/.well-known/jwks.json`, grant_types_supported: [DEVICE_GRANT, 'refresh_token'], token_endpoint_auth_methods_supported: ['private_key_jwt'], token_endpoint_auth_signing_alg_values_supported: ['ES256'] });
      if (rota === 'GET /.well-known/odin-configuration' && cfg.descoberta) return responder(res, 200, cfg.descoberta);
      if (rota === 'POST /oauth/device_authorization') { limite.consumir(`da:${ip}`, ANON_RATE_PER_MIN); return responder(res, 200, await autorizacaoDeDispositivo(await lerFormulario(req), ip)); }
      if (rota === 'POST /oauth/token') {
        limite.consumir(`tk:${ip}`, ANON_RATE_PER_MIN * 2);
        const r = await token(await lerFormulario(req), ip, rid);
        return 'erroOAuth' in r ? responder(res, 400, { error: r.erroOAuth }) : responder(res, 200, r);
      }
      if ((cfg.loginDev || cfg.ativacaoSegredo) && url.pathname === '/ativar') {
        const pede = !!cfg.ativacaoSegredo;
        const pessoas = await cfg.store.list<Pessoa>('users', (p) => p.status === 'ativo');
        if (req.method === 'GET') return responder(res, 200, paginaAtivar(url.searchParams.get('code') ?? '', pessoas, '', pede));
        if (req.method === 'POST') {
          limite.consumir(`at:${ip}`, ANON_RATE_PER_MIN);
          const f = await lerFormulario(req);
          if (pede) { // comparação em tempo constante; erro genérico, com limite de tentativas por IP
            const a = Buffer.from(String(f.segredo ?? '')), b = Buffer.from(cfg.ativacaoSegredo!);
            if (a.length !== b.length || !timingSafeEqual(a, b)) { auditar(cfg.coletor, 'odin-sts', { ator: 'anonimo', acao: 'sts.device.approve', resultado: 'negado', motivo: 'sem_acesso', request_id: rid, ip }); return responder(res, 403, paginaAtivar(String(f.code ?? ''), pessoas, 'Segredo incorreto.', true)); }
          }
          try { const d = await aprovarDispositivo(String(f.code ?? ''), String(f.user ?? '')); return responder(res, 200, paginaAtivar('', pessoas, `Dispositivo "${d.nome}" aprovado. Pode voltar ao terminal.`, pede)); }
          catch (e) { return responder(res, 400, paginaAtivar(String(f.code ?? ''), pessoas, paraOdinErro(e).message, pede)); }
        }
      }
      return responder(res, 404, { codigo: 'invalido', mensagem: 'Rota inexistente.', request_id: rid });
    } catch (e) {
      const err = paraOdinErro(e);
      if (err.codigo === 'interno') auditar(cfg.coletor, 'odin-sts', { ator: 'sistema', acao: 'sts.erro', resultado: 'erro', motivo: 'interno', request_id: rid });
      responder(res, err.http, err.corpo(rid), err.tentarEmS ? { 'retry-after': String(err.tentarEmS) } : {});
    }
  }

  return { handler, aprovarDispositivo };
}

// ---- Administração de acesso (usada pelo portal e pelos runbooks RB-01, RB-02 e RB-03) ----
export async function revogarDispositivo(store: Store, deviceId: string): Promise<void> {
  const d = await store.update<Dispositivo>('devices', deviceId, (x) => (x ? { ...x, status: 'revogado' } : null));
  if (d) await store.update<Pessoa>('users', d.userId, (p) => (p ? { ...p, policyVersion: p.policyVersion + 1 } : null));
}
export async function suspenderPessoa(store: Store, userId: string): Promise<void> {
  await store.update<Pessoa>('users', userId, (p) => (p ? { ...p, status: 'suspenso', policyVersion: p.policyVersion + 1 } : null));
  for (const d of await store.list<Dispositivo>('devices', (x) => x.userId === userId)) await store.update<Dispositivo>('devices', d.id, (x) => (x ? { ...x, status: 'revogado' } : null));
}
export async function revogacaoGlobal(store: Store, agora: number = Date.now()): Promise<void> { await store.set('revocations', 'global', { desde: agora }); }
