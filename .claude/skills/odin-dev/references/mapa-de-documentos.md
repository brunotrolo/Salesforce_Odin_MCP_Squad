# Mapa de documentos

Leia só o necessário para a tarefa. Em conflito, vale a ordem: `docs/DECISOES.md` → `docs/seguranca/` → `docs/portal/` → `docs/arquitetura/` → `docs/PLANO.md` (ADRs aceitos em `docs/adr/` atualizam todos).

## Sempre
| Documento | Para quê |
|---|---|
| `CLAUDE.md` | Regras invioláveis e ordem de leitura |
| `docs/ESTADO.md` | Fase atual, feito, próximo passo, pendências |
| `docs/DECISOES.md` | As 41 decisões do mantenedor (valem sobre o resto) |
| `docs/adr/` | Decisões posteriores (0016 em diante) |

## Por área
| Área da tarefa | Leia |
|---|---|
| Visão geral, fases, riscos, portões | `docs/PLANO.md` (seções 1-3, 16, 18, 23) |
| Princípios, componentes, decisões de arquitetura (ADR-01 a 15), escala, ambientes | `docs/arquitetura/01-arquitetura-de-solucao.md` |
| Atores, casos de uso, modelo de acesso, regras de negócio, requisitos | `docs/arquitetura/02-arquitetura-funcional.md` |
| Recursos GCP, dados (Firestore, Cloud SQL, BigQuery), autenticação, ferramentas MCP, API `/v1`, integração GitHub, IaC, custos | `docs/arquitetura/03-arquitetura-tecnica.md` |
| Portal (visão resumida) | `docs/arquitetura/04-portal-e-perfilamento.md` |
| Runtime local, `odin ensure`, guard, agentes, gatilho, isolamento | `docs/PLANO.md` seções 7 e 22 |
| Catálogo, `odin.yaml`, pipeline de publicação, canais, caminhos | `docs/PLANO.md` seção 8; `docs/portal/07-ciclo-de-vida-das-skills.md` |
| Base de conhecimento (RAG) | `docs/PLANO.md` seção 11; `docs/arquitetura/03` seções 4.3 a 4.3.1 |
| Ameaças | `docs/seguranca/01-modelo-de-ameacas.md` |
| Login, MFA, métodos de autenticação | `docs/seguranca/02-autenticacao-e-mfa.md` |
| Tokens, refresh, sessões, chaves, revogação | `docs/seguranca/03-tokens-sessoes-e-chaves.md` |
| Perfis, papéis, avaliação de política, quatro olhos | `docs/seguranca/04-autorizacao.md` |
| Assinatura, dependências, GitHub Free, distribuição do CLI | `docs/seguranca/05-cadeia-de-suprimentos.md` |
| Guard, políticas PG-01 a PG-08, Windows, injeção, Jira | `docs/seguranca/06-seguranca-do-endpoint.md` |
| IAM, rede, Cloud Armor, criptografia, logs de auditoria GCP | `docs/seguranca/07-infraestrutura-gcp.md` |
| LGPD, retenção, expurgo | `docs/seguranca/08-dados-e-lgpd.md` |
| Detecções e playbooks | `docs/seguranca/09-deteccao-e-resposta.md` |
| Controles CT-01 a CT-24 e testes de segurança por fase | `docs/seguranca/10-controles-e-testes.md` |
| Runbooks RB-01 a RB-12 | `docs/seguranca/11-runbooks.md` |
| Portal: solução, funcional, telas, guia do MCP, console, consumo e cotas, ciclo de vida, UX, API, aceite | `docs/portal/01` a `docs/portal/10` |
| Visão ilustrada para apresentar | `apresentacao/odin-apresentacao.html` |

## Inventário das skills que vão para o catálogo
Repositórios (todos privados): Salesforce_Discovery-to-Backlog, Salesforce_Journey_Designer, Salesforce_Journey_Developer, Salesforce_Data_Architect, Salesforce_Test_Automator. Detalhe da migração: `docs/PLANO.md` seção 12 e skill `odin-curador`.
