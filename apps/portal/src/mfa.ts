// F2: segundo fator do portal. TOTP (RFC 6238), códigos de recuperação e passkey (WebAuthn, ES256, atestação "none").
// Só usa node:crypto (sem dependências). Detalhes e limites: ADR 0026.
import { createCipheriv, createDecipheriv, createHash, createHmac, createPublicKey, hkdfSync, randomBytes, timingSafeEqual, verify } from 'node:crypto';

// ---------- TOTP ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const base32 = (b: Buffer): string => { let bits = 0, v = 0, o = ''; for (const x of b) { v = (v << 8) | x; bits += 8; while (bits >= 5) { o += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += B32[(v << (5 - bits)) & 31]; return o; };
export const base32Decodificar = (s: string): Buffer => { let bits = 0, v = 0; const o: number[] = []; for (const c of s) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
export const novoSegredoTotp = (): Buffer => randomBytes(20);
export function codigoTotp(segredo: Buffer, passo: number): string {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(passo)); const h = createHmac('sha1', segredo).update(c).digest(); const o = h[19]! & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
const igual = (a: string, b: string): boolean => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
/** Aceita o passo atual e o vizinho (±30 s); recusa passo já usado (anti-repetição). Devolve o passo aceito ou null. */
export function verificarTotp(segredo: Buffer, codigo: string, agoraS: number, ultimoPasso: number): number | null {
  const limpo = codigo.replace(/\s/g, ''); if (!/^\d{6}$/.test(limpo)) return null; const atual = Math.floor(agoraS / 30);
  for (const p of [atual, atual - 1, atual + 1]) if (p > ultimoPasso && igual(codigoTotp(segredo, p), limpo)) return p;
  return null;
}
export const uriTotp = (conta: string, segredo: Buffer): string => `otpauth://totp/Odin:${encodeURIComponent(conta)}?secret=${base32(segredo)}&issuer=Odin&algorithm=SHA1&digits=6&period=30`;

// O segredo TOTP fica cifrado (AES-256-GCM, chave derivada da pimenta do serviço) no documento `mfa` da pessoa.
const chaveCampo = (pimenta: string): Buffer => Buffer.from(hkdfSync('sha256', pimenta, 'odin-mfa', 'totp-v1', 32));
export function cifrar(pimenta: string, texto: Buffer): string { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', chaveCampo(pimenta), iv); const ct = Buffer.concat([c.update(texto), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url'); }
export function decifrar(pimenta: string, b64: string): Buffer { const b = Buffer.from(b64, 'base64url'); const d = createDecipheriv('aes-256-gcm', chaveCampo(pimenta), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]); }

// ---------- códigos de recuperação ----------
export const hashRecuperacao = (pimenta: string, codigo: string): string => createHmac('sha256', pimenta).update(`recuperacao:${codigo.replace(/[\s-]/g, '').toLowerCase()}`).digest('hex');
export function novosCodigosRecuperacao(n = 10): string[] { return Array.from({ length: n }, () => { const s = randomBytes(8).toString('hex').slice(0, 10); return `${s.slice(0, 5)}-${s.slice(5)}`; }); }

// ---------- CBOR mínimo (só o que o WebAuthn usa) ----------
export type Cbor = number | bigint | string | Buffer | Cbor[] | Map<Cbor, Cbor>;
export function cborDecodificar(b: Buffer, inicio = 0): { v: Cbor; fim: number } {
  let i = inicio; const ib = b[i++]!; const maior = ib >> 5; const ai = ib & 31;
  const arg = (): number => { if (ai < 24) return ai; if (ai === 24) return b[i++]!; if (ai === 25) { const x = b.readUInt16BE(i); i += 2; return x; } if (ai === 26) { const x = b.readUInt32BE(i); i += 4; return x; } throw new Error('cbor: tamanho não suportado'); };
  if (maior === 0) return { v: arg(), fim: i };
  if (maior === 1) return { v: -1 - arg(), fim: i };
  if (maior === 2 || maior === 3) { const n = arg(); const d = b.subarray(i, i + n); if (d.length !== n) throw new Error('cbor: truncado'); i += n; return { v: maior === 2 ? Buffer.from(d) : d.toString('utf8'), fim: i }; }
  if (maior === 4) { const n = arg(); const l: Cbor[] = []; for (let k = 0; k < n; k++) { const r = cborDecodificar(b, i); l.push(r.v); i = r.fim; } return { v: l, fim: i }; }
  if (maior === 5) { const n = arg(); const m = new Map<Cbor, Cbor>(); for (let k = 0; k < n; k++) { const kk = cborDecodificar(b, i); const vv = cborDecodificar(b, kk.fim); m.set(kk.v, vv.v); i = vv.fim; } return { v: m, fim: i }; }
  throw new Error('cbor: tipo não suportado');
}
export function cborCodificar(v: Cbor): Buffer {
  const cab = (maior: number, n: number): Buffer => (n < 24 ? Buffer.from([(maior << 5) | n]) : n < 256 ? Buffer.from([(maior << 5) | 24, n]) : Buffer.from([(maior << 5) | 25, n >> 8, n & 255]));
  if (typeof v === 'number') return v >= 0 ? cab(0, v) : cab(1, -1 - v);
  if (typeof v === 'string') { const d = Buffer.from(v); return Buffer.concat([cab(3, d.length), d]); }
  if (Buffer.isBuffer(v)) return Buffer.concat([cab(2, v.length), v]);
  if (Array.isArray(v)) return Buffer.concat([cab(4, v.length), ...v.map(cborCodificar)]);
  if (v instanceof Map) return Buffer.concat([cab(5, v.size), ...[...v].flatMap(([k, x]) => [cborCodificar(k), cborCodificar(x)])]);
  throw new Error('cbor: tipo não suportado');
}

