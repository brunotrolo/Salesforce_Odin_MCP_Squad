---
paths: docs/**, .claude/**, scripts/**, infra/**, apps/**, packages/**, catalog/**, policies/**
---

# Governança do Odin

- Documentos protegidos (`docs/DECISOES.md`, `docs/PLANO.md`, `docs/arquitetura/**`, `docs/seguranca/**`, `docs/portal/**`) só mudam com ADR aberto. Use a skill `odin-arquiteto`. Não tente contornar o hook `guard-docs`: se ele negar, abra o ADR.
- Todo código novo traz teste. Toda regra verificável vira teste de conformidade em `scripts/conformidade.mjs`.
- Antes de commit: `npm test` e `npm run verificar` verdes; revisores independentes chamados conforme a skill `odin-dev`.
- Atualize `docs/ESTADO.md` ao fim de cada sessão.
- Nunca grave segredos, dados de cliente, alias de org ou nomes reais. Exemplos usam dados fictícios (`exemplo.com.br`, `squad-atendimento`).
