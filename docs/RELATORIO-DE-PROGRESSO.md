# Relatório de progresso

> Foto do projeto em **15/11/2026**: o que foi feito, como verificar, o que ainda não existe e o que resta fazer, na ordem recomendada. O estado vivo e o próximo passo ficam em [ESTADO.md](ESTADO.md); este arquivo é o resumo para quem chega agora (pessoa ou outra sessão do Claude).

## 1. Em uma página

O **Odin** é um servidor MCP único para o time (POs, devs, QA, arquitetos) usar as skills de engenharia no Claude Code. A pessoa entra com o GitHub, ativa o CLI uma vez e pede em linguagem natural; o Odin escolhe a skill que ela pode usar, entrega a versão aprovada e assinada, garante o runtime e o guard de segurança na máquina e responde com conhecimento citado.

| | Situação |
|---|---|
| Plano, decisões, arquitetura, segurança, portal | **Completos** e alinhados (53 decisões, 20 ADRs, 25 riscos) |
| 10 skills organizadas no ciclo de desenvolvimento | **Feito** ([PIPELINE.md](PIPELINE.md)) |
| Código do caminho completo, rodando local | **Feito e testado** (44 testes, CI em Linux e Windows) |
| 10 skills reais passando pelo Odin | **8 em rascunho**, 2 bloqueadas pelo lint |
| Portal | **Não existe** |
| Nuvem (Google Cloud) | **Nada criado**; só desenhada |
| Claude Code real conectado (Windows, VS Code, LiteLLM) | **Não testado** (maior risco em aberto) |
| Custo | Nenhum até agora; meta de até US$ 3/mês na prova de conceito e US$ 25/mês com o time |

Para ver funcionando em segundos: `npm ci && npm run demo`.

## 2. O que foi feito

### 2.1 Documentação e decisões
| Entrega | Onde |
|---|---|
| Plano com 23 seções, fases F0 a F10, riscos, revisões 1 a 19 | [PLANO.md](PLANO.md) |
| 53 decisões do mantenedor (respostas de múltipla escolha) | [DECISOES.md](DECISOES.md) |
| Arquitetura de solução, funcional, técnica, portal e custos | [arquitetura/](arquitetura/01-arquitetura-de-solucao.md) |
| Segurança: ameaças, autenticação e MFA, tokens, autorização, cadeia de suprimentos, endpoint, GCP, LGPD, detecção, controles, runbooks | [seguranca/](seguranca/README.md) |
| Portal: área do usuário, console, consumo, ciclo de vida das skills, UX, API, critérios de aceite | [portal/](portal/README.md) |
| Pipeline das 10 skills no ciclo | [PIPELINE.md](PIPELINE.md) |
| Prontidão de migração das skills reais (gerado) | [MIGRACAO-SKILLS.md](MIGRACAO-SKILLS.md) |
| Registro de decisões de arquitetura (ADR 0016 a 0020) | [adr/](adr/README.md) |
| Apresentação interativa (publicada e para baixar) | `apresentacao/` |

### 2.2 Decisões de arquitetura e o que cada ADR mudou
| ADR | Tema | Resultado |
|---|---|---|
| 0016 | Skill de desenvolvimento e sustentação | `CLAUDE.md`, `ESTADO.md`, skills `odin-dev`, `odin-curador`, `odin-arquiteto`, `odin-operacao`, 5 agentes somente leitura, hook que protege os documentos de referência, verificações e CI |
| 0017 | Qualidade das skills | Avaliações de comportamento com portão de promoção; recusa de Unicode oculto; integridade do runtime no uso (DT-19); economia de contexto |
| 0018 | Arquitetura enxuta e custo | Estágios de custo E0, E1, E2 com gatilhos medidos; 3 serviços + 3 jobs; sem webhooks nem Pub/Sub; teto de 3 instâncias e disjuntor de custo; MCP com resposta JSON; contratos em `schemas/`; regras de custo no CI; governança do repositório |
| 0019 | Pipeline com 10 skills | 6 etapas, skills lado a lado, 11 atalhos, perfis; migração das skills passa a 4,5 semanas |
| 0020 | Local primeiro | Interfaces com implementação local e de nuvem; prova de vida do guard pelo `odin ensure`; pacote `.odinpkg`; ajustes de implementação |

