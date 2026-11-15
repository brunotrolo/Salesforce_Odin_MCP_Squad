# Regras invioláveis (com a fonte)

Mudar qualquer uma exige ADR (`odin-arquiteto`). As marcadas com **[CF-nn]** têm teste de conformidade em `scripts/conformidade.mjs`.

## Governança
| # | Regra | Fonte |
|---|---|---|
| G1 | Documento protegido só muda com ADR aberto; o hook bloqueia e o CI recusa | ADR 0016 |
| G2 | GitHub Free: só o mantenedor escreve; branch + PR + CI verde; merge com o "ok" do mantenedor | Decisão 41; segurança 05 |
| G3 | Uma fase só fecha com critérios do plano, revisores independentes e testes verdes | Plano 16; segurança 10, seção 3 |
| G4 | Sem segredo, dado de cliente, alias de org ou nome real em nada versionado **[CF-08]** | Plano 1; segurança 08 |
| G5 | Português do Brasil em documentos, interface e mensagens | Portal 08 |

## Identidade e tokens
| # | Regra | Fonte |
|---|---|---|
| I1 | Login GitHub + segundo fator do Odin (TOTP; passkey para administradores); SMS não | Segurança 02; decisão 25 |
| I2 | Pessoa identificada pelo id numérico do GitHub, nunca pelo login | ADR-02 |
| I3 | CLI ativa por device flow aprovado no portal com MFA < 5 min; credencial presa à chave do dispositivo | Segurança 02 e 03 |
| I4 | Token de acesso JWT ES256, `typ=at+jwt`, `aud=https://mcp.<dominio>`, **15 min**, sem perfis dentro **[CF-05] [CF-07]** | Segurança 03 |
| I5 | Refresh rotativo, detecção de reuso revoga a família, prova de posse `private_key_jwt` | Segurança 03 |
| I6 | Revogação efetiva ≤ 30 s; revogação global por carimbo de tempo | Segurança 03; arquitetura 03, 5.5 |
| I7 | Token do MCP nunca administra; console só no portal com MFA < 15 min e passkey | Segurança 02, 3.4 |

## Autorização
| # | Regra | Fonte |
|---|---|---|
| A1 | Negado por padrão; direitos resolvidos no servidor (cache 30 s, `policyVersion`) | Segurança 04; ADR-05 |
| A2 | Isolamento por projeto na aplicação e, antes de qualquer conhecimento confidencial, também no banco (política de linha no Cloud SQL) | Segurança 04; decisões 7 e 43 |
| A3 | Ninguém aprova o próprio pedido; quatro olhos em papéis e configurações | Segurança 04; portal 05 |

## MCP e orquestração
| # | Regra | Fonte |
|---|---|---|
| M1 | No máximo **7 ferramentas**; respostas ≤ 8.000 tokens; instruções do servidor ≤ 4.096 caracteres **[CF-06]** | Plano 10; risco R11 |
| M2 | Sem modelo no caminho principal (roteamento por regras + embeddings) | Plano 1 e 10 |
| M3 | Versão da skill fixa por sessão; versão proibida bloqueia na hora | Decisão 15 |
| M4 | Modo degradado: cópia local assinada por até 7 dias | Decisão 14 |
| M5 | O MCP grava os metadados das ferramentas em `mcp_tools` (o portal lê) | Portal 09 |
| M7 | MCP com resposta JSON por requisição, sem fluxo SSE permanente; contratos das ferramentas em `schemas/mcp-tools.json` | Arquitetura 03, 6.1; decisões 47 e 48 |
| M6 | Economia de contexto: trabalho pesado por script local que devolve só o resumo; alvo de 5.000 tokens por `SKILL.md` e referência | Plano 10; ADR 0017 |

## Máquina do usuário
| # | Regra | Fonte |
|---|---|---|
| D1 | Nunca escrever no projeto do dev; só pastas e blocos do Odin **[CF-09]** | Plano 22 |
| D2 | Guard fail-closed; o `odin ensure` só continua com o marcador recente gravado pelo guard (prova de vida) | Plano 7.3 e 7.4 |
| D3 | Políticas globais PG-01 a PG-08, com equivalentes Windows (PowerShell e `cmd`) | Segurança 06 |
| D4 | Credenciais de terceiros (Jira, `sf`) ficam na máquina; o Odin nunca as lê | Decisão 16; segurança 06, 3.1 |
| D5 | Prioridade de teste: Windows nativo e extensão do VS Code | Decisões 23 e 24 |
| D6 | `odin ensure` confere os hashes do runtime contra o manifesto assinado na primeira chamada de cada skill na sessão; divergência reinstala e gera DT-19 | Plano 7.2; ADR 0017 |

## Distribuição e nuvem
| # | Regra | Fonte |
|---|---|---|
| N1 | Sem chave de conta de serviço **[CF-01]**; CI por identidade federada com `actor_id` do mantenedor e `main` **[CF-04]** | Segurança 07; decisão 41 |
| N2 | Pacotes e CLI assinados no KMS; o CLI verifica com chave embutida; bucket do CLI privado, servido pelo portal **[CF-03]** | Segurança 05 |
| N3 | Ações do GitHub Actions fixadas por SHA completo **[CF-10]** | Segurança 05 |
| N4 | Cloud SQL só com IP privado **[CF-02]** (quando existir) | Segurança 07 |
| N5 | Custo por estágio: `min 0` e `max 3` instâncias, sem Load Balancer, Cloud Armor, NAT, conector de VPC ou Memorystore em E0 e E1; Cloud SQL só com conhecimento confidencial; orçamento com disjuntor; limpeza do Artifact Registry **[CF-11 a CF-14]** | Arquitetura 05; decisões 7 e 42 a 45 |
| N9 | 3 serviços + 3 jobs; sem webhooks e sem Pub/Sub de aplicação em E0 e E1; o `odin-publisher` confere a assinatura antes de registrar | ADR 0018; decisão 46 |
| N6 | Região `southamerica-east1` | ADR-14 |
| N7 | Nenhum Unicode oculto em documento, skill, pacote ou conhecimento **[verificar:docs, verificar:skills]** | Segurança 06 §5; ADR 0017 |
| N8 | Promoção para `stable` só com avaliação de comportamento do SHA, sem queda maior que 5 pontos nem caso crítico falhando | Plano 8.4; ADR 0017 |
