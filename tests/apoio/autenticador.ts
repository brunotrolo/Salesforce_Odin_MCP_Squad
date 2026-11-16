// Autenticador de software (apenas para testes e homologação): faz o papel da passkey do navegador.
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { cborCodificar, sha256 } from '../../apps/portal/src/mfa.ts';

export class AutenticadorSoft {
  private par = generateKeyPairSync('ec', { namedCurve: 'P-256' }); readonly id = randomBytes(16); contador = 0;
  private rpId: string; private origem: string;
  constructor(rpId: string, origem: string) { this.rpId = rpId; this.origem = origem; }
  private cd(tipo: string, desafio: string, origem = this.origem) { return Buffer.from(JSON.stringify({ type: tipo, challenge: desafio, origin: origem })); }
  private ad(flags: number, cred?: Buffer): Buffer { const c = Buffer.alloc(4); c.writeUInt32BE(this.contador); return Buffer.concat([sha256(this.rpId), Buffer.from([flags]), c, ...(cred ? [cred] : [])]); }
  registrar(desafio: string, opcoes: { origem?: string; flags?: number } = {}) {
    const jwk = this.par.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    const cose = cborCodificar(new Map<number, number | Buffer>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
    const n = Buffer.alloc(2); n.writeUInt16BE(this.id.length);
    const authData = this.ad(opcoes.flags ?? 0x45, Buffer.concat([Buffer.alloc(16), n, this.id, cose]));
    const att = cborCodificar(new Map<string, string | Buffer | Map<string, string>>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    return { id: this.id.toString('base64url'), clientDataJSON: this.cd('webauthn.create', desafio, opcoes.origem).toString('base64url'), attestationObject: att.toString('base64url') };
  }
  assinar(desafio: string, opcoes: { origem?: string; flags?: number; naoAvancar?: boolean } = {}) {
    if (!opcoes.naoAvancar) this.contador++; const cd = this.cd('webauthn.get', desafio, opcoes.origem); const ad = this.ad(opcoes.flags ?? 0x05);
    return { id: this.id.toString('base64url'), clientDataJSON: cd.toString('base64url'), authenticatorData: ad.toString('base64url'), assinatura: sign('sha256', Buffer.concat([ad, sha256(cd)]), this.par.privateKey).toString('base64url') };
  }
}
