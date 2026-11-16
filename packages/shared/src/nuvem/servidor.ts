// Utilitários dos pontos de entrada dos serviços: variáveis obrigatórias, porta do Cloud Run e encerramento limpo.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export const exigir = (nome: string): string => { const v = process.env[nome]; if (!v) throw new Error(`variável de ambiente ausente: ${nome}`); return v; };
export function escutar(handler: (q: IncomingMessage, r: ServerResponse) => Promise<void> | void): void {
  const porta = Number(process.env.PORT ?? 8080);
  const s = createServer((q, r) => { void Promise.resolve(handler(q, r)).catch(() => { if (!r.headersSent) { r.writeHead(500); } r.end(); }); });
  s.keepAliveTimeout = 5000;
  s.listen(porta, '0.0.0.0', () => process.stdout.write(`${JSON.stringify({ tipo: 'inicio', porta, servico: process.env.K_SERVICE ?? 'local' })}\n`));
  process.on('SIGTERM', () => { s.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); });
}

/** Executa um passo da inicialização; se falhar, registra qual foi (em JSON, para o Cloud Logging) e propaga o erro. */
export async function passo<T>(nome: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { process.stderr.write(`${JSON.stringify({ tipo: 'erro_inicio', passo: nome, mensagem: String((e as Error).message).slice(0, 300) })}\n`); throw e; }
}
