// Assinador sobre o Cloud KMS (ECDSA P-256 + SHA-256). A chave privada nunca sai do KMS.
// O KMS devolve a assinatura em DER; o JWS e o Odin usam o formato IEEE P1363 (r||s, 64 bytes).
import { createPublicKey } from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import type { Assinador, ChavePublica, Jwk } from '../chaves.ts';
import { sha256hex } from '../chaves.ts';
import { createHash } from 'node:crypto';

/** DER (SEQUENCE { INTEGER r, INTEGER s }) → r||s com 32 bytes cada. */
export function derParaP1363(der: Uint8Array): Uint8Array {
  const b = Buffer.from(der); let i = 0;
  if (b[i++] !== 0x30) throw new Error('assinatura DER inválida');
  const lenSeq = b[i++]!; if (lenSeq & 0x80) i += lenSeq & 0x7f;
  const inteiro = (): Buffer => {
    if (b[i++] !== 0x02) throw new Error('assinatura DER inválida');
    const n = b[i++]!; let v = b.subarray(i, i + n); i += n;
    while (v.length > 32 && v[0] === 0) v = v.subarray(1);
    if (v.length > 32) throw new Error('inteiro grande demais');
    return Buffer.concat([Buffer.alloc(32 - v.length), v]);
  };
  return Buffer.concat([inteiro(), inteiro()]);
}

export class AssinadorKms implements Assinador {
  readonly kid: string;
  private versao: string; private jwk: Jwk | null = null; private cliente: KeyManagementServiceClient;
  /** `versao` = projects/.../cryptoKeys/<chave>/cryptoKeyVersions/<n>. */
  constructor(kid: string, versao: string, cliente = new KeyManagementServiceClient()) { this.kid = kid; this.versao = versao; this.cliente = cliente; }
  async assinar(dados: Uint8Array): Promise<Uint8Array> {
    const digest = createHash('sha256').update(dados).digest();
    const [r] = await this.cliente.asymmetricSign({ name: this.versao, digest: { sha256: digest } });
    if (!r.signature) throw new Error('o KMS não devolveu assinatura');
    return derParaP1363(Buffer.from(r.signature as Uint8Array));
  }
  /** Chave pública (síncrona depois de `carregar`). */
  async carregar(): Promise<this> {
    const [pk] = await this.cliente.getPublicKey({ name: this.versao });
    const { kty, crv, x, y } = createPublicKey(String(pk.pem)).export({ format: 'jwk' });
    this.jwk = { kty, crv, x, y }; return this;
  }
  publica(): ChavePublica { if (!this.jwk) throw new Error('chame carregar() antes de publica()'); return { kid: this.kid, jwk: this.jwk }; }
  get hashDaChave(): string { return sha256hex(JSON.stringify(this.jwk)); }
}

/** Versão primária (a mais recente habilitada) de uma chave assimétrica. */
export async function versaoAtual(chave: string, cliente = new KeyManagementServiceClient()): Promise<string> {
  const [versoes] = await cliente.listCryptoKeyVersions({ parent: chave, filter: 'state=ENABLED', orderBy: 'name desc', pageSize: 1 });
  if (!versoes[0]?.name) throw new Error(`nenhuma versão habilitada em ${chave}`);
  return versoes[0].name;
}