### 2.3 Código construído (tudo local, em TypeScript executado direto pelo Node 22)
| Parte | Pasta | O que faz |
|---|---|---|
| Base compartilhada | `packages/shared` | JWT ES256 estrito, assinatura atrás de interface, armazenamento de documentos e de pacotes atrás de interface, auditoria, limites, erros estáveis, formato de pacote determinístico |
| Emissor de tokens | `apps/sts` | Ativação do dispositivo (RFC 8628) com código de 10 minutos e uso único; token de 15 minutos sem perfis dentro; renovação com prova de posse da chave do dispositivo; reuso de credencial derruba a família; revogação por dispositivo, pessoa e global |
| Servidor MCP | `apps/mcp-server` | 7 ferramentas (carregadas de `schemas/mcp-tools.json`), atalhos por perfil, instruções do servidor, direitos resolvidos no servidor com cache de 30 s, API `/v1` do CLI, auditoria sem o texto do pedido; sem conexão permanente (`GET` responde 405) |
| Roteador e catálogo | `packages/router`, `catalog/` | Catálogo das 10 skills com intenções positivas e negativas; roteador léxico; 95% no conjunto de avaliação (36 de 38); "não sei" fora do escopo ou de skill fora do perfil |
| Lint e publicação | `packages/lint`, `pipeline/`, `apps/jobs` | `odin lint` (arquivos proibidos, Unicode oculto, segredos, tamanho, passo `odin ensure`, colisões); empacotamento; manifesto assinado; publisher que confere assinatura e hashes antes de registrar |
| Guard | `packages/guard` | Políticas PG-01 a PG-08 para Bash, PowerShell e `cmd`; qualquer erro interno bloqueia |
| CLI | `packages/cli` | `setup`, `login`, `token`, `ensure`, `doctor`, `status`, `logout`, `uninstall`; escreve só em `~/.odin`, em pastas próprias de `~/.claude` e em blocos marcados; desinstala devolvendo os arquivos como estavam |
| `odin ensure` | `packages/cli/src/ensure.ts` | Confere assinatura e hash de cada arquivo; instala de forma atômica; versão fixa por sessão; modo degradado de 7 dias; versão proibida bloqueia; integridade no uso |
| Ambiente local | `dev/` | `npm run demo` (dez passos narrados) e `npm run dev` (Odin local para o Claude Code) |
| Skill de apoio | `skills/odin-ambiente` | Confere se a máquina está pronta (Node, Git, Salesforce CLI, org, Playwright) |
| Migração | `scripts/prontidao-skills.ts` | Gera rascunho de `odin.yaml` por skill e o relatório de prontidão |

### 2.4 Contratos e verificações automáticas
- **`schemas/`:** `odin.yaml`, manifesto assinado, casos e resultado de avaliação, evento de auditoria, descoberta, as 7 ferramentas MCP e a API `/v1` (OpenAPI 3.1), com exemplos.
- **`npm run verificar`:** documentação (links, seções, tabelas, termos descartados, Unicode oculto, ADR obrigatório para documento protegido), skills e agentes, contratos, conformidade de segurança e de custo (CF-01 a CF-14), roteamento (meta de 90%) e tipos.
- **Testes (44):** ponta a ponta com o cliente oficial do MCP; guard (cada política com casos de permitir e negar); tokens, emissor e publicação adulterada; lint; contratos; hook de documentos; ADR.
- **CI:** Linux e Windows, com cancelamento de execuções repetidas e tempo limite; ações fixadas por SHA; Dependabot.

### 2.5 As 10 skills reais
Resultado do `odin lint` em modo rascunho (sem alterar os repositórios delas). Detalhe em [MIGRACAO-SKILLS.md](MIGRACAO-SKILLS.md).

