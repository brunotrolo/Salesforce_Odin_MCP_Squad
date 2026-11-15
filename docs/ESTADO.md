# Estado do projeto

> Atualizado a cada sessão (skill `odin-dev`, passo final). Uma sessão nova começa por aqui.
> **Última atualização:** 2026-11-15

## Agora
- **Fase:** pré-F0, fechando o **Portão 1** ([plano, seção 23.1](PLANO.md)).
- Documentação completa e alinhada: plano, decisões (52), arquitetura (solução, funcional, técnica, portal, custos), segurança (12 documentos), portal (11 documentos), apresentação interativa.
- **Arquitetura enxuta por estágios de custo (ADR 0018):** 3 serviços + 3 jobs com escala a zero; E0 ≤ US$ 3/mês, E1 ≤ US$ 25/mês; recurso de custo fixo só por gatilho medido; teto de 3 instâncias e disjuntor.
- **Contratos em `schemas/`** validados no CI: `odin.yaml`, manifesto, avaliações, auditoria, descoberta, 7 ferramentas MCP, OpenAPI `/v1`.
- Skills de desenvolvimento e sustentação (ADR 0016) e qualidade das skills (ADR 0017: avaliações, Unicode oculto, integridade no uso, economia de contexto).
- Ainda **não há código** do Odin (servidor, portal, CLI, guard).

## Feito (resumo, mais recente primeiro)
- 2026-11-15 · ADR 0019: 10 skills organizadas no pipeline do ciclo (`docs/PIPELINE.md`), lado a lado, com 11 atalhos; F6 passa a 4,5 semanas e o total a cerca de 18.
- 2026-11-15 · ADR 0018: revisão geral delegada pelo mantenedor. Estágios de custo e documento de FinOps; topologia de 3 serviços + 3 jobs sem webhooks nem Pub/Sub; publisher confere a assinatura; MCP com resposta JSON; `schemas/` com validador e testes; CF-11 a CF-14; SECURITY, CONTRIBUTING, CHANGELOG, Dependabot, modelo de PR; correção de contradições (GitHub Free, custo da PoC, Pub/Sub para job). Decisões 42 a 48; riscos R20 a R23.
- 2026-11-15 · ADR 0017: práticas de mercado incorporadas (evals, Unicode oculto, integridade no uso, economia de contexto); `scripts/lib/unicode.mjs` com testes; estimativa total passa a cerca de 16 semanas (F6 +0,5).
- 2026-11-14 · ADR 0016: skills, agentes, hook, scripts de verificação, testes e CI. O CI no Windows pegou leitura de CRLF: scripts normalizam e `.gitattributes` fixa LF.
- 2026-11-14 · Apresentação interativa (`apresentacao/`).
- 2026-11-14 · Rodadas 13 a 15: decisões do mantenedor integradas; GitHub Free (decisão 41).

## Próximo passo
1. **Mantenedor:** criar o projeto `odin-poc` no Google Cloud (decisão 1) e **revisar as decisões 42 a 48** (tomadas por delegação; mudam o que era exigido antes de liberar ao time).
2. **Claude (`/odin-dev`):** escrever `docs/F0-ROTEIRO.md` (prioridade Windows nativo e extensão do VS Code) e o servidor MCP de teste da F0. A F0 ganhou três verificações: MCP com resposta JSON e sem fluxo SSE, partida a frio, e preços na região.
3. Depois da F0: ADR com o resultado de cada `[VERIFICAR]`, ajuste dos documentos e início da F1 (que já nasce com orçamento, disjuntor e conformidade de custo).

## Pendências
- Entregáveis das decisões: `docs/F0-ROTEIRO.md`, `docs/MIGRACAO-SKILLS.md`, `prototipo/` (o protótipo inicial está na apresentação). `schemas/` entregue.
- Portão 2 (antes do time): organização GitHub, projeto `prod` em E1 com disjuntor ensaiado, segundo super-admin, jurídico, e-mail, pentest, ensaio do corte. Domínio próprio, Load Balancer, Cloud Armor e Cloud SQL deixaram de ser itens fixos: entram por gatilho.
- Pontos `[VERIFICAR]`: ver `node scripts/sessao.mjs inicio`.

## Riscos ativos mais relevantes
R11 (busca de ferramentas via LiteLLM), R15 (pessoa única), R16 (corte único), R17 (sem jurídico), R18 (GitHub Free), R19 (avaliação com modelo não determinística), R20 (sem WAF em E0 e E1), R23 (partida a frio). Detalhe no [plano, seção 18](PLANO.md).
