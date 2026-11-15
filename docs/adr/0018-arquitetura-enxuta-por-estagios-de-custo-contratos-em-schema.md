# 0018. Arquitetura enxuta por estágios de custo, contratos em schema e governança do repositório

**Status:** Aceito (2026-11-15)
**Data:** 2026-11-15
**Fase:** sustentação (antes da F0); efeito em todas as fases
**Documentos afetados:** docs/DECISOES.md (decisões 42 a 48); docs/PLANO.md §2, §4, §9.3, §14, §16, §18, §19, §20, §23; docs/arquitetura/01, 02, 03, 04 e o novo 05; docs/seguranca/01, 02, 03, 04, 05, 07, 08, 09, 10, 11 e README; docs/portal/01, 06, 09

## Contexto
O mantenedor pediu uma revisão completa do projeto para levá-lo a um nível de referência, delegando as decisões, com uma restrição: **não gastar com nuvem o que não for necessário**. A revisão (sessão de 2026-11-15) encontrou:

1. **"Produção" superdimensionada para o público real** (20 devs, horário comercial, SLO de 99,5%): Load Balancer + Cloud Armor, instância quente em três serviços, Cloud SQL com 2 vCPU e alta disponibilidade, HSM e CMEK. Ordem de grandeza: algumas centenas de dólares por mês, para um uso que cabe quase todo nas faixas gratuitas.
2. **Topologia maior que o necessário e com um erro:** 5 serviços + 2 jobs + 4 tópicos de Pub/Sub. O desenho mandava o Pub/Sub entregar eventos ao `odin-jobs`, mas um **Cloud Run Job não assina tópico**. O `odin-publisher` confiava em quem o chamava (IAM), não no que recebia. Os webhooks do GitHub só servem quando há organização, e criam uma porta pública sem autenticação de usuário.
3. **Risco de custo sem teto:** `max 20` instâncias por serviço e nenhum mecanismo que corte o gasto numa conta pessoal se houver abuso ou laço.
4. **Transporte MCP sem regra de custo:** um fluxo SSE aberto mantém a instância cobrada o tempo todo no Cloud Run.
5. **Contradições entre documentos:** trechos ainda supunham proteção de branch, CODEOWNERS obrigatório e ambientes com aprovação (indisponíveis no GitHub Free, decisão 41); o plano dizia que a PoC custava "dezenas de dólares, dominado pelo Cloud SQL", contra a decisão 7.
6. **Contratos só em prosa:** o `odin.yaml`, o manifesto, as 7 ferramentas MCP e a API `/v1` não tinham schema verificável (entregável 3 das decisões, pendente).
7. **Higiene de repositório ausente:** sem política de segurança, guia de contribuição, modelo de PR, atualização automática de dependências nem registro de mudanças.

## Decisão
1. **Estágios de custo no lugar de "poc × prod"** ([arquitetura 05](../arquitetura/05-custos-e-finops.md)). Um recurso pago só entra por **gatilho objetivo**, nunca por data:
   - **E0 Prova de conceito:** meta ≤ US$ 3/mês, alerta em US$ 5.
   - **E1 Time (até cerca de 50 pessoas):** mesma topologia do E0, meta ≤ US$ 25/mês. Sem Load Balancer, sem Cloud Armor, sem instância quente, sem HSM, sem CMEK. Cloud SQL só quando entrar o primeiro conhecimento `confidencial`, na menor instância, **sem alta disponibilidade** (o RAG é reconstruível a partir do Git).
   - **E2 Corporativo:** Load Balancer + Cloud Armor, instância quente, alta disponibilidade, HSM, CMEK, VPC Service Controls. Só por gatilho (exigência contratual, achado de pentest, SLO medido abaixo da meta, abuso real, mais de cerca de 200 pessoas).
2. **Topologia enxuta:** 3 serviços (`odin-mcp`, `odin-sts`, `odin-portal`) + 3 jobs de **uma só imagem** (`odin-publisher`, `odin-indexer`, `odin-jobs`), cada job com a própria conta de serviço. **Sem Pub/Sub de aplicação e sem `odin-webhooks`** em E0 e E1.
   - O `odin-publisher` vira job executado pelo CI e **confere a assinatura do manifesto** antes de registrar: a confiança está no que foi assinado, não em quem chamou.
   - Um único agendamento (`odin-tick`, a cada 15 min) executa o `odin-jobs`, que decide o que está vencido: sincronizar times, expirar concessões, verificar mudança no `odin-knowledge`, teste sintético, agregados de consumo.
   - Saída de pessoa do GitHub passa a ser detectada por **varredura a cada 15 min**; a revogação imediata continua no portal. Webhooks ficam como otimização do E2.
