---
id: TEC-CALL-001
tipo: padrao
colecao: tecnico
projeto: global
autoridade: 2
dono: integracoes
vigencia: { de: 2026-03-01, ate: null }
sensibilidade: interna
---

# Callouts a partir de processamento assíncrono

## Regra
Uma chamada HTTP externa não pode ser feita depois de DML pendente na mesma transação. Use Queueable com a interface Database.AllowsCallouts para fazer o callout em outra transação.

## Credenciais
Endereços e credenciais vivem em Named Credentials. Nunca escreva URL de ambiente ou segredo no código Apex.

## Falhas
Trate timeout e códigos 5xx com nova tentativa limitada e registre a falha em um objeto de log, sem perder o registro de origem.

