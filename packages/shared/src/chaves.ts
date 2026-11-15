// Assinatura ES256 (ECDSA P-256 + SHA-256) atrás de uma interface: chave local no desenvolvimento,
// Cloud KMS na nuvem. A chave privada nunca sai do assinador.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign as nodeSign, verify as nodeVerify, type KeyObject } from 'node:crypto';

export interface Jwk { kty?: string; crv?: string; x?: string; y?: string }

export interface ChavePublica { kid: string; jwk: Jwk }
export interface Assinador {
  readonly kid: string;
  /** Assinatura no formato IEEE P1363 (r||s, 64 bytes), como o JWS exige. */
  assinar(dados: Uint8Array): Promise<Uint8Array>;
  publica(): ChavePublica;
}

export class AssinadorLocal implements Assinador {
  readonly kid: string;
  private privada: KeyObject;
  constructor(kid: string, pemPrivado: string) { this.kid = kid; this.privada = createPrivateKey(pemPrivado); }
  static gerar(kid: string): { assinador: AssinadorLocal; pem: string } {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    return { assinador: new AssinadorLocal(kid, pem), pem };
  }
  async assinar(dados: Uint8Array): Promise<Uint8Array> { return nodeSign('sha256', dados, { key: this.privada, dsaEncoding: 'ieee-p1363' }); }
  publica(): ChavePublica {
    const { kty, crv, x, y } = createPublicKey(this.privada).export({ format: 'jwk' });
    return { kid: this.kid, jwk: { kty, crv, x, y } };
  }
}

export function verificarAssinatura(jwk: Jwk, dados: Uint8Array, assinatura: Uint8Array): boolean {
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || assinatura.length !== 64) return false;
  try { return nodeVerify('sha256', dados, { key: createPublicKey({ key: jwk as Record<string, string>, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, assinatura); } catch { return false; }
}

export const sha256hex = (d: Uint8Array | string): string => createHash('sha256').update(d).digest('hex');
export const b64u = (d: Uint8Array | string): string => Buffer.from(d).toString('base64url');
export const deB64u = (s: string): Buffer => Buffer.from(s, 'base64url');

/** JSON canônico (chaves ordenadas, sem espaços): base da assinatura do manifesto. */
export function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
