# Registro de mudanças

Mudanças relevantes do projeto, da mais recente para a mais antiga. Decisões têm o detalhe no ADR citado. Datas no formato AAAA-MM-DD.

## Não lançado (pré-F0: plano, arquitetura e ferramentas de manutenção)

### 2026-11-15 · Primeiro código, local primeiro (ADR 0020)
- Emissor de tokens, servidor MCP com 7 ferramentas e API `/v1`, roteador e catálogo das 10 skills, `odin lint`, publicação assinada, publisher, guard (PG-01 a PG-08) e CLI.
- `npm run demo` (ponta a ponta em segundos) e `npm run dev` (Odin local para o Claude Code).
- 44 testes em Linux e Windows, com o cliente oficial do MCP.

### 2026-11-15 · Pipeline das 10 skills (ADR 0019)
- As 10 skills em 6 etapas, com encadeamento, fronteiras, perfis e 11 atalhos.

### 2026-11-15 · Arquitetura enxuta e contratos (ADR 0018)
- **Custo:** estágios E0, E1 e E2 com gatilhos medidos; o time passa a usar a mesma topologia da prova de conceito (até US$ 25 por mês, contra centenas no desenho anterior). Novo documento de custos e FinOps.
- **Topologia:** 3 serviços e 3 jobs de uma só imagem; sem webhooks e sem Pub/Sub de aplicação; o publisher confere a assinatura antes de registrar.
- **Teto de gasto:** máximo de 3 instâncias por serviço e disjuntor que fecha o ingress a 300% do orçamento (runbook RB-13).
- **MCP:** resposta JSON por requisição, sem fluxo SSE permanente, para escalar a zero.
- **Contratos:** pasta `schemas/` com JSON Schema do `odin.yaml`, do manifesto, das avaliações, da auditoria e do documento de descoberta; definição das 7 ferramentas MCP; OpenAPI da API `/v1`; verificação no CI.
- **Conformidade:** regras de custo CF-11 a CF-14.
- **Repositório:** política de segurança, guia de contribuição, modelo de PR, Dependabot, CI com `npm ci`, cancelamento de execuções repetidas e tempo limite.
- **Correções:** trechos que ainda supunham proteção de branch e ambientes com aprovação (indisponíveis no GitHub Free); custo da prova de conceito no plano; Pub/Sub entregando a um job.

### 2026-11-15 · Qualidade das skills (ADR 0017)
- Avaliações de comportamento por skill, com portão de promoção para `stable`.
- Recusa de caracteres Unicode ocultos em documentos, skills e código.
- Integridade do runtime conferida no uso (detecção DT-19).
- Diretriz de economia de contexto.

### 2026-11-14 · Desenvolvimento e sustentação (ADR 0016)
- Skills `odin-dev`, `odin-curador`, `odin-arquiteto` e `odin-operacao`; revisores independentes e auditor.
- Registro de ADRs com hook que protege os documentos de referência; verificações de documentação, skills e conformidade; CI em Linux e Windows.

### 2026-11-14 · Linha de base
- Plano, 41 decisões do mantenedor, arquitetura (solução, funcional, técnica, portal), segurança, portal e apresentação interativa.
