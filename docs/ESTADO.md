# Estado do projeto

> Atualizado a cada sessão (skill `odin-dev`, passo final). Uma sessão nova começa por aqui.
> **Última atualização:** 2026-11-16

## Agora
- **Fase:** **nuvem homologada** (26/26, [HOMOLOGACAO.md](HOMOLOGACAO.md)): serviços no Cloud Run, as 10 skills reais em beta e o portal com login GitHub. Localmente, `npm run demo` e `npm run dev` continuam funcionando.
- **Pronto e testado (44 testes, CI em Linux e Windows):** emissor de tokens (`apps/sts`), servidor MCP com as 7 ferramentas e a API `/v1` (`apps/mcp-server`), roteador e catálogo das 10 skills (`packages/router`, `catalog/`), `odin lint` e pipeline de publicação assinada (`packages/lint`, `pipeline/`), publisher que confere a assinatura (`apps/jobs`), guard com PG-01 a PG-08 (`packages/guard`), CLI (`packages/cli`), skill de apoio `odin-ambiente`.
- **Skills reais:** as 10 passam no `odin lint` e estão publicadas na nuvem em rascunho (canal beta); para chegar ao `stable` falta o checklist do `odin-curador` e as avaliações de comportamento ([MIGRACAO-SKILLS.md](MIGRACAO-SKILLS.md)).
- **Ainda não existe:** login do portal com GitHub e segundo fator (o portal interino por segredo e convite existe), avaliações de comportamento por skill (a infraestrutura existe; faltam os casos), Vertex AI e binário do CLI.
- Documentação: plano, decisões (53), arquitetura, segurança, portal, pipeline das skills, contratos em `schemas/`.

## Feito (resumo, mais recente primeiro)
- 2026-11-16 · **Endurecimento** (ADR 0025): `sa-ci-infra` sem Owner (validado), disjuntor testado de verdade, avaliações determinísticas nas 10 skills; contrato `odin.yaml` e `odin ensure` dentro dos repositórios das skills.
- 2026-11-16 · **Login com GitHub no portal** (ADR 0024) e **10 skills reais na nuvem** (Data Architect incluído, via `SKILLS_READ_TOKEN`).
- 2026-11-16 · **Portal interino** (ADR 0023): `/admin` (segredo de administração) e `/conta` (convite de uso único) no serviço do emissor; testes locais (4) e homologação H22 a H25 na nuvem: **25/25**. Manual: [MANUAL-DO-PORTAL.md](MANUAL-DO-PORTAL.md).
- 2026-11-16 · **Carga autenticada do MCP medida**: 50 usuários, p95 1259 ms, zero erros (meta 2 s).
- 2026-11-16 · **Avaliações por skill: infraestrutura pronta** (ADR 0017): `pipeline/avaliar.ts` roda a camada determinística, confere a composição mínima (10 casos: 4 positivos, 3 negativos, 2 de injeção, 1 de limite) e aplica o portão de promoção beta → stable; `npm run avaliar-skill` grava `evals/resultado.json`. **Laço contínuo**: o CI reverifica o projeto a cada 6 horas e uma rotina horária do Claude continua o desenvolvimento sem comando do mantenedor.
- 2026-11-16 · **Desempenho medido na nuvem** (`desempenho.yml`): partida a frio p95 394 ms (meta 3 s); 50 usuários simultâneos com p95 322 ms e zero erros (meta 2 s).
- 2026-11-16 · **Skills reais na nuvem** (ADR 0022): as 10 publicadas em rascunho (canal beta, assinadas pelo KMS) pelo workflow `publicar-skills.yml`; Callouts e Data Architect destravados no lint (referências divididas, Unicode oculto removido); H21 na homologação. O Data Architect (privado) usa o segredo `SKILLS_READ_TOKEN`.
- 2026-11-16 · **Nuvem homologada 20/20** ([HOMOLOGACAO.md](HOMOLOGACAO.md), ADR 0021): STS, MCP, disjuntor e jobs no Cloud Run com Firestore, Cloud Storage, KMS e Secret Manager; correções de `/saude`, dispositivo recém-ativado e token de identidade do disjuntor.
- 2026-11-16 · **F1 aplicada no Google Cloud** (projeto `salesforcemcpodin`, número 177809673592, região `southamerica-east1`, estágio E0): ponte por identidade federada (sem chave; só o mantenedor, só na `main`), orçamento de R$ 30 (cerca de US$ 5) com alertas de 50% a 300% e tópico `budget-alerts`, 10 contas de serviço, 4 chaves do KMS em software, Firestore, 3 buckets privados, repositório de imagens com limpeza, 20 APIs. 53 recursos criados pelo workflow `infra.yml`.
- 2026-11-15 · ADR 0020: primeiro código. Caminho completo local de ponta a ponta, com demonstração (`npm run demo`) e servidor local (`npm run dev`).
- 2026-11-15 · ADR 0019: 10 skills organizadas no pipeline do ciclo (`docs/PIPELINE.md`), lado a lado, com 11 atalhos; F6 passa a 4,5 semanas e o total a cerca de 18.
- 2026-11-15 · ADR 0018: revisão geral delegada pelo mantenedor. Estágios de custo e documento de FinOps; topologia de 3 serviços + 3 jobs sem webhooks nem Pub/Sub; publisher confere a assinatura; MCP com resposta JSON; `schemas/` com validador e testes; CF-11 a CF-14; SECURITY, CONTRIBUTING, CHANGELOG, Dependabot, modelo de PR; correção de contradições (GitHub Free, custo da PoC, Pub/Sub para job). Decisões 42 a 48; riscos R20 a R23.
- 2026-11-15 · ADR 0017: práticas de mercado incorporadas (evals, Unicode oculto, integridade no uso, economia de contexto); `scripts/lib/unicode.mjs` com testes; estimativa total passa a cerca de 16 semanas (F6 +0,5).
- 2026-11-14 · ADR 0016: skills, agentes, hook, scripts de verificação, testes e CI. O CI no Windows pegou leitura de CRLF: scripts normalizam e `.gitattributes` fixa LF.
- 2026-11-14 · Apresentação interativa (`apresentacao/`).
- 2026-11-14 · Rodadas 13 a 15: decisões do mantenedor integradas; GitHub Free (decisão 41).

