---
id: DAD-CASE-001
tipo: glossario
colecao: dados
projeto: projeto-atlas
autoridade: 2
dono: arquitetura-dados
vigencia: { de: 2026-03-01, ate: null }
sensibilidade: interna
---

# Entidade Caso e seus campos principais

## Campos
O objeto Case guarda o assunto, a descrição, a prioridade, o status, o canal de origem, a data de abertura e a data de fechamento. O campo ClosedDate só é preenchido quando o status passa para Fechado.

## Relacionamentos
Todo Case se relaciona a uma Conta (cliente) e opcionalmente a um Contato. O histórico de status fica no objeto CaseHistory.

