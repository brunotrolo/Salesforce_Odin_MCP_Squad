# Teste sintético no Google Cloud (modelo)

Fluxo de ponta a ponta executado **continuamente** na PoC, com uma identidade de teste, para provar que o Odin está funcionando como o usuário o vê.

## Recursos (Terraform, F8)
- **Cloud Run Job** `odin-sintetico` (imagem com `sintetico.mjs`), conta de serviço `sa-sintetico` com acesso só ao segredo `odin-sintetico-credencial`.
- **Cloud Scheduler** `odin-sintetico-15min` → executa o job a cada 15 minutos.
- **Métrica baseada em log** `odin_sintetico_falha` (log com `jsonPayload.sintetico="falha"`) e **alerta** (Cloud Monitoring, canal de e-mail do mantenedor) se houver 2 falhas seguidas.
- **Uptime checks** em `/healthz` do MCP, STS e portal.

## Passos do job
1. Obter token: troca da credencial de dispositivo de teste (guardada no Secret Manager) por um token de acesso no `odin-sts`, com a prova de posse da chave de teste.
2. MCP `initialize` e `tools/list` (1 a 7 ferramentas).
3. `odin_rotear` com uma intenção conhecida → a skill esperada no topo.
4. `odin_carregar_skill` → manifesto com versão e hash.
5. `odin_conhecimento_buscar` no `projeto-sintetico` → pelo menos 1 trecho com citação; nenhum trecho de outro projeto.
6. Consulta à auditoria (BigQuery) → os eventos 2 a 5 registrados com `ator=sintetico` e sem conteúdo do pedido.
7. Log final `{"sintetico":"ok"|"falha","etapa":…,"latencias":…}`.

## Regras
- Conta de teste **nunca administrativa**; perfil `dev` no squad e projeto sintéticos.
- Credencial rotacionada mensalmente (rotina em `references/sustentacao.md`).
- Eventos do sintético filtrados dos painéis de consumo.
- Custo: execução curta a cada 15 min, dentro ou perto da faixa gratuita; confirmar no orçamento.
