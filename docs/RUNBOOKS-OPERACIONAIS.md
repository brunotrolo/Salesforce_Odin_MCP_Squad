# Runbooks operacionais (F8)

Complementam os runbooks de segurança (`docs/seguranca/11-runbooks.md`). Os alertas do Cloud Monitoring citam o código `ROP-xx`.

## ROP-01 Erros 5xx nos serviços
1. Painel **Odin: visão operacional** → "Erros 5xx": identificar o serviço (`odin-sts`, `odin-mcp`, jobs).
2. Logs do serviço (severity ≥ ERROR) ou tabela `odin_auditoria` no BigQuery: `SELECT timestamp, severity, jsonPayload FROM odin_auditoria.run_googleapis_com_stderr_* WHERE severity>='ERROR' ORDER BY timestamp DESC LIMIT 50`.
3. Regressão depois de um deploy: reverter a revisão no Cloud Run (tráfego 100% na revisão anterior) e abrir correção.
4. Registrar o incidente (`docs/seguranca/09-deteccao-e-resposta.md`).

## ROP-02 Latência p95 alta
1. Painel → "Latência p95" e "Instâncias ativas". Frio recorrente: aumentar `min-instances` só se o custo couber no orçamento (E0 = 0).
2. Cache do catálogo/direitos é de 30 s; consulta lenta ao Firestore aparece nos logs.
3. Disjuntor ativo (ingress interno) também parece indisponibilidade: conferir `odin-disjuntor`.

## ROP-03 Pico de acessos negados
1. Painel → 4xx por serviço; na auditoria, agrupar por `jsonPayload.evento` e dispositivo/pessoa.
2. Tentativa em massa: seguir o RB-01/RB-03 de segurança (revogar dispositivo, revogação global).
3. Erro de configuração legítimo (token expirado em massa): pedir `odin login`.

## ROP-04 Orçamento ≥ 100% (disjuntor)
1. Orçamento em 300% fecha o ingress dos serviços. Reabrir só depois de entender o consumo (Billing → Relatórios).
2. Reabrir: workflow `disjuntor-real.yml` valida o ciclo; reabertura manual pelo `odin-disjuntor` (`/reabrir`).

## Auditoria em BigQuery
Dataset `odin_auditoria` (retenção 400 dias, tabelas particionadas). Alimentado pelo sink `odin-auditoria` (eventos do aplicativo e severidade ≥ WARNING).
