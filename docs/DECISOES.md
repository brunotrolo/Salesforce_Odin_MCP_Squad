# Decisões do mantenedor

> Respostas às 40 perguntas abertas (rodada 13 de revisão). **Integradas a todos os documentos na rodada 14.** Em caso de diferença remanescente, estas decisões valem.
> Data: 14/11/2026.

## A. Prova de conceito e ambiente
| # | Decisão | Consequência |
|---|---|---|
| 1 | Projeto `odin-poc` em `southamerica-east1`, criado pelo mantenedor | O Terraform da F1 assume esse ID |
| 2 | F0 por **roteiro**: o Claude prepara o roteiro e o servidor de teste; o mantenedor executa na máquina dele | Entregável novo: `docs/F0-ROTEIRO.md` |
| 3 | F0 usa o **LiteLLM real** do time | Testa o risco R11 (busca de ferramentas via gateway) de verdade |
| 4 | PoC na conta pessoal do GitHub; **organização criada antes de liberar ao time** | Times → squads e 2FA obrigatório só depois da organização |
| 5 | **Todos os repositórios privados** (Odin, skills, `odin-knowledge`) | O CLI e o pipeline precisam de credenciais de leitura; o GitHub App instalado nos repositórios privados |
| 6 | Endereços **`run.app` na PoC**; domínio próprio antes do time | Load Balancer e Cloud Armor adiados |
| 7 | **Custo perto de zero na PoC**, aumentando conforme for liberado | RAG no **Firestore com busca vetorial** (faixa gratuita) atrás de uma interface; sem Load Balancer; orçamento com alerta em US$ 5. Estimativa: US$ 1 a 3/mês. Migração para Cloud SQL quando liberar orçamento, **antes de conhecimento confidencial ou do time** |

## B. Migração das skills
| # | Decisão | Consequência |
|---|---|---|
| 8 | **Um repositório por skill** (D3 fechada) | Catálogo central fixando o SHA de cada uma |
| 9 | Entram as **skills principais + subskills que elas usam**; bibliotecas só se alguma skill depender | Levantamento de dependências na especificação de migração |
| 10 | **6 atalhos**: `/odin:discovery`, `/odin:spec`, `/odin:build`, `/odin:data`, `/odin:test`, `/odin:status` | Prompts MCP correspondentes |
| 11 | Bibliotecas de terceiros: **manter só as usadas**, como pacote compartilhado com `LICENSE` e `NOTICE`; o Claude levanta as licenças e o mantenedor valida | Remoção das não usadas |
| 12 | `karpathy-guidelines.md`: **fundir numa versão**, proposta pelo Claude e aprovada pelo mantenedor | Fim da colisão |
| 13 | Regras dos `CLAUDE.md` **movidas para as skills**; `CLAUDE.md` fica para mantenedores | Item da especificação de migração |

## C. Desenho
| # | Decisão | Consequência |
|---|---|---|
| 14 | **Modo degradado com cópia local assinada por 7 dias** das skills já usadas e ainda permitidas | O conteúdo da skill entra no pacote assinado do runtime; sem contato com o Odin por 7 dias, a cópia vence |
| 15 | **Versão fixa por sessão**; a versão nova vale na próxima sessão (exceto versão proibida, que sempre bloqueia) | Resolve sessões paralelas e troca de runtime durante um script |
| 16 | Credenciais de terceiros **ficam na máquina**; o guard protege | O **token do Jira fica na máquina local do usuário**, usado pelo **MCP remoto oficial da Atlassian** que o Discovery chama para publicar (**em uso hoje com OAuth**: configurado no Claude Code e autenticado pelo navegador; token de API só como alternativa, com `headersHelper` lendo do cofre do sistema, [segurança 06, 3.1](seguranca/06-seguranca-do-endpoint.md)); o `jira.config.json` não tem credencial. O `sf` CLI usa a autenticação dele. O Odin **não guarda, não lê e não repassa** credenciais de terceiros. O guard nega ao modelo a leitura dos locais onde o token fica (política PG-01), sem impedir o MCP do Jira de usá-lo |
| 17 | Intenções de roteamento: **o Claude propõe 20 por skill**, o mantenedor revisa; meta ≥ 90% de acerto | Entregável na especificação de migração |
| 18 | **Conhecimento começa vazio**; o mantenedor vai criar uma skill ou estrutura de *system patterns* que cresce com o tempo | Essa estrutura vira a fonte da coleção `tecnico` (formato de [plano, seção 11.2](PLANO.md)) |
| 19 | Meta do RAG: **≥ 80% no top 5** | Avaliação por coleção |
| 20 | **Curador único na PoC: o mantenedor** (D2 fechada para a PoC) | Definição por projeto antes do time |
| 21 | **2 a 3 squads e 1 a 2 projetos** no desenho inicial | Massa de teste e isolamento entre projetos |
| 22 | CLI: **versão atual + anterior por 30 dias** | Matriz de compatibilidade com duas versões |
| 23 | **Maioria em Windows nativo** | Windows nativo vira prioridade 1 na F0 e na F5 (hooks, cofre, caminhos, Playwright) |
| 24 | **Maioria na extensão do VS Code** | Extensão do VS Code vira prioridade 1 na F0 |

