// odin-portal (interino, E0): páginas de administração e de pessoa, servidas pelo mesmo serviço do emissor de tokens.
// Entrada do administrador: segredo do Secret Manager. Entrada da pessoa: convite de uso único criado por um administrador.
// Quando houver o OAuth App do GitHub, o login passa a ser GitHub + segundo fator sem mudar as páginas (decisão: ADR 0023).
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { auditar, novoRequestId, type Coletor } from '../../../packages/shared/src/auditoria.ts';
import { OdinErro, paraOdinErro } from '../../../packages/shared/src/erros.ts';
import { ipDe, lerFormulario, LimiteDeTaxa, responder } from '../../../packages/shared/src/http.ts';
import type { Store } from '../../../packages/shared/src/store.ts';
import { base32, cifrar, decifrar, hashRecuperacao, novoSegredoTotp, novosCodigosRecuperacao, uriTotp, verificarAssercao, verificarRegistro, verificarTotp, type Passkey } from './mfa.ts';
import { Conhecimento } from '../../mcp-server/src/conhecimento.ts';
import { revogacaoGlobal, revogarDispositivo, suspenderPessoa } from '../../sts/src/sts.ts';

export interface ConfigPortal {
  store: Store; coletor: Coletor; pimenta: string; adminSegredo: string; emissor: string;
  aprovarDispositivo: (code: string, userId: string) => Promise<{ nome: string }>; agora?: () => number;
  /** Login com GitHub (OAuth App). Sem isto o portal só tem o segredo de administração e os convites. */
  github?: { clientId: string; clientSecret: string; http?: typeof fetch };
  /** Obriga quem entra por GitHub ou convite a cadastrar o segundo fator. Quem já cadastrou sempre precisa confirmá-lo (a cada 15 min). */
  exigirMfa?: boolean;
}
interface Sessao { p: 'admin' | 'usuario'; s: string; e: number; c: string; m?: number }
interface DocMfa { totp?: { seg: string; confirmado: boolean; ultimoPasso: number }; recuperacao?: Array<{ h: string; usado: boolean }>; passkeys?: Passkey[] }
const MFA_VALIDADE_S = 15 * 60;
const SCRIPT_PASSKEY = `const b64=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};const u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');const csrf=document.getElementById('pk').dataset.csrf;const post=async(url,d)=>(await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({csrf,dados:JSON.stringify(d||{})})})).json();const msg=t=>{document.getElementById('pk-msg').textContent=t};document.getElementById('pk-reg')?.addEventListener('click',async()=>{try{const o=await post('/mfa/passkey/opcoes');const c=await navigator.credentials.create({publicKey:{challenge:b64(o.challenge),rp:o.rp,user:{id:b64(o.user.id),name:o.user.name,displayName:o.user.name},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{userVerification:'required',residentKey:'preferred'},attestation:'none'}});const r=await post('/mfa/passkey/registrar',{clientDataJSON:u(c.response.clientDataJSON),attestationObject:u(c.response.attestationObject)});if(r.ok)location.href='/mfa';else msg(r.erro||'Falhou')}catch(e){msg('Não foi possível cadastrar a passkey.')}});document.getElementById('pk-ent')?.addEventListener('click',async()=>{try{const o=await post('/mfa/passkey/desafio');const a=await navigator.credentials.get({publicKey:{challenge:b64(o.challenge),rpId:o.rpId,allowCredentials:o.ids.map(id=>({type:'public-key',id:b64(id)})),userVerification:'required'}});const r=await post('/mfa/passkey/verificar',{id:u(a.rawId),clientDataJSON:u(a.response.clientDataJSON),authenticatorData:u(a.response.authenticatorData),assinatura:u(a.response.signature)});if(r.ok)location.href=r.destino;else msg(r.erro||'Falhou')}catch(e){msg('Não foi possível usar a passkey.')}});`;
const CSP_PASSKEY = (h: string) => `default-src 'none'; script-src 'sha256-${h}'; connect-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;

const COOKIE = 'odin_sessao';
const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
export const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dt = (ms: unknown): string => (ms ? new Date(Number(ms)).toISOString().slice(0, 16).replace('T', ' ') : '—');
const igual = (a: string, b: string): boolean => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function criarPortal(cfg: ConfigPortal) {
  const agora = cfg.agora ?? Date.now; const seg = () => Math.floor(agora() / 1000);
  const chave = createHmac('sha256', cfg.pimenta).update('portal-sessao').digest();
  const assinar = (v: string) => createHmac('sha256', chave).update(v).digest('base64url');
  const limite = new LimiteDeTaxa(agora); const kb = new Conhecimento(cfg.store);
  const hashConvite = (t: string) => createHmac('sha256', cfg.pimenta).update(`convite:${t}`).digest('hex');

  const gh = cfg.github; const http = gh?.http ?? fetch; const callbackUrl = `${cfg.emissor}/auth/github/callback`;
  const botaoGithub = gh ? '<p><a href="/auth/github/login" style="display:inline-block;background:#24292f;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Entrar com GitHub</a></p>' : '';
  const cookieEstado = (v: string, ttl: number) => `odin_oauth=${v}; HttpOnly; Secure; SameSite=Lax; Path=/auth/github; Max-Age=${ttl}`;
  const criarSessao = (p: Sessao['p'], s: string, ttlS: number): string => { const corpo = Buffer.from(JSON.stringify({ p, s, e: seg() + ttlS, c: randomBytes(12).toString('base64url') } satisfies Sessao)).toString('base64url'); return `${corpo}.${assinar(corpo)}`; };
  const cookie = (valor: string, ttlS: number) => `${COOKIE}=${valor}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ttlS}`;
  function sessaoDe(req: IncomingMessage): Sessao | null {
    const c = (req.headers.cookie ?? '').split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1); if (!c) return null;
    const [corpo, sig] = c.split('.'); if (!corpo || !sig || !igual(sig, assinar(corpo))) return null;
    try { const s = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Sessao; return s.e > seg() ? s : null; } catch { return null; }
  }
  const pagina = (titulo: string, corpo: string, nav = '') => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)} · Odin</title>
<style>:root{color-scheme:light dark;--b:#0b5cad;--bg:#fff;--fg:#1a1a1a;--card:#f4f6f8;--bd:#d5dbe1;--ok:#1a7f37;--no:#b3261e}@media(prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e8eaed;--card:#1d2226;--bd:#333b42;--b:#6cb1ff}}
body{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0}main{max-width:960px;margin:0 auto;padding:16px}header{background:var(--card);border-bottom:1px solid var(--bd)}header div{max-width:960px;margin:0 auto;padding:10px 16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}
a{color:var(--b)}h1{font-size:1.5rem}table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--bd);vertical-align:top}.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px 16px;margin:12px 0}
input,select,button{font:inherit;padding:6px 10px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--fg)}button{cursor:pointer;background:var(--b);color:#fff;border:0}button.p{background:var(--no)}.ok{color:var(--ok)}.no{color:var(--no)}code{background:var(--card);padding:2px 5px;border-radius:4px;word-break:break-all}</style>
<header><div><b>Odin</b>${nav}</div></header><main><h1>${esc(titulo)}</h1>${corpo}</main></html>`;
  const navAdmin = (c: string) => `<a href="/admin">Painel</a><a href="/admin/pessoas">Pessoas</a><a href="/admin/dispositivos">Dispositivos</a><a href="/admin/skills">Skills</a><a href="/admin/propostas">Propostas</a><form method="post" action="/sair" style="margin-left:auto"><input type="hidden" name="csrf" value="${c}"><button>Sair</button></form>`;
  const navConta = (c: string) => `<a href="/conta">Minha conta</a><form method="post" action="/sair" style="margin-left:auto"><input type="hidden" name="csrf" value="${c}"><button>Sair</button></form>`;
  const csrf = (s: Sessao) => `<input type="hidden" name="csrf" value="${s.c}">`;
  const html = (res: ServerResponse, status: number, corpo: string, extra: Record<string, string> = {}) => responder(res, status, corpo, { 'content-security-policy': CSP, 'referrer-policy': 'no-referrer', ...extra });
  const ir = (res: ServerResponse, para: string, extra: Record<string, string> = {}) => { res.writeHead(303, { location: para, 'cache-control': 'no-store', ...extra }); res.end(); };
  const aud = (rid: string, ip: string, ator: string, acao: string, resultado: 'ok' | 'negado' = 'ok', alvo?: string) => auditar(cfg.coletor, 'odin-portal', { ator, acao, resultado, request_id: rid, ip, ...(resultado === 'negado' ? { motivo: 'sem_acesso' as const } : {}), ...(alvo ? { alvo: alvo.slice(0, 120) } : {}) });

  async function perfisDe(userId: string): Promise<string[]> { const l = await cfg.store.list('memberships', (m) => m.userId === userId); return [...new Set(l.flatMap((m) => (m.perfis as string[]) ?? []))]; }
  async function skillsDe(userId: string): Promise<Array<{ id: string; nome: string; canal: string; versao: string }>> {
    const catalogo = await cfg.store.list('catalog_skills'); const saida = new Map<string, string>();
    for (const nome of await perfisDe(userId)) { const p = await cfg.store.get('profiles', nome); const canal = (p?.canais as string[] | undefined)?.includes('beta') ? 'beta' : 'stable'; for (const s of (p?.skills as string[] | undefined) ?? []) if (canal === 'beta' || !saida.has(s)) saida.set(s, canal); }
    return [...saida].map(([id, canal]) => { const s = catalogo.find((x) => x.id === id); const c = (s?.canais ?? {}) as Record<string, string>; return { id, nome: String(s?.nome ?? id), canal, versao: (canal === 'beta' && c.beta) || c.stable || '' }; }).sort((a, b) => a.id.localeCompare(b.id));
  }

  const rpId = new URL(cfg.emissor).hostname; const origem = new URL(cfg.emissor).origin;   const shaScript = createHash('sha256').update(SCRIPT_PASSKEY).digest('base64');
  const reemitir = (s: Sessao, patch: Partial<Sessao>): string => { const corpo = Buffer.from(JSON.stringify({ ...s, ...patch })).toString('base64url'); return `${corpo}.${assinar(corpo)}`; };
  const docMfa = async (userId: string): Promise<DocMfa> => ((await cfg.store.get('mfa', userId)) as DocMfa | null) ?? {};
  const cadastrado = (d: DocMfa): boolean => !!d.totp?.confirmado || (d.passkeys?.length ?? 0) > 0;
  const restantes = (d: DocMfa): number => (d.recuperacao ?? []).filter((x) => !x.usado).length;
  const meuNome = async (id: string): Promise<string> => String((await cfg.store.get('users', id))?.githubLogin || (await cfg.store.get('users', id))?.nome || id);
  const jsonOk = (res: ServerResponse, status: number, corpo: unknown, extra: Record<string, string> = {}) => responder(res, status, corpo, { 'content-security-policy': CSP, ...extra });
  const novoDesafio = async (userId: string, tipo: string): Promise<string> => { const c = randomBytes(32).toString('base64url'); await cfg.store.set('mfa_desafios', userId, { c, tipo, exp: agora() + 5 * 60_000 }); return c; };
  const consumirDesafio = async (userId: string, tipo: string): Promise<string> => { let achado = ''; await cfg.store.update('mfa_desafios', userId, (d) => { if (d && d.tipo === tipo && Number(d.exp) > agora()) achado = String(d.c); return null; }); if (!achado) throw new OdinErro('invalido', 'O desafio expirou. Tente de novo.'); return achado; };

  /** Devolve true quando a rota é do portal. */
  async function handler(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://local'); const p = url.pathname;
    if (!(p === '/' || p === '/sair' || p.startsWith('/auth/github/') || p === '/convite' || p === '/mfa' || p.startsWith('/mfa/') || p === '/conta' || p.startsWith('/conta/') || p === '/admin' || p.startsWith('/admin/'))) return false;
    const rid = novoRequestId(); const ip = ipDe(req);
    try {
      const sess = sessaoDe(req); const post = req.method === 'POST';
      const form = post ? await lerFormulario(req) : {};
      if (post && p !== '/convite' && p !== '/admin/entrar' && !(sess && igual(String(form.csrf ?? ''), sess.c))) { aud(rid, ip, sess?.s ?? 'anonimo', 'portal.csrf', 'negado'); return html(res, 403, pagina('Sessão inválida', '<p>Sua sessão expirou ou o formulário não é válido. <a href="/">Voltar ao início</a>.</p>')), true; }

      // ---- segundo fator: sessão de pessoa real só passa com o fator cadastrado e confirmado há ≤ 15 min (o segredo de emergência é exceção) ----
      const protegida = p === '/admin' || p.startsWith('/admin/') || p === '/conta' || p.startsWith('/conta/');
      if (sess && sess.s !== 'admin' && protegida) {
        const dm = await docMfa(sess.s); const preciso = cadastrado(dm) || cfg.exigirMfa === true; const ativo = (await cfg.store.get('users', sess.s))?.status === 'ativo'; // pessoa suspensa cai no bloqueio da conta (403), não no desafio
        if (preciso && ativo && !(sess.m && seg() - sess.m <= MFA_VALIDADE_S)) { if (post) aud(rid, ip, sess.s, 'portal.mfa.exigido', 'negado'); return ir(res, '/mfa'), true; }
      }
      if (p === '/mfa' || p.startsWith('/mfa/')) {
        if (!sess || sess.s === 'admin') return ir(res, '/'), true;
        const U = sess.s; const dm = await docMfa(U); const ativa = !!sess.m && seg() - sess.m <= MFA_VALIDADE_S; const destino = sess.p === 'admin' ? '/admin' : '/conta'; const nav = sess.p === 'admin' ? navAdmin(sess.c) : navConta(sess.c);
        const concluir = (extraMsg = ''): true => { const c = reemitir(sess, { m: seg() }); return ir(res, extraMsg ? '/mfa?ok=1' : destino, { 'set-cookie': cookie(c, Math.max(60, sess.e - seg())) }), true; };
        if (p === '/mfa' && !post) {
          const cad = cadastrado(dm); const pk = `<div id="pk" data-csrf="${sess.c}"></div><p id="pk-msg" class="no"></p><script>${SCRIPT_PASSKEY}</script>`;
          const corpo = cad && !ativa
            ? `<div class="card"><h2>Confirme que é você</h2><form method="post" action="/mfa/verificar">${csrf(sess)}${dm.totp?.confirmado ? '<p><label>Código do aplicativo autenticador<br><input name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="8"></label></p><button name="tipo" value="totp">Confirmar</button>' : ''}</form>${(dm.passkeys?.length ?? 0) ? `<p><button id="pk-ent" type="button">Usar minha passkey</button></p>` : ''}<form method="post" action="/mfa/verificar" style="margin-top:12px">${csrf(sess)}<p><label>Ou um código de recuperação<br><input name="codigo" maxlength="12" autocomplete="off"></label></p><button name="tipo" value="recuperacao">Usar código de recuperação</button></form>${pk}</div>`
            : `<div class="card"><h2>Segundo fator</h2><p>Situação: ${cad ? '<b class="ok">cadastrado</b>' : '<b class="no">não cadastrado</b>'}${cad ? ` · códigos de recuperação restantes: <b>${restantes(dm)}</b>` : ''}</p>${url.searchParams.get('ok') ? '<p class="ok">Pronto.</p>' : ''}${dm.totp?.confirmado ? '<p>Aplicativo autenticador: ativo.</p>' : `<form method="post" action="/mfa/totp/iniciar">${csrf(sess)}<button>Cadastrar aplicativo autenticador (TOTP)</button></form>`}<p>Passkeys: <b>${dm.passkeys?.length ?? 0}</b></p><p><button id="pk-reg" type="button">Cadastrar passkey</button></p>${cad ? `<form method="post" action="/mfa/recuperacao">${csrf(sess)}<button>Gerar novos códigos de recuperação</button></form><p><a href="${destino}">Continuar</a></p>` : '<p>Cadastre ao menos um fator para continuar.</p>'}${pk}</div>`;
          return html(res, 200, pagina('Verificação em duas etapas', corpo, nav), { 'content-security-policy': CSP_PASSKEY(shaScript) }), true;
        }
        if (p === '/mfa/totp/iniciar' && post) {
          if (cadastrado(dm) && !ativa) return ir(res, '/mfa'), true; const seg0 = novoSegredoTotp();
          await cfg.store.update('mfa', U, (d) => ({ ...((d as DocMfa | null) ?? {}), totp: { seg: cifrar(cfg.pimenta, seg0), confirmado: false, ultimoPasso: 0 } }));
          return html(res, 200, pagina('Cadastrar aplicativo autenticador', `<div class="card"><p>No aplicativo (Google Authenticator, Microsoft Authenticator, 1Password…) escolha <b>inserir chave manualmente</b>:</p><p><code>${base32(seg0)}</code></p><p><small>Conta: ${esc(await meuNome(U))} · tipo: baseado em tempo · 6 dígitos</small></p><details><summary>Endereço otpauth</summary><p><code>${esc(uriTotp(await meuNome(U), seg0))}</code></p></details><form method="post" action="/mfa/totp/confirmar">${csrf(sess)}<p><label>Digite o código de 6 dígitos que o aplicativo mostra<br><input name="codigo" inputmode="numeric" required maxlength="8" autocomplete="off"></label></p><button>Confirmar</button></form></div>`, nav)), true;
        }
        if (p === '/mfa/totp/confirmar' && post) {
          limite.consumir(`mf:${U}`, 10); const t0 = dm.totp; if (!t0 || t0.confirmado) return ir(res, '/mfa'), true;
          const passo = verificarTotp(decifrar(cfg.pimenta, t0.seg), String(form.codigo ?? ''), seg(), 0);
          if (passo === null) { aud(rid, ip, U, 'portal.mfa.totp_cadastro', 'negado'); return html(res, 400, pagina('Código incorreto', '<p class="no">O código não confere. Volte e tente de novo (o relógio do celular precisa estar certo).</p><p><a href="/mfa">Voltar</a></p>', nav)), true; }
          const codigos = novosCodigosRecuperacao(); await cfg.store.update('mfa', U, (d) => { const x = ((d as DocMfa | null) ?? {}); return { ...x, totp: { ...x.totp!, confirmado: true, ultimoPasso: passo }, recuperacao: codigos.map((c) => ({ h: hashRecuperacao(cfg.pimenta, c), usado: false })) } as never; });
          aud(rid, ip, U, 'portal.mfa.totp_cadastro'); const c = reemitir(sess, { m: seg() });
          return html(res, 200, pagina('Segundo fator ativo', `<div class="card"><p class="ok">Aplicativo autenticador cadastrado.</p><p>Guarde estes <b>códigos de recuperação</b> em um lugar seguro. Cada um vale uma vez e eles não serão mostrados de novo:</p><p>${codigos.map((x) => `<code>${x}</code>`).join(' ')}</p><p><a href="${destino}">Continuar</a></p></div>`, nav), { 'set-cookie': cookie(c, Math.max(60, sess.e - seg())) }), true;
        }
        if (p === '/mfa/recuperacao' && post) {
          if (!ativa) return ir(res, '/mfa'), true; const codigos = novosCodigosRecuperacao();
          await cfg.store.update('mfa', U, (d) => ({ ...((d as DocMfa | null) ?? {}), recuperacao: codigos.map((c) => ({ h: hashRecuperacao(cfg.pimenta, c), usado: false })) }) as never); aud(rid, ip, U, 'portal.mfa.recuperacao_gerar');
          return html(res, 200, pagina('Novos códigos de recuperação', `<div class="card"><p>Os códigos antigos deixaram de valer. Guarde estes (não serão mostrados de novo):</p><p>${codigos.map((x) => `<code>${x}</code>`).join(' ')}</p><p><a href="/mfa">Voltar</a></p></div>`, nav)), true;
        }
        if (p === '/mfa/verificar' && post) {
          limite.consumir(`mf:${U}`, 10); const codigo = String(form.codigo ?? '');
          if (form.tipo === 'totp' && dm.totp?.confirmado) {
            const passo = verificarTotp(decifrar(cfg.pimenta, dm.totp.seg), codigo, seg(), dm.totp.ultimoPasso);
            if (passo !== null) { let aceito = false; await cfg.store.update('mfa', U, (d) => { const x = d as DocMfa | null; if (!x?.totp || x.totp.ultimoPasso >= passo) return x as never; aceito = true; return { ...x, totp: { ...x.totp, ultimoPasso: passo } } as never; }); if (aceito) { aud(rid, ip, U, 'portal.mfa.totp'); return concluir(); } }
          } else if (form.tipo === 'recuperacao') {
            const h = hashRecuperacao(cfg.pimenta, codigo); let usou = false;
            await cfg.store.update('mfa', U, (d) => { const x = d as DocMfa | null; const i = x?.recuperacao?.findIndex((r) => !r.usado && igual(r.h, h)) ?? -1; if (!x || i < 0) return x as never; usou = true; return { ...x, recuperacao: x.recuperacao!.map((r, k) => (k === i ? { ...r, usado: true } : r)) } as never; });
            if (usou) { aud(rid, ip, U, 'portal.mfa.recuperacao_usar'); return concluir(); }
          }
          aud(rid, ip, U, 'portal.mfa.verificar', 'negado'); return html(res, 400, pagina('Código incorreto', '<p class="no">O código não confere ou já foi usado.</p><p><a href="/mfa">Tentar de novo</a></p>', nav)), true;
        }
        // passkeys (JSON)
        if (p === '/mfa/passkey/opcoes' && post) {
          if (cadastrado(dm) && !ativa) return jsonOk(res, 403, { ok: false, erro: 'Confirme o segundo fator antes.' }), true;
          const c = await novoDesafio(U, 'registro'); return jsonOk(res, 200, { challenge: c, rp: { id: rpId, name: 'Odin' }, user: { id: Buffer.from(U).toString('base64url'), name: await meuNome(U) } }), true;
        }
        if (p === '/mfa/passkey/registrar' && post) {
          limite.consumir(`mf:${U}`, 10);
          try {
            const dados = JSON.parse(String(form.dados ?? '{}')) as Record<string, string>; const desafio = await consumirDesafio(U, 'registro');
            const r = verificarRegistro({ clientDataJSON: dados.clientDataJSON ?? '', attestationObject: dados.attestationObject ?? '', desafio, origem, rpId });
            await cfg.store.update('mfa', U, (d) => { const x = ((d as DocMfa | null) ?? {}); return { ...x, passkeys: [...(x.passkeys ?? []).filter((k) => k.id !== r.id), { id: r.id, spki: r.spki, contador: r.contador, nome: 'Passkey', criadoEm: agora() }] } as never; });
            aud(rid, ip, U, 'portal.mfa.passkey_cadastro'); return jsonOk(res, 200, { ok: true }, { 'set-cookie': cookie(reemitir(sess, { m: seg() }), Math.max(60, sess.e - seg())) }), true;
          } catch (e) { aud(rid, ip, U, 'portal.mfa.passkey_cadastro', 'negado', e instanceof Error ? e.message : 'erro'); return jsonOk(res, 400, { ok: false, erro: 'A passkey não foi aceita.' }), true; }
        }
        if (p === '/mfa/passkey/desafio' && post) { const c = await novoDesafio(U, 'assercao'); return jsonOk(res, 200, { challenge: c, rpId, ids: (dm.passkeys ?? []).map((k) => k.id) }), true; }
        if (p === '/mfa/passkey/verificar' && post) {
          limite.consumir(`mf:${U}`, 10);
          try {
            const dados = JSON.parse(String(form.dados ?? '{}')) as Record<string, string>; const desafio = await consumirDesafio(U, 'assercao'); const k = (dm.passkeys ?? []).find((x) => x.id === dados.id); if (!k) throw new Error('passkey desconhecida');
            const novo = verificarAssercao({ clientDataJSON: dados.clientDataJSON ?? '', authenticatorData: dados.authenticatorData ?? '', assinatura: dados.assinatura ?? '', desafio, origem, rpId, spki: k.spki, contadorAnterior: k.contador });
            await cfg.store.update('mfa', U, (d) => { const x = d as DocMfa | null; return x ? ({ ...x, passkeys: (x.passkeys ?? []).map((y) => (y.id === k.id ? { ...y, contador: novo } : y)) } as never) : x as never; });
            aud(rid, ip, U, 'portal.mfa.passkey'); return jsonOk(res, 200, { ok: true, destino }, { 'set-cookie': cookie(reemitir(sess, { m: seg() }), Math.max(60, sess.e - seg())) }), true;
          } catch (e) { aud(rid, ip, U, 'portal.mfa.passkey', 'negado', e instanceof Error ? e.message : 'erro'); return jsonOk(res, 400, { ok: false, erro: 'A passkey não foi aceita.' }), true; }
        }
        return html(res, 404, pagina('Não encontrado', '<p>Página inexistente.</p>', nav)), true;
      }

      if (p === '/' && req.method === 'GET') return html(res, 200, pagina('Odin', `<div class="card"><p><b>Administração</b>: quem cuida do acesso, das skills e do conhecimento.</p><p><a href="/admin">Entrar como administrador</a></p></div><div class="card"><p><b>Entrar com a sua conta</b></p>${botaoGithub || '<p>Em breve.</p>'}</div><div class="card"><p><b>Pessoas</b>: use o link de convite que um administrador enviou para você. No terminal, rode <code>odin setup</code> e informe o código aqui, em <b>Minha conta</b>.</p></div>`)), true;
      if (p === '/sair' && post) { aud(rid, ip, sess?.s ?? 'anonimo', 'portal.saida'); return ir(res, '/', { 'set-cookie': cookie('', 0) }), true; }

      // ---- login com GitHub ----
      if (p === '/auth/github/login' && req.method === 'GET') {
        if (!gh) return html(res, 404, pagina('Login com GitHub', '<p>O login com GitHub ainda não está configurado.</p>')), true;
        limite.consumir(`gl:${ip}`, 20); const estado = randomBytes(18).toString('base64url');
        const u = new URL('https://github.com/login/oauth/authorize'); u.search = new URLSearchParams({ client_id: gh.clientId, redirect_uri: callbackUrl, scope: 'read:user', state: estado, allow_signup: 'false' }).toString();
        res.writeHead(302, { location: u.toString(), 'set-cookie': cookieEstado(`${estado}.${assinar(`estado:${estado}`)}`, 600), 'cache-control': 'no-store' }); res.end(); return true;
      }
      if (p === '/auth/github/callback' && req.method === 'GET') {
        if (!gh) return html(res, 404, pagina('Login com GitHub', '<p>O login com GitHub ainda não está configurado.</p>')), true;
        limite.consumir(`gc:${ip}`, 20);
        const c = (req.headers.cookie ?? '').split(/;\s*/).find((x) => x.startsWith('odin_oauth='))?.slice('odin_oauth='.length) ?? ''; const [est, sg] = c.split('.');
        const negar = (motivo: string, msg: string) => { aud(rid, ip, 'anonimo', 'portal.github_login', 'negado', motivo); return html(res, 400, pagina('Não foi possível entrar', `<p class="no">${esc(msg)}</p><p><a href="/">Voltar ao início</a></p>`), { 'set-cookie': cookieEstado('', 0) }), true; };
        if (!est || !sg || !igual(sg, assinar(`estado:${est}`)) || !igual(est, String(url.searchParams.get('state') ?? ''))) return negar('estado', 'A tentativa de login não é válida ou expirou. Comece de novo.');
        const code = String(url.searchParams.get('code') ?? ''); if (!code) return negar('sem_codigo', 'O GitHub não autorizou o login.');
        let gid = 0, glogin = '';
        try {
          const tr = await http('https://github.com/login/oauth/access_token', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ client_id: gh.clientId, client_secret: gh.clientSecret, code, redirect_uri: callbackUrl }) });
          const tk = (await tr.json()) as { access_token?: string; error?: string }; if (!tk.access_token) return negar(String(tk.error ?? 'troca'), 'O GitHub recusou o código de login.');
          const ur = await http('https://api.github.com/user', { headers: { authorization: `Bearer ${tk.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'odin-portal' } });
          const u = (await ur.json()) as { id?: number; login?: string }; gid = Number(u.id ?? 0); glogin = String(u.login ?? ''); if (!gid || !glogin) return negar('usuario', 'Não foi possível ler a sua conta do GitHub.');
        } catch { return negar('rede', 'Não foi possível falar com o GitHub agora. Tente de novo.'); }
        const todos = await cfg.store.list('users'); let pessoa = todos.find((x) => Number(x.githubId) === gid);
        if (!pessoa) { pessoa = todos.find((x) => Number(x.githubId) === 0 && String(x.githubLogin ?? '').toLowerCase() === glogin.toLowerCase()); if (pessoa) await cfg.store.update('users', pessoa.id, (x) => (x ? { ...x, githubId: gid, githubLogin: glogin } : null)); }
        if (!pessoa || pessoa.status !== 'ativo') { aud(rid, ip, `gh:${gid}`, 'portal.github_login', 'negado', 'nao_cadastrado'); return html(res, 403, pagina('Acesso não liberado', `<p class="no">A conta GitHub <b>${esc(glogin)}</b> não está cadastrada no Odin. Peça a um administrador para criar a sua pessoa com este login.</p><p><a href="/">Voltar ao início</a></p>`), { 'set-cookie': cookieEstado('', 0) }), true; }
        const eAdmin = (await perfisDe(pessoa.id)).includes('mantenedor'); const ttl = eAdmin ? 2 * 3600 : 8 * 3600; const destino = eAdmin ? '/admin' : '/conta';
        aud(rid, ip, pessoa.id, 'portal.github_login');
        // 200 com atualização automática (e não 303): o cookie Strict só vale em navegação iniciada pelo próprio site.
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': CSP, 'set-cookie': [cookie(criarSessao(eAdmin ? 'admin' : 'usuario', pessoa.id, ttl), ttl), cookieEstado('', 0)] });
        res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${destino}"><title>Entrando</title><p>Entrando… <a href="${destino}">Continuar</a></p></html>`); return true;
      }

      // ---- convite de pessoa ----
      if (p === '/convite') {
        limite.consumir(`cv:${ip}`, 20); const t = String(url.searchParams.get('t') ?? form.t ?? ''); const h = hashConvite(t);
        const conv = t ? (await cfg.store.list('invites', (c) => c.hash === h))[0] : undefined;
        const valido = !!conv && !conv.usado && Number(conv.expiraEm) > agora();
        if (req.method === 'GET') return html(res, valido ? 200 : 400, pagina('Convite', valido ? `<p>Você foi convidado para o Odin. Confirme para entrar.</p><form method="post" action="/convite"><input type="hidden" name="t" value="${esc(t)}"><button>Entrar</button></form>` : '<p class="no">Este convite é inválido, já foi usado ou expirou. Peça um novo a um administrador.</p>')), true;
        if (!valido) { aud(rid, ip, 'anonimo', 'portal.convite', 'negado'); return html(res, 400, pagina('Convite', '<p class="no">Este convite é inválido, já foi usado ou expirou.</p>')), true; }
        await cfg.store.update('invites', conv!.id, (c) => (c ? { ...c, usado: true, usadoEm: agora() } : null));
        aud(rid, ip, String(conv!.userId), 'portal.convite'); return ir(res, '/conta', { 'set-cookie': cookie(criarSessao('usuario', String(conv!.userId), 8 * 3600), 8 * 3600) }), true;
      }

      // ---- administração ----
      if (p === '/admin/entrar' && post) {
        limite.consumir(`ad:${ip}`, 8);
        if (!igual(String(form.segredo ?? ''), cfg.adminSegredo)) { aud(rid, ip, 'anonimo', 'portal.admin_login', 'negado'); return html(res, 403, pagina('Administração', '<p class="no">Segredo incorreto.</p><p><a href="/admin">Tentar de novo</a></p>')), true; }
        aud(rid, ip, 'admin', 'portal.admin_login'); return ir(res, '/admin', { 'set-cookie': cookie(criarSessao('admin', 'admin', 2 * 3600), 2 * 3600) }), true;
      }
      if (p === '/admin' || p.startsWith('/admin/')) {
        if (!sess || sess.p !== 'admin') return html(res, 200, pagina('Administração', `<form method="post" action="/admin/entrar"><p><label>Segredo de administração<br><input name="segredo" type="password" required autocomplete="off"></label></p><button>Entrar</button></form>${botaoGithub ? `<hr><p>Ou entre com a sua conta:</p>${botaoGithub}` : ''}<p><small>O segredo é o acesso de emergência; o login com GitHub usa a verificação em duas etapas da sua conta do GitHub.</small></p>`)), true;
        const nav = navAdmin(sess.c); const A = sess.s;
        if (p === '/admin' && !post) {
          const [u, d, pr, sk] = await Promise.all([cfg.store.list('users'), cfg.store.list('devices'), cfg.store.list('proposals', (x) => x.status === 'na_fila'), cfg.store.list('catalog_skills')]);
          return html(res, 200, pagina('Painel', `<div class="card"><p>Pessoas ativas: <b>${u.filter((x) => x.status === 'ativo').length}</b> de ${u.length} · Dispositivos ativos: <b>${d.filter((x) => x.status === 'ativo').length}</b> · Skills no catálogo: <b>${sk.length}</b> · Propostas na fila: <b>${pr.length}</b></p></div>
<div class="card"><p><b>Encerrar todas as sessões</b> (emergência): todos os dispositivos precisam ativar de novo.</p><form method="post" action="/admin/global">${csrf(sess)}<button class="p">Revogação global</button></form></div>`, nav)), true;
        }
        if (p === '/admin/global' && post) { await revogacaoGlobal(cfg.store, agora()); aud(rid, ip, A, 'admin.revogacao_global'); return ir(res, '/admin'), true; }
        if (p === '/admin/pessoas' && !post) {
          const [us, ms, ds, perfis, squads] = await Promise.all([cfg.store.list('users'), cfg.store.list('memberships'), cfg.store.list('devices'), cfg.store.list('profiles'), cfg.store.list('squads')]);
          const linhas = us.map((u) => `<tr><td>${esc(u.nome)}<br><small>${esc(u.githubLogin)}</small></td><td>${esc(ms.filter((m) => m.userId === u.id).flatMap((m) => (m.perfis as string[]) ?? []).join(', ') || '—')}</td><td class="${u.status === 'ativo' ? 'ok' : 'no'}">${esc(u.status)}</td><td>${ds.filter((x) => x.userId === u.id && x.status === 'ativo').length}</td><td><form method="post" action="/admin/pessoas/acao" style="display:flex;gap:4px;flex-wrap:wrap">${csrf(sess)}<input type="hidden" name="id" value="${esc(u.id)}"><button name="acao" value="convite">Convite</button><button name="acao" value="resetar_mfa" class="p">Zerar 2º fator</button><button name="acao" value="${u.status === 'ativo' ? 'suspender' : 'reativar'}" class="${u.status === 'ativo' ? 'p' : ''}">${u.status === 'ativo' ? 'Suspender' : 'Reativar'}</button></form></td></tr>`).join('');
          return html(res, 200, pagina('Pessoas', `<table><tr><th>Pessoa</th><th>Perfis</th><th>Situação</th><th>Dispositivos</th><th>Ações</th></tr>${linhas}</table>
<div class="card"><h2>Nova pessoa</h2><form method="post" action="/admin/pessoas/criar">${csrf(sess)}<p><label>Nome<br><input name="nome" required maxlength="80"></label></p><p><label>Login do GitHub (opcional)<br><input name="login" maxlength="40" pattern="[A-Za-z0-9-]*"></label></p><p><label>Squad<br><select name="squad">${squads.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('')}</select></label></p><p><label>Perfil<br><select name="perfil">${perfis.map((s) => `<option>${esc(s.id)}</option>`).join('')}</select></label></p><button>Criar e gerar convite</button></form></div>`, nav)), true;
        }
        const conviteNovo = async (userId: string): Promise<string> => { const t = randomBytes(24).toString('base64url'); await cfg.store.set('invites', `inv_${randomBytes(6).toString('hex')}`, { userId, hash: hashConvite(t), expiraEm: agora() + 72 * 3600_000, usado: false, criadoEm: agora() }); return `${cfg.emissor}/convite?t=${t}`; };
        const mostrarConvite = (link: string, nome: string) => html(res, 200, pagina('Convite criado', `<div class="card"><p>Convite para <b>${esc(nome)}</b> (uso único, vale 72 horas). Copie agora; ele não será mostrado de novo:</p><p><code>${esc(link)}</code></p></div><p><a href="/admin/pessoas">Voltar às pessoas</a></p>`, nav));
        if (p === '/admin/pessoas/criar' && post) {
          const nome = String(form.nome ?? '').trim(); if (!nome || nome.length > 80) throw new OdinErro('invalido', 'Informe o nome.');
          if (!(await cfg.store.get('profiles', String(form.perfil))) || !(await cfg.store.get('squads', String(form.squad)))) throw new OdinErro('invalido', 'Perfil ou squad inexistente.');
          const id = `usr_${randomBytes(6).toString('hex')}`;
          await cfg.store.set('users', id, { githubId: 0, githubLogin: String(form.login ?? '').slice(0, 40), nome, status: 'ativo', policyVersion: 1, criadoEm: agora() });
          await cfg.store.set('memberships', `${id}_${form.squad}`, { userId: id, squadId: String(form.squad), perfis: [String(form.perfil)], origem: 'portal' });
          aud(rid, ip, A, 'admin.pessoa.criar', 'ok', id); return mostrarConvite(await conviteNovo(id), nome), true;
        }
        if (p === '/admin/pessoas/acao' && post) {
          const id = String(form.id ?? ''); const u = await cfg.store.get('users', id); if (!u) throw new OdinErro('invalido', 'Pessoa inexistente.');
          if (form.acao === 'suspender') { await suspenderPessoa(cfg.store, id); aud(rid, ip, A, 'admin.pessoa.suspender', 'ok', id); }
          else if (form.acao === 'reativar') { await cfg.store.update('users', id, (x) => (x ? { ...x, status: 'ativo', policyVersion: Number(x.policyVersion) + 1 } : null)); aud(rid, ip, A, 'admin.pessoa.reativar', 'ok', id); }
          else if (form.acao === 'resetar_mfa') { await cfg.store.delete('mfa', id); aud(rid, ip, A, 'admin.pessoa.resetar_mfa', 'ok', id); }
          else if (form.acao === 'convite') { if (u.status !== 'ativo') throw new OdinErro('invalido', 'Reative a pessoa antes de convidar.'); aud(rid, ip, A, 'admin.convite.criar', 'ok', id); return mostrarConvite(await conviteNovo(id), String(u.nome)), true; }
          return ir(res, '/admin/pessoas'), true;
        }
        if (p === '/admin/dispositivos' && !post) {
          const [ds, us] = await Promise.all([cfg.store.list('devices'), cfg.store.list('users')]); const nome = (id: unknown) => us.find((u) => u.id === id)?.nome ?? id;
          return html(res, 200, pagina('Dispositivos', `<table><tr><th>Dispositivo</th><th>Pessoa</th><th>Sistema</th><th>Último uso</th><th>Situação</th><th></th></tr>${ds.map((d) => `<tr><td>${esc(d.nome)}<br><small>${esc(d.id)}</small></td><td>${esc(nome(d.userId))}</td><td>${esc(d.so)}</td><td>${dt(d.ultimoUso)}</td><td class="${d.status === 'ativo' ? 'ok' : 'no'}">${esc(d.status)}</td><td>${d.status === 'ativo' ? `<form method="post" action="/admin/dispositivos/revogar">${csrf(sess)}<input type="hidden" name="id" value="${esc(d.id)}"><button class="p">Revogar</button></form>` : ''}</td></tr>`).join('')}</table>`, nav)), true;
        }
        if (p === '/admin/dispositivos/revogar' && post) { await revogarDispositivo(cfg.store, String(form.id ?? '')); aud(rid, ip, A, 'admin.dispositivo.revogar', 'ok', String(form.id)); return ir(res, '/admin/dispositivos'), true; }
        if (p === '/admin/skills' && !post) {
          const [sk, pf] = await Promise.all([cfg.store.list('catalog_skills'), cfg.store.list('profiles')]);
          return html(res, 200, pagina('Skills', `<table><tr><th>Skill</th><th>Etapa</th><th>beta</th><th>stable</th><th>Perfis com acesso</th></tr>${sk.sort((a, b) => Number(a.etapa) - Number(b.etapa)).map((s) => { const c = (s.canais ?? {}) as Record<string, string>; return `<tr><td>${esc(s.nome)}<br><small>${esc(s.id)}</small></td><td>${esc(s.etapa)}</td><td>${esc(c.beta ?? '—')}</td><td>${esc(c.stable ?? '—')}</td><td>${esc(pf.filter((x) => ((x.skills as string[]) ?? []).includes(s.id)).map((x) => x.id).join(', '))}</td></tr>`; }).join('')}</table>`, nav)), true;
        }
        if (p === '/admin/propostas' && !post) {
          const pr = await cfg.store.list('proposals', (x) => x.status === 'na_fila');
          return html(res, 200, pagina('Propostas de conhecimento', pr.length ? pr.map((x) => `<div class="card"><p><b>${esc(x.tipo)}</b> · coleção ${esc(x.colecao)} · projeto ${esc(x.projeto)} · fonte ${esc(x.fonte)} · ${dt(x.criadaEm)}</p><p>${esc(x.texto)}</p><form method="post" action="/admin/propostas/decidir" style="display:flex;gap:6px">${csrf(sess)}<input type="hidden" name="id" value="${esc(x.id)}"><button name="decisao" value="aprovar">Aprovar</button><button name="decisao" value="rejeitar" class="p">Rejeitar</button></form></div>`).join('') : '<p>Nenhuma proposta na fila.</p>', nav)), true;
        }
        if (p === '/admin/propostas/decidir' && post) {
          const id = String(form.id ?? ''); const x = await cfg.store.get('proposals', id); if (!x || x.status !== 'na_fila') throw new OdinErro('invalido', 'Proposta inexistente ou já decidida.');
          if (form.decisao === 'aprovar') { await kb.ingerir({ documento: `PROPOSTA-${id}`, secao: String(x.tipo), colecao: String(x.colecao), projeto: String(x.projeto), texto: String(x.texto), versao: '1' } as never); await cfg.store.update('proposals', id, (y) => (y ? { ...y, status: 'aprovada', decididaEm: agora() } : null)); aud(rid, ip, A, 'admin.proposta.aprovar', 'ok', id); }
          else { await cfg.store.update('proposals', id, (y) => (y ? { ...y, status: 'rejeitada', decididaEm: agora() } : null)); aud(rid, ip, A, 'admin.proposta.rejeitar', 'ok', id); }
          return ir(res, '/admin/propostas'), true;
        }
        return html(res, 404, pagina('Não encontrado', '<p>Página inexistente.</p>', nav)), true;
      }

      // ---- conta da pessoa ----
      if (p === '/conta' || p.startsWith('/conta/')) {
        if (!sess || sess.p !== 'usuario') return ir(res, '/'), true;
        const u = await cfg.store.get('users', sess.s); if (!u || u.status !== 'ativo') return html(res, 403, pagina('Conta', '<p class="no">Seu acesso está suspenso. Fale com um administrador.</p>')), true;
        const nav = navConta(sess.c);
        if (p === '/conta' && !post) {
          const [ds, sk, perfis] = await Promise.all([cfg.store.list('devices', (d) => d.userId === sess.s), skillsDe(sess.s), perfisDe(sess.s)]);
          return html(res, 200, pagina(`Olá, ${u.nome}`, `<div class="card"><h2>Ativar um dispositivo</h2><p>No terminal, rode <code>odin setup</code> e digite aqui o código que aparecer.</p><form method="post" action="/conta/ativar">${csrf(sess)}<input name="code" required placeholder="ABCD-EFGH" maxlength="12" style="font:20px monospace" autocomplete="off"> <button>Ativar</button></form></div>
<div class="card"><h2>Meus dispositivos</h2>${ds.length ? `<table><tr><th>Nome</th><th>Sistema</th><th>Último uso</th><th>Situação</th><th></th></tr>${ds.map((d) => `<tr><td>${esc(d.nome)}</td><td>${esc(d.so)}</td><td>${dt(d.ultimoUso)}</td><td class="${d.status === 'ativo' ? 'ok' : 'no'}">${esc(d.status)}</td><td>${d.status === 'ativo' ? `<form method="post" action="/conta/dispositivos/revogar">${csrf(sess)}<input type="hidden" name="id" value="${esc(d.id)}"><button class="p">Revogar</button></form>` : ''}</td></tr>`).join('')}</table>` : '<p>Nenhum dispositivo ainda.</p>'}</div>
<div class="card"><h2>Minhas skills</h2><p>Perfis: ${esc(perfis.join(', ') || '—')}</p>${sk.length ? `<table><tr><th>Skill</th><th>Canal</th><th>Versão</th></tr>${sk.map((s) => `<tr><td>${esc(s.nome)}<br><small>${esc(s.id)}</small></td><td>${esc(s.canal)}</td><td>${esc(s.versao || 'ainda não publicada')}</td></tr>`).join('')}</table>` : '<p>Nenhuma skill liberada para o seu perfil.</p>'}</div>`, nav)), true;
        }
        if (p === '/conta/ativar' && post) {
          limite.consumir(`ac:${sess.s}`, 10);
          try { const d = await cfg.aprovarDispositivo(String(form.code ?? ''), sess.s); aud(rid, ip, sess.s, 'portal.dispositivo.ativar'); return html(res, 200, pagina('Dispositivo ativado', `<p class="ok">Dispositivo "${esc(d.nome)}" ativado. Volte ao terminal.</p><p><a href="/conta">Minha conta</a></p>`, nav)), true; }
          catch (e) { aud(rid, ip, sess.s, 'portal.dispositivo.ativar', 'negado'); return html(res, 400, pagina('Não foi possível ativar', `<p class="no">${esc(paraOdinErro(e).message)}</p><p><a href="/conta">Voltar</a></p>`, nav)), true; }
        }
        if (p === '/conta/dispositivos/revogar' && post) {
          const d = await cfg.store.get('devices', String(form.id ?? '')); if (!d || d.userId !== sess.s) throw new OdinErro('sem_acesso', 'Este dispositivo não é seu.');
          await revogarDispositivo(cfg.store, String(form.id)); aud(rid, ip, sess.s, 'portal.dispositivo.revogar', 'ok', String(form.id)); return ir(res, '/conta'), true;
        }
      }
      return html(res, 404, pagina('Não encontrado', '<p>Página inexistente.</p>')), true;
    } catch (e) {
      const err = paraOdinErro(e);
      html(res, err.http, pagina('Não foi possível concluir', `<p class="no">${esc(err.message)}</p><p><a href="/">Voltar ao início</a></p>`)); return true;
    }
  }
  return { handler };
}
