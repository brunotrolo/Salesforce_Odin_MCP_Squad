// Evento de auditoria (schemas/evento-auditoria.schema.json). Nunca leva o texto do pedido, token ou segredo.
import { randomBytes } from 'node:crypto';

export type Servico = 'odin-mcp' | 'odin-sts' | 'odin-portal' | 'odin-publisher' | 'odin-indexer' | 'odin-jobs' | 'odin-disjuntor' | 'odin-cli';
export interface EventoAuditoria {
  tipo: 'auditoria'; ts: string; servico: Servico; ator: string; acao: string; resultado: 'ok' | 'negado' | 'erro'; request_id: string;
  dispositivo?: string; alvo?: string; motivo?: string; ip?: string; ua?: string; latencia_ms?: number; skill?: string; versao?: string; antes?: object; depois?: object;
}
export type Coletor = (e: EventoAuditoria) => void;

export const novoRequestId = (): string => `req_${randomBytes(9).toString('hex')}`;

/** Coletor padrão: uma linha JSON no stdout (o Cloud Logging filtra por tipo="auditoria"). */
export const coletorStdout: Coletor = (e) => { process.stdout.write(`${JSON.stringify(e)}\n`); };
export const coletorMemoria = (): { coletor: Coletor; eventos: EventoAuditoria[] } => { const eventos: EventoAuditoria[] = []; return { coletor: (e) => { eventos.push(e); }, eventos }; };

export function auditar(coletor: Coletor, servico: Servico, e: Omit<EventoAuditoria, 'tipo' | 'ts' | 'servico'>): void {
  const limpo = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) as Omit<EventoAuditoria, 'tipo' | 'ts' | 'servico'>;
  coletor({ tipo: 'auditoria', ts: new Date().toISOString(), servico, ...limpo });
}
