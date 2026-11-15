# Fases F0 a F10

Fonte: `docs/PLANO.md` seções 16, 16.1 e 23; critérios de segurança por fase em `docs/seguranca/10-controles-e-testes.md` seção 3. Esta página diz **como executar** cada fase com esta skill; os critérios oficiais estão nos documentos.

Regra geral de cada fase: (1) ler os documentos listados; (2) quebrar em tarefas pequenas, cada uma ligada a um critério; (3) ciclo da tarefa do SKILL.md; (4) fechar com o checklist da fase, os revisores e o "ok" do mantenedor; (5) ESTADO atualizado.

## F0 · Verificações (1 semana)
- **Ler:** plano 16 (F0), arquitetura 03 seção 14, decisões 2, 3, 23, 24, 39, segurança 06 (Windows, Jira).
- **Entregar:** `docs/F0-ROTEIRO.md` a partir de `templates/F0-roteiro.md`; servidor MCP de teste mínimo (Node, Streamable HTTP, 2 ferramentas, `headersHelper` com token fictício, um prompt, um recurso, instruções do servidor); hook de teste; agente de teste; escolha da ferramenta de empacotamento do CLI (ADR).
- **Testes:** executados **pelo mantenedor** no Windows nativo, primeiro na extensão do VS Code e depois no terminal, com o LiteLLM real.
- **Fechar:** um ADR por resultado que confirma ou muda premissa; documentos atualizados; `[VERIFICAR]` resolvidos viram `[CONFIRMADO]` ou decisão nova.

## F1 · Fundação (0,5 semana)
- **Ler:** arquitetura 03 seções 1, 2, 3, 11; segurança 07; decisões 1, 6, 7, 41.
- **Entregar:** `infra/` (Terraform: projeto, APIs, orçamento com alerta em US$ 5, Cloud Run vazio, Artifact Registry, Firestore, KMS com `bundle-signing`, `cli-signing` e `jwt-signing`, Secret Manager, WIF com `actor_id` e `main`), workflows `ci.yml`, `deploy.yml`, `infra.yml` a partir de `templates/github-workflows/`.
- **Testes:** `terraform validate` e `plan` no CI; conformidade CF-01, CF-03, CF-04, CF-10; implantação de um serviço "olá" com fumaça pós-deploy.
- **Aceite:** apply do zero < 15 min; CI publica imagem sem chave.

## F2 · Identidade (1,5 semana)
- **Ler:** segurança 02, 03, 04; arquitetura 03 seção 5; portal 03 (entrar, ativar, conta).
- **Entregar:** Identity Platform com GitHub; MFA (TOTP e passkey, códigos de recuperação); `odin-sts` (device flow, refresh com prova de posse e detecção de reuso, JWKS, revogação, carimbo global); portal mínimo (entrar, ativar, dispositivos, revogar).
- **Testes:** CT-01 a CT-05 e CT-23; casos negativos de JWT (alg none, HS256, aud trocado, expirado); reuso de refresh; revogação ≤ 30 s com relógio controlado.

## F3 · Catálogo e publicação (1,5 semana)
- **Ler:** plano 8 e 22; segurança 05; portal 07; decisões 8 a 13.
- **Entregar:** schema do `odin.yaml` e do manifesto, `catalog/`, `odin lint`, `publish.yml` (lê skills privadas com token do GitHub App, empacota com dependências, assina, publica, registra eventos do ciclo de vida), canais beta e stable.
- **Testes:** CT-12 a CT-14, CT-25 e CT-27; pacote adulterado recusado; pacote com `CLAUDE.md`, colisão de nome ou Unicode oculto recusado; avaliação determinística falhando bloqueia; promoção sem relatório do SHA recusada; reprodutibilidade (mesmo commit → mesmo hash).
- **Reaproveitar:** `scripts/lib/unicode.mjs` deste repositório no `odin lint`.

## F4 · MCP (1,5 semana)
- **Ler:** plano 10; arquitetura 03 seção 6; portal 04, 06, 09.
- **Entregar:** `apps/mcp-server` com as 7 ferramentas, prompts `/odin:*`, recursos `skill://`, instruções do servidor, autorização por perfil e projeto, cotas, auditoria, `mcp_tools`, API `/v1`.
- **Testes:** contrato de cada ferramenta (entrada, saída, tamanho ≤ 8.000 tokens, erros estáveis); CT-06, CT-07, CT-10, CT-21; roteamento ≥ 90% no conjunto de intenções; fumaça e sintético no Google Cloud; `GET` no endpoint MCP responde 405 (sem fluxo SSE); definições carregadas de `schemas/mcp-tools.json`.

## F5 · Runtime local (2 semanas)
- **Ler:** plano 7 e 22; segurança 06; decisões 14, 15, 22, 23, 24.
- **Entregar:** `packages/cli` (setup, login, token, ensure, doctor, guard-ping, update, uninstall, restore-copias), `packages/guard` com PG-01 a PG-08 e as políticas das skills, skill local `odin`, `ODIN.md`, blocos marcados, cópia local de 7 dias, versão fixa por sessão.
- **Testes:** matriz Windows nativo (PowerShell e `cmd`), macOS e Linux no CI; CT-15, CT-24 e CT-26 (arquivo do runtime alterado → detectado, reinstalado, DT-19); isolamento (nada escrito no projeto); `uninstall` devolve os arquivos idênticos; guard ausente bloqueia.

## F6 · Adaptação das 10 skills (4,5 semanas)
- **Ler:** `docs/PIPELINE.md` (etapas, encadeamento, fronteiras, pontos de atenção por skill).
- Use a skill `odin-curador` para cada uma. **Aceite:** testes atuais de cada skill passam a partir do runtime do Odin; `evals/` com ao menos 10 casos e nota de referência registrada (o Test Automator já tem os bugs plantados como base); uma tarefa real de cada skill completa ponta a ponta.

## F7 · Conhecimento (1 semana)
- **Ler:** plano 11; arquitetura 03 seções 4.3 e 4.3.1; segurança 08; decisões 18 a 20.
- **Entregar:** `KnowledgeStore` (implementação Firestore em uso; implementação pgvector com política de linha testada em contêiner, pronta para o gatilho), `odin-indexer`, avaliação de recuperação, curadoria no portal, ingestão da estrutura de *system patterns* do mantenedor.
- **Testes:** ≥ 80% no top 5; isolamento entre projetos na aplicação; injeção e Unicode oculto rejeitados na ingestão.

## F8 · Operação (1 semana)
- **Entregar:** painéis, alertas (Cloud Monitoring com e-mail ao mantenedor), coletor de auditoria, runbooks testados, teste sintético no `odin-tick`, teste de carga com 50 usuários dentro do teto de 3 instâncias, medição da partida a frio (p95 ≤ 3 s), **ensaio do disjuntor de custo** (CT-28, RB-13).
- **Aceite:** simulações de RB-02, RB-04, RB-09 em < 10 min cada; carga dentro dos SLOs.

## F9 · Validação pessoal (2 semanas)
Uso real pelo mantenedor (perfis PO e dev, duas contas de teste). Checklist do plano, seção 17, todo verde. Simulação de incidente.

## F10 · Preparação para o time (1,5 semana)
Portão 2 (plano, seção 23.2) completo, ensaio do corte (23.3), repositório `odin-suporte` (23.4), guia de uma página, pentest externo.