| Etapa | Skill | Situação |
|---|---|---|
| 1 | Archaeologist | Publicável em rascunho |
| 2 | Discovery-to-Backlog | Publicável em rascunho |
| 3 | Data Architect | **Bloqueada**: uma referência com cerca de 16 mil tokens (teto de 8 mil) e um caractere invisível num template HTML |
| 3 | Journey Designer | Publicável em rascunho |
| 4 | Journey Developer | Publicável em rascunho |
| 4 | LWC Developer | Publicável em rascunho |
| 4 | Apex Callouts Developer | **Bloqueada**: uma referência 97 tokens acima do teto; também precisa sair de FSC para Service Cloud |
| 5 | Apex Cover Loop | Publicável em rascunho |
| 5 | Test Automator | Publicável em rascunho |
| 6 | Deep Debugger | Publicável em rascunho |

### 2.6 Como verificar
```bash
npm ci
npm run demo        # o Odin de ponta a ponta, em pasta temporária
npm test            # 44 testes
npm run verificar   # documentação, skills, contratos, conformidade, roteamento, tipos
npm run dev         # Odin local + instruções para conectar o seu Claude Code
npm run prontidao   # regenera docs/MIGRACAO-SKILLS.md
```

## 3. O que ainda não existe

| Item | Observação |
|---|---|
| **Portal** (login com GitHub, segundo fator, console, consumo, histórico das skills) | A ativação hoje usa uma página de desenvolvimento que escolhe uma pessoa fictícia |
| **Implementações de nuvem** (Firestore, Cloud Storage, Cloud KMS, Vertex AI) | Estão atrás de interfaces; hoje só a versão local existe |
| **Terraform e projeto `salesforcemcpodin`** | Criados e homologados em 2026-11-16 (20/20, ver [HOMOLOGACAO.md](HOMOLOGACAO.md)) |
| **Claude Code real** (Windows nativo, extensão do VS Code, LiteLLM, `headersHelper`) | Os testes usam o cliente oficial do MCP; ninguém conectou um Claude Code de verdade |
| **Cofre do sistema** (Credential Manager, Keychain, libsecret) | Hoje arquivo com permissão restrita, só para desenvolvimento (risco R25) |
| **Binário do CLI** e instalador servido pelo portal | Hoje roda por Node |
| **Migração completa das 10 skills** | Só rascunho de contrato; faltam regras dos `CLAUDE.md`, hooks como políticas do guard, biblioteca de terceiros em pacote único, 20 intenções revisadas |
| **Avaliações de comportamento** (`evals/`) por skill | Contrato e guia prontos (ADR 0017); casos ainda não escritos |
| **Base de conhecimento real** | Só quatro trechos fictícios; sem curadoria, sem indexação do `odin-knowledge`, sem busca vetorial |
| **Teste de carga, sintético e disjuntor** | Desenhados; dependem da nuvem |
| **Apresentação** | Mostra o pipeline das 10 skills, mas ainda não mostra o código funcionando |

## 4. O que resta fazer, na ordem recomendada

### Passo A. Primeira prova real com o Claude Code (mantenedor, cerca de meio dia)
Rodar `npm run dev`, conectar o Claude Code da máquina (Windows e extensão do VS Code) e pedir "minha máquina está pronta para as skills?". Registrar o que acontecer. Isso responde de uma vez as perguntas que não dá para testar daqui:
- o `headersHelper` renova o token em 401 no escopo do usuário;
- o MCP com resposta JSON e sem fluxo SSE funciona;
- o hook do guard dispara no Windows e na extensão;
- o agente materializado em `~/.claude/agents/` é visto sem reiniciar;
- a importação `@~/.odin/ODIN.md` no `CLAUDE.md` do usuário funciona;
- a busca de ferramentas através do LiteLLM (risco R11).

