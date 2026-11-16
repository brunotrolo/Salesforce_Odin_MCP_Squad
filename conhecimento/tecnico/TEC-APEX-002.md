---
id: TEC-APEX-002
tipo: padrao
colecao: tecnico
projeto: global
autoridade: 2
dono: arquitetura
vigencia: { de: 2026-03-01, ate: null }
sensibilidade: interna
---

# Um único trigger por objeto com classe de tratamento

## Regra
Cada objeto tem um único trigger que apenas delega para uma classe handler. A classe separa os eventos before e after e mantém a lógica de negócio testável, sem acoplamento com o contexto do trigger.

## Anti-padrão
Vários triggers no mesmo objeto têm ordem de execução indefinida e produzem comportamento difícil de reproduzir.

