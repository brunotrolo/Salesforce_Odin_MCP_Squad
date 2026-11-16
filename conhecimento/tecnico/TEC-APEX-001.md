---
id: TEC-APEX-001
tipo: padrao
colecao: tecnico
projeto: global
autoridade: 2
dono: arquitetura
vigencia: { de: 2026-03-01, ate: null }
sensibilidade: interna
---

# Bulkificação em triggers Apex

## Regra
Todo trigger deve processar listas, nunca um registro por vez. Consultas SOQL e comandos DML ficam fora de laços for. O limite de plataforma é 100 consultas SOQL e 150 comandos DML por transação síncrona.

## Exemplo
Coletar os ids em um Set antes do laço, fazer uma única consulta com cláusula IN e guardar os resultados em um Map para consulta por id dentro do laço.