## D. Identidade e segurança
| # | Decisão | Consequência |
|---|---|---|
| 25 | **TOTP obrigatório para todos; passkey obrigatória para administradores** | Como em [segurança 02](seguranca/02-autenticacao-e-mfa.md) |
| 26 | **Na PoC só o mantenedor administra** (com uma segunda conta de teste para exercitar o quatro olhos) | **Pré-requisito antes do time:** nomear um segundo super-admin |
| 27 | **Sem correlação com o LiteLLM.** As chaves e o consumo do LiteLLM são da empresa; o Odin mede **só o consumo do próprio MCP** | Item de correlação removido do plano e da arquitetura (R10 encerrado) |
| 28 | Cotas iniciais **aceitas**, para calibrar na PoC | Como em [portal 06](portal/06-consumo-cotas-e-metricas.md) |

## E. Operação e entrega
| # | Decisão | Consequência |
|---|---|---|
| 29 | **Migração de todos de uma vez** (corte único depois da validação pessoal) | Exige ensaio do corte, guia de uma página, plano de volta (manter as cópias arquivadas por 30 dias) e janela combinada com o time |
| 30 | Suporte: **o mantenedor, por issues no GitHub** | Modelos de issue (problema, pedido de acesso, sugestão de skill) no repositório Odin |
| 31 | **Só o mantenedor aprova skills novas** | Sem quatro olhos no catálogo por ora; a regra "aprovação de outra pessoa" em `catalog/` fica suspensa até haver um segundo mantenedor. O CI e a assinatura continuam obrigatórios |
| 32 | **SLO de 99,5%, horário comercial, sem plantão** | O modo degradado de 7 dias cobre quedas fora do horário |
| 33 | Carga: **50 usuários** agora (a arquitetura suporta 500) | Teste de carga com 50 |
| 34 | **Emuladores locais** agora; ambiente de teste junto com a produção | Testes de ponta a ponta locais e na PoC |
| 35 | Construção: **mantenedor + Claude, tempo integral** | Estimativa no [plano, seção 16.1](PLANO.md) |

## F. Terceiros, jurídico e infraestrutura
| # | Decisão | Consequência |
|---|---|---|
| 36 | **Notificações só no portal** na PoC | E-mail decidido antes do time |
| 37 | **Sem jurídico ou DPO** (PoC pessoal) | **Pendência obrigatória antes do time:** base legal LGPD, termos de uso, aviso de privacidade e licenças de terceiros |
| 38 | **Uma região** em produção, backup e restauração em até 4 h | Sem réplica em outra região |
| 39 | Ferramenta de empacotamento do CLI **escolhida pelo Claude na F0** | Registrada como ADR |

## F2. Complemento
| # | Decisão | Consequência |
|---|---|---|
| 41 | **GitHub Free sempre** na organização | Repositórios privados sem proteção de branch, revisão obrigatória, tags protegidas, ambientes com aprovação e atestação de origem [VERIFICAR nos planos atuais]. **Só o mantenedor escreve**; o time lê o `odin-suporte` e abre issues. Compensações permanentes em [segurança 05](seguranca/05-cadeia-de-suprimentos.md) e na [arquitetura técnica, 7.1](arquitetura/03-arquitetura-tecnica.md); risco R18 |

## G. Entregáveis
| # | Decisão | Consequência |
|---|---|---|
| 40 | **Protótipo HTML navegável** do portal (usuário e console) | Entregável novo em `prototipo/` no repositório Odin |

## Riscos que estas decisões criam
| Risco | Mitigação |
|---|---|
| **Pessoa única** (administração, aprovação de skills, curadoria e suporte com o mantenedor) | Segundo super-admin antes do time; runbooks escritos; contas de emergência guardadas |
| **Corte único** da migração | Ensaio do corte com 2 a 3 pessoas da validação pessoal, plano de volta, cópias arquivadas por 30 dias |
| **Firestore na PoC** (isolamento só na aplicação, sem busca híbrida) | Nenhum conhecimento confidencial até a migração para Cloud SQL |
| **Sem quatro olhos no catálogo** | CI obrigatório, assinatura, canal `beta` e rollback; volta a exigir segunda aprovação quando houver segundo mantenedor |
| **Sem jurídico** | Bloqueio formal: o time não entra sem a validação |

## Entregáveis que estas decisões geram
1. `docs/F0-ROTEIRO.md`: roteiro da F0 com prioridade para Windows nativo e extensão do VS Code.
2. `docs/MIGRACAO-SKILLS.md`: especificação por skill (`odin.yaml`, caminhos, hooks → políticas, regras do `CLAUDE.md`, bibliotecas, 20 intenções de roteamento).
3. `schemas/`: JSON Schema do `odin.yaml`, do manifesto assinado e das 7 ferramentas MCP.
4. `prototipo/`: protótipo HTML do portal.
