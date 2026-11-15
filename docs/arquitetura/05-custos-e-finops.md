# 05. Custos e FinOps

> Série: [01 Solução](01-arquitetura-de-solucao.md) · [02 Funcional](02-arquitetura-funcional.md) · [03 Técnica](03-arquitetura-tecnica.md) · [04 Portal e perfilamento](04-portal-e-perfilamento.md) · **05 Custos**. Decisão: [ADR 0018](../adr/0018-arquitetura-enxuta-por-estagios-de-custo-contratos-em-schema.md).
> Valores em dólares por mês, **ordem de grandeza** a partir dos preços públicos do Google Cloud. [VERIFICAR] na calculadora de preços, para `southamerica-east1`, antes de criar cada recurso pago (a região costuma custar mais que as dos Estados Unidos).

## 1. Princípios

| # | Princípio | Na prática |
|---|---|---|
| FO-1 | **Nada pago sem gatilho** | Recurso com custo fixo só entra quando um gatilho objetivo da seção 3 dispara, com ADR |
| FO-2 | **Escala a zero é o padrão** | `min = 0` em todo serviço; jobs em vez de serviços para tudo que não atende requisição de pessoa |
| FO-3 | **Custo tem teto por desenho** | `max` de instâncias baixo, orçamento com alertas e disjuntor (seção 5) |
| FO-4 | **Faixa gratuita primeiro** | Firestore, Cloud Run, BigQuery, Logging, Scheduler e Identity Platform cabem na faixa gratuita no uso do time |
| FO-5 | **O que é reconstruível não precisa de alta disponibilidade** | Catálogo e conhecimento têm fonte no Git; o índice se refaz |
| FO-6 | **Teste caro roda local ou no CI, não na nuvem** | Emuladores, contêiner Postgres + pgvector, k6 sob demanda |
| FO-7 | **Custo é verificado em código** | Regras CF-11 a CF-14 em `scripts/conformidade.mjs` reprovam o Terraform que foge do estágio |

## 2. Estágios

O ambiente não é mais descrito como "poc × prod", e sim pelo **estágio de custo** em que está. O Terraform recebe `estagio = "e0" | "e1" | "e2"`.

| | **E0 Prova de conceito** | **E1 Time** | **E2 Corporativo** |
|---|---|---|---|
| Quem usa | Mantenedor + 2 contas de teste | Time (até cerca de 50 pessoas), horário comercial | Vários times ou exigência contratual |
| Meta de custo | **≤ US$ 3** (alerta em US$ 5) | **≤ US$ 25** (alerta em US$ 40) | Orçado caso a caso (centenas) |
| Serviços Cloud Run | 3, `min 0`, `max 3` | 3, `min 0`, `max 3` | `min 1` onde o SLO exigir, `max` conforme carga |
| Borda | `run.app` (TLS gerenciado) | `run.app` (domínio próprio opcional sem Load Balancer, seção 6) | Load Balancer + Cloud Armor + domínio |
| RAG | Firestore (busca vetorial) | Firestore; **Cloud SQL mínimo, sem alta disponibilidade, quando entrar conhecimento confidencial** | Cloud SQL dimensionado, com alta disponibilidade se o SLO exigir |
| Chaves | KMS em software | KMS em software | HSM nas chaves de assinatura |
| Criptografia em repouso | Padrão do Google + envelope nos campos sensíveis | Idem | CMEK em buckets e banco |
| Eventos do GitHub | Não há (conta pessoal) | Varredura a cada 15 min | Webhooks (opcional) |
| Perímetro | — | — | VPC Service Controls, políticas de organização |
| Pessoas e processo | Só o mantenedor | Portão 2 do [plano, seção 23](../PLANO.md) | Plantão, segundo ambiente permanente |

Os controles de segurança centrais **não mudam com o estágio**: pacotes assinados, token de 15 min com prova de posse, revogação ≤ 30 s, negado por padrão, guard fail-closed, auditoria completa.

## 3. Gatilhos (o que faz um recurso pago entrar)

