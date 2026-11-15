// Utilitários HTTP mínimos sobre node:http: leitura de JSON com limite, resposta, limite de taxa em memória.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { OdinErro } from './erros.ts';

export async function lerCorpo(req: IncomingMessage, limiteBytes = 256 * 1024): Promise<Buffer> {
  const partes: Buffer[] = []; let total = 0;
  for await (const p of req) { total += (p as Buffer).length; if (total > limiteBytes) throw new OdinErro('invalido', 'Corpo da requisição grande demais.'); partes.push(p as Buffer); }
  return Buffer.concat(partes);
}
export async function lerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const b = await lerCorpo(req);
  if (!b.length) return {};
  try { const v = JSON.parse(b.toString('utf8')); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch { /* cai no erro abaixo */ }
  throw new OdinErro('invalido', 'O corpo precisa ser um objeto JSON.');
}
export async function lerFormulario(req: IncomingMessage): Promise<Record<string, string>> {
  const tipo = req.headers['content-type'] ?? '';
  const b = (await lerCorpo(req)).toString('utf8');
  if (tipo.includes('application/json')) { try { return JSON.parse(b || '{}'); } catch { throw new OdinErro('invalido', 'JSON inválido.'); } }
  return Object.fromEntries(new URLSearchParams(b));
}
export function responder(res: ServerResponse, status: number, corpo?: unknown, cabecalhos: Record<string, string> = {}): void {
  const dados = corpo === undefined ? '' : typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  res.writeHead(status, { 'content-type': typeof corpo === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...cabecalhos });
  res.end(dados);
}
export const ipDe = (req: IncomingMessage): string => (String(req.headers['x-forwarded-for'] ?? '').split(',')[0]!.trim() || req.socket.remoteAddress || 'desconhecido');

/** Janela fixa de 1 minuto por chave, em memória por instância (arquitetura 03, 6.1). */
export class LimiteDeTaxa {
  private janelas = new Map<string, { inicio: number; n: number }>();
  private agora: () => number;
  constructor(agora: () => number = Date.now) { this.agora = agora; }
  consumir(chave: string, porMinuto: number): void {
    const t = this.agora(); const j = this.janelas.get(chave);
    if (!j || t - j.inicio >= 60_000) { this.janelas.set(chave, { inicio: t, n: 1 }); if (this.janelas.size > 10_000) this.limpar(t); return; }
    if (j.n >= porMinuto) throw new OdinErro('limite_excedido', 'Muitas chamadas em pouco tempo.', Math.ceil((60_000 - (t - j.inicio)) / 1000));
    j.n++;
  }
  private limpar(t: number): void { for (const [k, j] of this.janelas) if (t - j.inicio >= 60_000) this.janelas.delete(k); }
}

export const estimarTokens = (texto: string): number => Math.ceil(texto.length / 3.5);
