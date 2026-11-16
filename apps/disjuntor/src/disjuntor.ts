// odin-disjuntor (ADR 0018, RB-13): ao receber o aviso do orçamento com gasto ≥ 300%, fecha o ingress dos serviços públicos.
// Nada é apagado; a volta é por runbook (terraform apply restaura o valor declarado). Recebe o push do Pub/Sub com identidade (OIDC).
import { GoogleAuth } from 'google-auth-library';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { auditar, novoRequestId, type Coletor } from '../../../packages/shared/src/auditoria.ts';
import { lerCorpo, responder } from '../../../packages/shared/src/http.ts';

export const LIMITE_DISJUNTOR = 3.0; // 300% do orçamento

export interface AvisoOrcamento { costAmount?: number; budgetAmount?: number; alertThresholdExceeded?: number; budgetDisplayName?: string }
export function decidir(a: AvisoOrcamento): { fechar: boolean; razao: string } {
  if (typeof a.costAmount !== 'number' || typeof a.budgetAmount !== 'number' || a.budgetAmount <= 0) return { fechar: false, razao: 'aviso sem valores; nada a fazer' };
  const f = a.costAmount / a.budgetAmount;
  return f >= LIMITE_DISJUNTOR ? { fechar: true, razao: `gasto em ${Math.round(f * 100)}% do orçamento (limite ${LIMITE_DISJUNTOR * 100}%)` } : { fechar: false, razao: `gasto em ${Math.round(f * 100)}% do orçamento; abaixo do limite` };
}

export interface ConfigDisjuntor { projeto: string; regiao: string; servicos: string[]; coletor: Coletor; fecharIngress?: (servico: string) => Promise<void> }

export async function fecharIngressRun(projeto: string, regiao: string, servico: string): Promise<void> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }); const c = await auth.getClient();
  await c.request({ url: `https://run.googleapis.com/v2/projects/${projeto}/locations/${regiao}/services/${servico}?updateMask=ingress`, method: 'PATCH', data: { ingress: 'INGRESS_TRAFFIC_INTERNAL_ONLY' } });
}

export function criarDisjuntor(cfg: ConfigDisjuntor) {
  const fechar = cfg.fecharIngress ?? ((s: string) => fecharIngressRun(cfg.projeto, cfg.regiao, s));
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rid = novoRequestId(); const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === '/healthz' || url.pathname === '/saude') return responder(res, 200, { ok: true });
    if (req.method !== 'POST') return responder(res, 405, { codigo: 'invalido', mensagem: 'Use POST.', request_id: rid });
    try {
      const corpo = JSON.parse((await lerCorpo(req)).toString('utf8') || '{}') as { message?: { data?: string } };
      const aviso = JSON.parse(Buffer.from(corpo.message?.data ?? 'e30=', 'base64').toString('utf8')) as AvisoOrcamento;
      const d = decidir(aviso); const simular = url.searchParams.get('simular') === '1';
      if (d.fechar && !simular) { for (const s of cfg.servicos) await fechar(s); }
      auditar(cfg.coletor, 'odin-disjuntor', { ator: 'sa:disjuntor', acao: 'custo.disjuntor', resultado: d.fechar ? 'negado' : 'ok', motivo: d.fechar ? 'limite_excedido' : undefined, request_id: rid, alvo: `${d.razao}${simular ? ' (simulação)' : ''}`.slice(0, 200) });
      return responder(res, 200, { fechou: d.fechar && !simular, simulado: simular, razao: d.razao, servicos: d.fechar ? cfg.servicos : [] });
    } catch { return responder(res, 400, { codigo: 'invalido', mensagem: 'Aviso de orçamento ilegível.', request_id: rid }); }
  };
}