| Recurso | Custo aproximado | Gatilho | Sem o gatilho |
|---|---|---|---|
| **Cloud SQL** (Postgres + pgvector, núcleo compartilhado, disco de 10 GB, sem réplica) | US$ 10 a 15 | Primeiro documento com `sensibilidade: confidencial`; ou recuperação abaixo de 80% no top 5 por falta de busca textual | Firestore com isolamento na aplicação e só conhecimento `interna` |
| Alta disponibilidade no Cloud SQL | dobra o item acima | Indisponibilidade medida do RAG maior que o orçamento de erro em 2 meses seguidos | Reindexar do Git (RTO de 1 h); o RAG fora do ar não derruba as skills |
| **Instância quente** (por serviço) | US$ 10 a 15 | p95 da primeira chamada do dia acima de 3 s medido por 2 semanas, **só no `odin-mcp`** | Partida a frio com reforço de CPU na inicialização |
| **Load Balancer** | US$ 18 a 25 | Exigência contratual de domínio com WAF; ou achado alto de pentest que só a borda resolve | `run.app` |
| **Cloud Armor** | US$ 10 a 15 + tráfego | Abuso real vindo de IPs não autenticados (DT-18 recorrente); ou o gatilho do Load Balancer | Limites no serviço + teto de instâncias + disjuntor |
| HSM (por versão de chave) | US$ 1 a 3 | Exigência de conformidade | Chave em software no KMS (a chave continua não exportável) |
| CMEK | centavos + operação | Exigência contratual de chave gerenciada pelo cliente | Criptografia padrão do Google |
| `odin-webhooks` | zero parado | Saída de pessoa precisa valer em segundos sem ação de administrador | Varredura de 15 min + revogação pelo portal |
| Memorystore, Cloud NAT, conector de VPC | US$ 30+ cada | **Nunca em E0 e E1** (CF-12) | Limite em memória; saída direta para VPC; sem NAT |

Cada entrada de recurso é um ADR curto com o gatilho que disparou e a medição.

## 4. Modelo de custo

### 4.1 E0 e E1 sem Cloud SQL
| Item | Uso estimado (20 pessoas) | Faixa gratuita | Custo |
|---|---|---|---|
| Cloud Run (3 serviços) | ~10 mil requisições/dia de milissegundos | 2 milhões de requisições e 180 mil vCPU-segundos por mês | 0 |
| Cloud Run Jobs | 96 execuções/dia de poucos segundos + publicações | mesma faixa do Cloud Run | 0 |
| Firestore | ~5 mil leituras e ~1 mil gravações por dia | 50 mil leituras e 20 mil gravações por dia | 0 |
| Cloud Storage | poucos GB de pacotes; download de pacotes | 5 GB (só em regiões dos EUA) | centavos a US$ 1 |
| Cloud KMS | 3 chaves em software; ~1 mil assinaturas/dia | — | ~US$ 0,30 |
| Secret Manager | 4 segredos | 6 versões | 0 |
| Vertex AI (embeddings) | ~500 consultas/dia + indexação | — | centavos |
| BigQuery | MBs de auditoria; consultas sobre agregados | 10 GB e 1 TB de consulta | 0 |
| Cloud Logging | < 1 GB | 50 GB | 0 |
| Cloud Scheduler | 1 agendamento | 3 | 0 |
| Artifact Registry | 4 imagens, 3 versões cada | 0,5 GB | 0 a centavos |
| Identity Platform | 20 a 50 pessoas | 50 mil ativos/mês | 0 |
| **Total** | | | **US$ 1 a 3** |

### 4.2 E1 com Cloud SQL
Item 4.1 + Cloud SQL mínimo: **US$ 12 a 20**.

### 4.3 O que foi evitado
| Item do desenho anterior de "produção" | Custo evitado em E1 |
|---|---|
| Load Balancer + Cloud Armor | US$ 30 a 40 |
| Instância quente em 3 serviços | US$ 30 a 45 |
| Cloud SQL com 2 vCPU e alta disponibilidade | US$ 200 a 300 |
| HSM, CMEK, serviços e tópicos extras | US$ 5 a 10 |
| **Total** | **cerca de US$ 270 a 400 por mês** |

## 5. Teto e disjuntor