3. **Teto e disjuntor de custo:** `max` de 3 instâncias por serviço em E0 e E1; orçamento com alertas; **disjuntor** (`odin-disjuntor`): ao atingir 300% do orçamento, uma função fecha o ingress dos serviços públicos. As skills seguem pelo modo degradado de 7 dias, e a volta é por runbook (RB-13).
4. **MCP barato por desenho:** Streamable HTTP sem estado, **resposta JSON por requisição e sem fluxo SSE permanente** (`GET` no endpoint MCP responde 405), para a instância escalar a zero; cache de embeddings do roteamento; contadores de cota agregados em memória e gravados em lote; ferramentas com `outputSchema` e anotações (`readOnlyHint`).
5. **Economias menores, todas por Terraform:** limpeza automática no Artifact Registry; logs de acesso a dados só para KMS e Secret Manager; exclusão de logs de verificação de saúde; consultas do portal ao BigQuery sobre tabela agregada e com limite de bytes; pacotes por hash (runtime igual não é baixado de novo); teste de isolamento do banco no CI com contêiner Postgres + pgvector (sem ambiente pago); macOS no CI só em release.
6. **Contratos como código** em `schemas/`: JSON Schema do `odin.yaml`, do manifesto, dos casos e do resultado de avaliação, do evento de auditoria; definição das 7 ferramentas MCP; OpenAPI da API `/v1`. `npm run verificar:schemas` valida os schemas, os exemplos e o modelo do curador no CI.
7. **Governança do repositório:** `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.editorconfig`, modelo de PR, donos por área no guia de contribuição (o `CODEOWNERS` entra com a organização), Dependabot, CI com cancelamento de execuções repetidas e tempo limite.
8. **Conformidade de custo verificada em código:** CF-11 a CF-14 em `scripts/conformidade.mjs`.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Manter "prod" completo (Load Balancer, Cloud Armor, instância quente, Cloud SQL com alta disponibilidade) | Custo fixo de centenas de dólares por mês sem requisito que o justifique para 20 pessoas; todas as rotas úteis já exigem JWT e validam entrada por schema |
| Um único serviço (monólito) | Juntaria a chave de assinatura de JWT com a superfície do MCP e do portal; a separação do `odin-sts` custa zero com escala a zero |
| Manter webhooks + Pub/Sub | Porta pública sem autenticação de usuário, quatro tópicos e um serviço a mais para um ganho de minutos na saída de pessoas; a revogação imediata já existe no portal |
| Uma só conta de serviço para os três jobs | Juntaria escrita no catálogo, escrita no RAG e a chave do GitHub App; jobs parados não custam nada |
| Firestore para sempre, sem Cloud SQL | Sem segunda barreira no banco para separar clientes; aceito só enquanto não houver conhecimento confidencial |
| Desligar o faturamento no disjuntor | Apaga recursos; fechar o ingress é reversível e preserva os dados |
| Validador de schema próprio | Reinventaria biblioteca madura; `ajv` e `yaml` entram só como dependências de desenvolvimento, com lockfile |

## Consequências
- Melhora: custo do time cai de centenas para poucos dólares por mês (cerca de US$ 15 a 25 quando o Cloud SQL entrar); menos componentes para uma pessoa só operar (4 imagens em vez de 7); nenhuma porta pública sem autenticação além do login e da ativação; publicação mais forte (assinatura conferida no registro); contratos verificados no CI.
- Piora ou risco: partida a frio em E0 e E1 (meta: p95 da primeira chamada ≤ 3 s, medida na F8; se estourar, instância quente só no `odin-mcp`); sem WAF em E1 (compensado por autenticação em todas as rotas, limites no serviço, teto de instâncias e disjuntor) → novo risco **R20**; saída de pessoa detectada em até 15 min em vez de segundos (R21); endereço `run.app` no E1, com troca futura de domínio tratada por documento de descoberta (R22).
- Portão 2 muda: saem "domínio + Load Balancer + Cloud Armor" e "Cloud SQL" como itens obrigatórios; entram como gatilhos de estágio. Continuam obrigatórios: organização GitHub, segundo super-admin, jurídico, pentest, ensaio do corte.
- Testes: CF-11 a CF-14; testes de schema; teste do disjuntor na F8.

## Segurança
- Modelo de ameaças: AM-08 (excesso de chamadas) passa a ter teto de instâncias e disjuntor no lugar do Cloud Armor em E0 e E1; a fronteira de webhooks deixa de existir nesses estágios; AM-12 ganha a conferência de assinatura no registro.
- Controles: CT-11 reescrito (limites no serviço em E0 e E1; WAF em E2); CT-19 sem CMEK obrigatório antes do E2; novo **CT-28** (teto e disjuntor de custo). Detecção DT-17 passa a acionar o disjuntor; runbook novo **RB-13**.
- Sem regressão nos controles centrais: assinatura no KMS, token de 15 min, revogação ≤ 30 s, negado por padrão, guard fail-closed e isolamento do conhecimento confidencial no banco continuam como estavam.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade (scripts/conformidade.mjs): CF-11 a CF-14