## Próximo passo
1. **Mantenedor:** ao fim da homologação, trocar o `SKILLS_READ_TOKEN` e o segredo do OAuth App (ambos foram vistos no chat de trabalho) e testar no Windows e no VS Code.
2. **Claude:** portal com login GitHub, GitHub App, avaliações por skill (`evals/`) para chegar ao `stable`, reduzir o papel de `sa-ci-infra`.
2. **Mantenedor:** rodar `npm run demo`, depois `npm run dev` e conectar o próprio Claude Code (Windows e extensão do VS Code), para a primeira prova real.
2. **Claude (`/odin-dev`):** migrar as 10 skills reais com o `odin-curador` (F6), começando por uma de cada etapa; portal (ativação com GitHub e segundo fator, console); cofre do sistema; `odin doctor --orgs`.
3. Depois: implementações de nuvem atrás das interfaces, Terraform no estágio E0 e a F0 com o Claude Code real e o LiteLLM.

## Pendências
- Entregáveis das decisões: `docs/F0-ROTEIRO.md`, `prototipo/` (o protótipo inicial está na apresentação). `schemas/` e `docs/MIGRACAO-SKILLS.md` (gerado por `node scripts/prontidao-skills.ts`) entregues.
- Portão 2 (antes do time): organização GitHub, projeto `prod` em E1 com disjuntor ensaiado, segundo super-admin, jurídico, e-mail, pentest, ensaio do corte. Domínio próprio, Load Balancer, Cloud Armor e Cloud SQL deixaram de ser itens fixos: entram por gatilho.
- Pontos `[VERIFICAR]`: ver `node scripts/sessao.mjs inicio`.

## Riscos ativos mais relevantes
R11 (busca de ferramentas via LiteLLM), R15 (pessoa única), R16 (corte único), R17 (sem jurídico), R18 (GitHub Free), R19 (avaliação com modelo não determinística), R20 (sem WAF em E0 e E1), R23 (partida a frio), R24 (nuvem por último), R25 (cofre em arquivo). Detalhe no [plano, seção 18](PLANO.md).

## F2, F7 e F8 (código pronto, aguardando homologação no pipeline)
Segundo fator do portal (TOTP, códigos de recuperação, passkey; H31), conhecimento híbrido com embeddings da Vertex AI (H30), auditoria BigQuery, painel e alertas (Terraform `observabilidade`), runbooks `docs/RUNBOOKS-OPERACIONAIS.md`. Decisão: ADR 0026.

## Políticas de guard por skill (ADR 0027)
Implementado: carregamento de `politicas/<id>.mjs` por sessão, lint e testes. Migrado: Deep Debugger. Faltam os hooks das outras 9 skills.

## Bibliotecas compartilhadas (ADR 0028)
`libs/` com 3 pacotes; Journey Designer e Journey Developer usam. Pendente: fundir as cópias divergentes do LWC Developer e do Apex Cover Loop.

## Avaliação com modelo (ADR 0029)
Implementada e testada com API simulada; 30 casos de modelo nas 10 skills. Falta rodar `avaliar-modelo.yml` com o segredo `ANTHROPIC_API_KEY` para registrar a nota de referência.

## Intenções das 10 skills
20 por skill, aprovadas por delegação do mantenedor ("tome as decisões compatíveis com o projeto") em 16/11/2026; roteamento 38/38.