1. **Teto de instâncias:** `max 3` por serviço em E0 e E1. Um ataque ou laço não escala a conta além de 9 instâncias.
2. **Orçamento** (`odin-<amb>-budget`): alertas em 50%, 90%, 100%, 200% e 300%, por e-mail e num tópico Pub/Sub (`budget-alerts`, o único tópico do desenho).
3. **Disjuntor** (`odin-disjuntor`, função do Cloud Run acionada pelo tópico): ao receber o aviso de **300%**, muda o ingress de `odin-mcp`, `odin-sts` e `odin-portal` para `internal`. Efeito: nenhuma requisição externa chega, o custo de computação vai a zero, **nenhum dado é apagado**.
4. **Para o time:** as skills já instaladas continuam pelo modo degradado de 7 dias (decisão 14).
5. **Volta:** runbook [RB-13](../seguranca/11-runbooks.md): achar a causa na auditoria, corrigir, reabrir o ingress com `terraform apply`.
6. **Permissão mínima:** a conta `sa-disjuntor` só tem `run.services.update` nesses três serviços.

## 6. Decisões de desenho que seguram o custo

| Decisão | Por quê |
|---|---|
| MCP **sem estado, resposta JSON por requisição, sem fluxo SSE permanente** (`GET` no endpoint MCP responde 405) | Com cobrança por requisição, um fluxo aberto manteria a instância cobrada o dia inteiro por pessoa conectada |
| Jobs no lugar de serviços para publicar, indexar e rotinas | Job não tem instância ociosa nem porta pública |
| Um agendamento (`odin-tick`) para todas as rotinas | Fica na faixa gratuita do Scheduler e acorda o ambiente uma vez só |
| Embeddings das intenções calculados na publicação; cache do embedding da consulta por 10 min | O roteamento chama o Vertex AI só em pedido novo |
| Cota diária contada em memória e gravada em lote (a cada 30 s ou 20 chamadas) | Corta gravações no Firestore sem perder precisão relevante |
| Pacotes endereçados por hash | Runtime igual entre versões não é baixado de novo (menos saída de rede) |
| Navegadores do Playwright fora do pacote | Baixados pelo instalador oficial, não pelo bucket do Odin |
| Limpeza automática no Artifact Registry (3 últimas versões; sem tag após 7 dias) | Imagens antigas são o custo silencioso mais comum |
| Logs: exclusão das verificações de saúde; acesso a dados ligado só em KMS e Secret Manager | Mantém o Logging na faixa gratuita |
| Portal consulta **tabela agregada diária** no BigQuery, com `maximum_bytes_billed` | Painel nunca varre a tabela bruta |
| Domínio próprio em E1, se desejado, por **Firebase Hosting** na frente do Cloud Run [VERIFICAR região, limite de 60 s e cabeçalhos] | Certificado e domínio sem Load Balancer |
| Endereços publicados em `/.well-known/odin-configuration` e lidos pelo CLI | Trocar `run.app` por domínio próprio vira configuração, não reinstalação (R22) |

## 7. Custos fora da nuvem

| Item | Regra |
|---|---|
| GitHub Actions (Free: 2.000 min/mês em repositório privado; Windows conta em dobro, macOS dez vezes) | Windows em todo PR só nos pacotes do CLI e do guard; macOS só em release e semanal; execuções repetidas canceladas; tempo limite por job |
| Modelo (avaliações de comportamento) | Na máquina do mantenedor, sob demanda, antes de promoção (ADR 0017) |
| Pentest externo | Uma vez antes do time; escopo fechado |

## 8. Rotina de FinOps

| Quando | O quê |
|---|---|
| Todo PR em `infra/` | `npm run conformidade` (CF-11 a CF-14) e `terraform plan` com o estágio |
| Semanal (skill `odin-operacao`) | Custo por serviço no relatório de faturamento; maior variação da semana |
| Mensal | Comparar com a meta do estágio; revisar o Recomendador; conferir a limpeza do Artifact Registry |
| A cada gatilho | ADR com a medição que justificou o recurso |

## 9. Conformidade de custo (verificada em código)

| Regra | Verifica |
|---|---|
| CF-11 | Em `infra/envs/` de estágio E0 ou E1: nenhum `min_instance_count` acima de 0 e nenhum `max_instance_count` acima de 3 |
| CF-12 | Em E0 e E1: nenhum Load Balancer, Cloud Armor, Memorystore, Cloud NAT ou conector de VPC; em E0, nenhum Cloud SQL |
| CF-13 | Todo ambiente declara um orçamento (`google_billing_budget`) |
| CF-14 | Todo repositório do Artifact Registry declara política de limpeza |
