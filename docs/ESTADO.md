# Estado do projeto

> Atualizado a cada sessão (skill `odin-dev`, passo final). Uma sessão nova começa por aqui.
> **Última atualização:** 2026-11-16

## Agora
- **Fase:** desenvolvimento **local primeiro** (decisão 53, ADR 0020). O caminho completo já roda e é testado na máquina: `npm run demo` mostra tudo em segundos; `npm run dev` sobe o Odin para o Claude Code local.
- **Pronto e testado (44 testes, CI em Linux e Windows):** emissor de tokens (`apps/sts`), servidor MCP com as 7 ferramentas e a API `/v1` (`apps/mcp-server`), roteador e catálogo das 10 skills (`packages/router`, `catalog/`), `odin lint` e pipeline de publicação assinada (`packages/lint`, `pipeline/`), publisher que confere a assinatura (`apps/jobs`), guard com PG-01 a PG-08 (`packages/guard`), CLI (`packages/cli`), skill de apoio `odin-ambiente`.
- **Skills reais:** 8 das 10 já passam no `odin lint` e sobem no Odin local em modo rascunho (`npm run dev`, com os repositórios clonados ao lado); Data Architect e Apex Callouts Developer estão bloqueadas por problemas reais listados em [MIGRACAO-SKILLS.md](MIGRACAO-SKILLS.md).
- **Ainda não existe:** portal (a ativação usa uma página de desenvolvimento), implementações de nuvem no código (Firestore, Cloud Storage, KMS, Vertex AI: a infraestrutura já existe, falta o código usá-la), disjuntor de custo (função), serviços no Cloud Run, cofre do sistema, binário do CLI, migração das 10 skills reais (F6), avaliações de comportamento.
- Documentação: plano, decisões (53), arquitetura, segurança, portal, pipeline das skills, contratos em `schemas/`.

## Feito (resumo, mais recente primeiro)
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
1. **Claude:** publicar as skills reais na nuvem (precisa de GitHub App para os repositórios privados), medir partida a frio e carga, portal com login GitHub, reduzir o papel de `sa-ci-infra`.
2. **Mantenedor:** rodar `npm run demo`, depois `npm run dev` e conectar o próprio Claude Code (Windows e extensão do VS Code), para a primeira prova real.
2. **Claude (`/odin-dev`):** migrar as 10 skills reais com o `odin-curador` (F6), começando por uma de cada etapa; portal (ativação com GitHub e segundo fator, console); cofre do sistema; `odin doctor --orgs`.
3. Depois: implementações de nuvem atrás das interfaces, Terraform no estágio E0 e a F0 com o Claude Code real e o LiteLLM.

## Pendências
- Entregáveis das decisões: `docs/F0-ROTEIRO.md`, `prototipo/` (o protótipo inicial está na apresentação). `schemas/` e `docs/MIGRACAO-SKILLS.md` (gerado por `node scripts/prontidao-skills.ts`) entregues.
- Portão 2 (antes do time): organização GitHub, projeto `prod` em E1 com disjuntor ensaiado, segundo super-admin, jurídico, e-mail, pentest, ensaio do corte. Domínio próprio, Load Balancer, Cloud Armor e Cloud SQL deixaram de ser itens fixos: entram por gatilho.
- Pontos `[VERIFICAR]`: ver `node scripts/sessao.mjs inicio`.

## Riscos ativos mais relevantes
R11 (busca de ferramentas via LiteLLM), R15 (pessoa única), R16 (corte único), R17 (sem jurídico), R18 (GitHub Free), R19 (avaliação com modelo não determinística), R20 (sem WAF em E0 e E1), R23 (partida a frio), R24 (nuvem por último), R25 (cofre em arquivo). Detalhe no [plano, seção 18](PLANO.md).
