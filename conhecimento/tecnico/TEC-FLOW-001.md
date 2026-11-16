---
id: TEC-FLOW-001
tipo: padrao
colecao: tecnico
projeto: global
autoridade: 3
dono: arquitetura
vigencia: { de: 2026-03-01, ate: null }
sensibilidade: interna
---

# Tratamento de falhas em Flow

## Regra
Todo elemento de dados em um Flow precisa de um caminho de falha (fault path) que registre o erro e informe a pessoa. Flow sem fault path esconde falhas silenciosas.

## Escolha
Prefira Flow para automações simples de um objeto. Use Apex quando houver processamento em lote grande, lógica complexa ou necessidade de teste unitário detalhado.

