---
name: odin-operacao
description: Operação e resposta a incidentes do Odin - revogar dispositivo ou pessoa, revogação global, rotação de chaves (JWT, pacotes, CLI) e segredos, tirar uma versão de skill de circulação, restaurar dados, expurgo de projeto, revisão de acessos e investigação de alertas - seguindo as severidades, detecções, playbooks e runbooks documentados. Use para "incidente", "token vazou", "revogar acesso", "rotacionar chave", "versão quebrada em produção", "restaurar backup", "alerta SEV1/SEV2", "revisão trimestral".
argument-hint: incidente <descrição> | runbook RB-<nn> | alerta DT-<nn> | rotina <semanal|mensal|trimestral|semestral|anual>
---

# odin-operacao: incidentes e runbooks

Fontes obrigatórias: `docs/seguranca/09-deteccao-e-resposta.md` (severidades, detecções DT-01 a DT-19, playbooks) e `docs/seguranca/11-runbooks.md` (RB-01 a RB-12). Rotinas em `../odin-dev/references/sustentacao.md`.

## incidente <descrição>
1. **Classifique** a severidade (SEV1 a SEV4) pela tabela da segurança 09. SEV1/SEV2: avise o mantenedor imediatamente e registre a hora.
2. **Conter primeiro**, com o playbook correspondente (segurança 09, seção 4). Ações destrutivas ou globais (revogação global, desabilitar chave, retirar versão) só com confirmação explícita do mantenedor, a não ser que ele já tenha autorizado para aquele incidente.
3. **Investigar** com a auditoria (BigQuery), os logs do Google Cloud e o histórico do Git; não exponha tokens nem dados pessoais no relato.
4. **Erradicar e recuperar** com o runbook (segurança 11).
5. **Aprender:** relatório sem culpados em `docs/incidentes/AAAA-MM-DD-titulo.md` (sem dados pessoais), teste que impede a repetição, ADR se um controle mudou (`odin-arquiteto`), ESTADO atualizado.

## runbook RB-<nn>
Execute o runbook exatamente como descrito; os marcados com 👥 exigem duas pessoas (na PoC, a segunda conta de teste do mantenedor, decisão 26). Registre início, passos e fim.

## alerta DT-<nn>
Abra a detecção na segurança 09, confirme se é real (consultas de auditoria em `references/consultas.md`), aplique a resposta inicial e decida se vira incidente.

## rotina <frequência>
Siga a tabela de rotina do mantenedor (`../odin-dev/references/sustentacao.md`) e chame o agente `odin-auditor` para o relatório.

## Regras
- Na dúvida entre conter e esperar, conter (revogar um dispositivo é reversível com nova ativação).
- Nunca apagar auditoria; nunca desligar o coletor de logs.
- Toda ação de operação aparece na auditoria; diga ao mantenedor o que foi feito e o que falta.

## Referências
- `references/consultas.md`: consultas prontas de auditoria e consumo (BigQuery).
