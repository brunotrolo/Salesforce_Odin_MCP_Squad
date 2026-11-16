---
id: TEC-LIM-001
tipo: regra
colecao: tecnico
projeto: global
autoridade: 1
dono: arquitetura
vigencia: { de: 2026-03-01, ate: null }
sensibilidade: interna
---

# Limites de plataforma que quebram em produção

## Limites
Tempo de CPU de 10 segundos em transação síncrona, 6 MB de heap em transação síncrona, 2 000 registros retornados por consulta de relatório em tela e 50 000 linhas por consulta SOQL.

## Como evitar
Reduza o volume com filtros seletivos, índices e processamento em lotes pelo Batch Apex quando o volume passar de milhares de registros.

