// JWT ES256 com validação estrita (segurança 03, seção 2.2). Algoritmo fixo: nunca none nem HS*.
import { b64u, deB64u, verificarAssinatura, type Assinador, type ChavePublica } from './chaves.ts';

export type Claims = Record<string, unknown> & { iss?: string; aud?: string | string[]; sub?: string; exp?: number; iat?: number; nbf?: number; jti?: string };
const ALGORITMO = 'ES256';

export async function assinarJwt(assinador: Assinador, claims: Claims, typ: string): Promise<string> {
  const cabecalho = { alg: ALGORITMO, typ, kid: assinador.kid };
  const entrada = `${b64u(JSON.stringify(cabecalho))}.${b64u(JSON.stringify(claims))}`;
  return `${entrada}.${b64u(await assinador.assinar(Buffer.from(entrada)))}`;
}

export interface OpcoesVerificacao { chaves: ChavePublica[]; typ: string; iss?: string; aud?: string[]; agora?: number; toleranciaS?: number; exigirKid?: boolean }
export class JwtInvalido extends Error {}

export function verificarJwt(token: string, o: OpcoesVerificacao): Claims {
  const partes = token.split('.');
  if (partes.length !== 3) throw new JwtInvalido('formato');
  let cab: Record<string, unknown>; let claims: Claims;
  try { cab = JSON.parse(deB64u(partes[0]!).toString('utf8')); claims = JSON.parse(deB64u(partes[1]!).toString('utf8')); } catch { throw new JwtInvalido('formato'); }
  if (cab.alg !== ALGORITMO) throw new JwtInvalido('alg');
  if (cab.typ !== o.typ) throw new JwtInvalido('typ');
  const candidatas = cab.kid ? o.chaves.filter((c) => c.kid === cab.kid) : o.exigirKid === false ? o.chaves : [];
  if (!candidatas.length) throw new JwtInvalido('kid');
  const dados = Buffer.from(`${partes[0]}.${partes[1]}`);
  if (!candidatas.some((c) => verificarAssinatura(c.jwk, dados, deB64u(partes[2]!)))) throw new JwtInvalido('assinatura');
  const agora = o.agora ?? Math.floor(Date.now() / 1000); const tol = o.toleranciaS ?? 5;
  if (typeof claims.exp !== 'number' || claims.exp <= agora - tol) throw new JwtInvalido('exp');
  if (typeof claims.nbf === 'number' && claims.nbf > agora + tol) throw new JwtInvalido('nbf');
  if (typeof claims.iat === 'number' && claims.iat > agora + tol) throw new JwtInvalido('iat');
  if (o.iss && claims.iss !== o.iss) throw new JwtInvalido('iss');
  if (o.aud) { const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]; if (!aud.some((a) => typeof a === 'string' && o.aud!.includes(a))) throw new JwtInvalido('aud'); }
  return claims;
}