### Passo B. Migrar as 10 skills de verdade (Claude, 4,5 semanas)
Com a skill `odin-curador`, uma de cada etapa primeiro:
1. Destravar as duas bloqueadas (dividir a referência grande, remover o caractere invisível, ajustar o Callouts para Service Cloud).
2. Mover as regras dos `CLAUDE.md` para dentro de cada skill; transformar os hooks em políticas do guard, com testes.
3. Fundir `karpathy-guidelines.md` (7 cópias) e extrair as bibliotecas de terceiros repetidas para um pacote compartilhado, com licença e aviso.
4. Escrever as 20 intenções por skill e revisar com o mantenedor; calibrar o roteamento.
5. Escrever as avaliações de comportamento (mínimo de 10 casos por skill) e registrar a nota de referência.
6. Uma tarefa real de cada skill, completa, pelo Odin.

### Passo C. Portal (Claude, cerca de 3 semanas)
Login com GitHub, segundo fator (TOTP; passkey para administradores), ativação de dispositivo, área do usuário, console de administração (pessoas, squads, perfis, catálogo, consumo, auditoria), guia do MCP. Critérios de aceite em [portal/10](portal/10-criterios-de-aceite.md).

### Passo D. Operação local (Claude)
Cofre do sistema atrás da interface `Cofre`; `odin doctor --orgs` para classificar orgs como sandbox; empacotamento do CLI como executável único; indexador do conhecimento a partir do repositório `odin-knowledge`; testes em Windows nativo no CI para o guard e o CLI com PowerShell.

### Passo E. Levar para a nuvem (mantenedor + Claude, estágio E0)
1. ~~Mantenedor cria o projeto `salesforcemcpodin` no Google Cloud.~~ Feito.
2. Terraform da F1: orçamento, disjuntor de custo, limpeza do Artifact Registry, Workload Identity Federation restrita ao mantenedor, `run.app`.
3. Implementações de nuvem atrás das interfaces, testadas com emuladores.
4. F0 no Claude Code real contra o servidor na nuvem: partida a frio, preços na região, LiteLLM.
5. Ensaio do disjuntor e teste de carga com 50 usuários.

### Passo F. Preparar o time (Portão 2)
Organização GitHub com 2FA; projeto `prod` no estágio E1; segundo super-admin; jurídico (LGPD, termos, licenças de terceiros); pentest externo; guia de uma página; repositório de suporte; ensaio do corte com 2 a 3 pessoas. Depois, o corte único.

## 5. Pendências do mantenedor
| Item | Para quê |
|---|---|
| Rodar o Passo A e relatar o resultado | Fecha os maiores riscos de uma vez |
| Revisar as decisões 42 a 52 (tomadas por delegação) | Estágios de custo, sem WAF e sem webhooks no time, 10 skills, 11 atalhos |
| Confirmar os perfis propostos para as skills novas ([PIPELINE.md](PIPELINE.md), seção 6) | O catálogo usa essa proposta |
| Criar o projeto `salesforcemcpodin` | Libera o Passo E |
| Definir quem será o segundo super-admin e o responsável jurídico | Exigências do Portão 2 |

## 6. Riscos mais relevantes agora
| # | Risco | Tratamento |
|---|---|---|
| R11 | Busca de ferramentas pode não passar pelo LiteLLM | Passo A; o Odin já tem só 7 ferramentas e descrições curtas |
| R24 | Nuvem por último concentra risco no fim | Interfaces com duas implementações; Passo E logo depois do Passo A |
| R25 | Cofre em arquivo | Só desenvolvimento local; troca no Passo D |
| R20 | Sem WAF para o time | Token em toda rota, limites, teto de instâncias, disjuntor, pentest |
| R15 | Pessoa única operando | Segundo super-admin e runbooks antes do time |
| R17 | Sem jurídico | Bloqueio formal: o time não entra sem a validação |

Lista completa em [PLANO.md, seção 18](PLANO.md).

## 7. Estimativa
Cerca de 18 semanas (± 30%) com o mantenedor e o Claude em tempo integral, contadas desde o início. Desse total, o plano, a arquitetura, o primeiro código local e a prontidão das skills já estão prontos. O maior bloco restante é a migração das 10 skills (4,5 semanas), seguido do portal (cerca de 3) e da nuvem com o Terraform, a F0 e a carga (cerca de 3).
