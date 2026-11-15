# Teste sintético no Google Cloud (modelo)

Fluxo de ponta a ponta executado **continuamente** em cada ambiente, com uma identidade de teste, para provar que o Odin está funcionando como o usuário o vê.

## Recursos (Terraform, F8)
- **Sem job nem agendamento próprios** (ADR 0018): o sintético é uma **tarefa do job `odin-jobs`**, executada pelo agendamento único `odin-tick` a cada 15 minutos, junto das outras rotinas. A conta `sa-jobs` lê o segredo `odin-sintetico-credencial`.
- **Métrica baseada em log** `odin_sintetico_falha` (log com `jsonPayload.sintetico="falha"`) e **alerta** (Cloud Monitoring, canal de e-mail do mantenedor) se houver 2 falhas seguidas.
- **Verificações de disponibilidade** em `/healthz` do MCP, STS e portal (a cada 5 min, faixa gratuita).

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
- Custo: execução curta a cada 15 min, dentro da faixa gratuita; o sintético também mantém os serviços respondendo em horário comercial, o que reduz a partida a frio vista pelas pessoas.