// ---------- WebAuthn ----------
export const sha256 = (b: Buffer | string): Buffer => createHash('sha256').update(b).digest();
const FLAG_UP = 0x01, FLAG_UV = 0x04, FLAG_AT = 0x40;
function conferirClientData(json: Buffer, tipo: 'webauthn.create' | 'webauthn.get', desafio: string, origem: string): void {
  let c: { type?: string; challenge?: string; origin?: string }; try { c = JSON.parse(json.toString('utf8')); } catch { throw new Error('clientDataJSON inválido'); }
  if (c.type !== tipo) throw new Error('tipo de operação inesperado'); if (c.challenge !== desafio) throw new Error('desafio diferente'); if (c.origin !== origem) throw new Error('origem diferente');
}
export interface Passkey { id: string; spki: string; contador: number; nome: string; criadoEm: number }
/** Registro: valida desafio, origem, rpId, presença+verificação do usuário; aceita só atestação "none" e chave ES256. */
export function verificarRegistro(a: { clientDataJSON: string; attestationObject: string; desafio: string; origem: string; rpId: string }): { id: string; spki: string; contador: number } {
  conferirClientData(Buffer.from(a.clientDataJSON, 'base64url'), 'webauthn.create', a.desafio, a.origem);
  const att = cborDecodificar(Buffer.from(a.attestationObject, 'base64url')).v; if (!(att instanceof Map) || att.get('fmt') !== 'none') throw new Error('atestação não suportada (use "none")');
  const ad = att.get('authData'); if (!Buffer.isBuffer(ad) || ad.length < 55) throw new Error('authData inválido');
  if (!ad.subarray(0, 32).equals(sha256(a.rpId))) throw new Error('rpId diferente'); const f = ad[32]!; if (!(f & FLAG_UP) || !(f & FLAG_UV) || !(f & FLAG_AT)) throw new Error('exige presença e verificação do usuário');
  const contador = ad.readUInt32BE(33); const n = ad.readUInt16BE(53); const id = ad.subarray(55, 55 + n); const cose = cborDecodificar(ad, 55 + n).v;
  if (!(cose instanceof Map) || cose.get(1) !== 2 || cose.get(3) !== -7 || cose.get(-1) !== 1) throw new Error('somente ES256 (P-256)');
  const x = cose.get(-2), y = cose.get(-3); if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y) || x.length !== 32 || y.length !== 32) throw new Error('chave inválida');
  const spki = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url') }, format: 'jwk' }).export({ type: 'spki', format: 'der' }).toString('base64url');
  return { id: id.toString('base64url'), spki, contador };
}
/** Autenticação: confere desafio, origem, rpId, UP+UV, assinatura e contador crescente. Devolve o novo contador. */
export function verificarAssercao(a: { clientDataJSON: string; authenticatorData: string; assinatura: string; desafio: string; origem: string; rpId: string; spki: string; contadorAnterior: number }): number {
  const cd = Buffer.from(a.clientDataJSON, 'base64url'); conferirClientData(cd, 'webauthn.get', a.desafio, a.origem);
  const ad = Buffer.from(a.authenticatorData, 'base64url'); if (ad.length < 37) throw new Error('authenticatorData inválido');
  if (!ad.subarray(0, 32).equals(sha256(a.rpId))) throw new Error('rpId diferente'); const f = ad[32]!; if (!(f & FLAG_UP) || !(f & FLAG_UV)) throw new Error('exige presença e verificação do usuário');
  const chave = createPublicKey({ key: Buffer.from(a.spki, 'base64url'), format: 'der', type: 'spki' });
  if (!verify('sha256', Buffer.concat([ad, sha256(cd)]), chave, Buffer.from(a.assinatura, 'base64url'))) throw new Error('assinatura inválida');
  const contador = ad.readUInt32BE(33); if ((contador !== 0 || a.contadorAnterior !== 0) && contador <= a.contadorAnterior) throw new Error('contador não avançou (possível clone)');
  return contador;
}
