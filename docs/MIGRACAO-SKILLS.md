# Migração das skills: prontidão

> Gerado por `node scripts/prontidao-skills.ts` (não edite à mão). Cada skill real passa pelo `odin lint` com o rascunho de contrato em `catalog/migracao/<id>/odin.yaml`. Os repositórios das skills não são alterados.
> Etapas e encadeamento: [PIPELINE.md](PIPELINE.md). Checklist da migração: skill `odin-curador`.

## Resumo

| Etapa | Skill | Situação | Bloqueios | Avisos | `SKILL.md` principal | Arquivos entregues |
|---|---|---|---|---|---|---|
| 1 | Archaeologist | Publicável em rascunho | 0 | 3 | ~2161 tokens | 8 |
| 2 | Discovery-to-Backlog | Publicável em rascunho | 0 | 2 | ~2248 tokens | 42 |
| 3 | Data Architect | Publicável em rascunho | 0 | 6 | ~2427 tokens | 40 |
| 3 | Journey Designer | Publicável em rascunho | 0 | 3 | ~419 tokens | 11 |
| 4 | Journey Developer | Publicável em rascunho | 0 | 3 | ~1595 tokens | 22 |
| 4 | LWC Developer | Publicável em rascunho | 0 | 2 | ~4399 tokens | 15 |
| 4 | Apex Callouts Developer | Publicável em rascunho | 0 | 4 | ~4819 tokens | 38 |
| 5 | Apex Cover Loop | Publicável em rascunho | 0 | 2 | ~3642 tokens | 14 |
| 5 | Test Automator | Publicável em rascunho | 0 | 2 | ~2064 tokens | 45 |
| 6 | Deep Debugger | Publicável em rascunho | 0 | 2 | ~3222 tokens | 14 |

**Publicável em rascunho** = passa no `odin lint` com o contrato gerado; o pipeline insere o passo `odin ensure`. Para sair do rascunho falta o checklist do `odin-curador`: contrato no repositório da skill, regras do `CLAUDE.md` movidas, hooks como políticas do guard, bibliotecas de terceiros num pacote compartilhado, 20 intenções revisadas e avaliações de comportamento.

## Detalhe por skill

### Archaeologist (`sf-archaeologist`)

Entrega: 1 `SKILL.md`, 4 agentes, 2 regras, 0 referências, 1 arquivos de runtime.

Avisos:
- .claude/rules/salesforce-standards.md: 7101 tokens (alvo de 5000)
- .claude/skills/sf-archaeologist/SKILL.md: o primeiro passo precisa ser `odin ensure sf-archaeologist`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Discovery-to-Backlog (`sf-discovery`)

Entrega: 4 `SKILL.md`, 7 agentes, 2 regras, 9 referências, 20 arquivos de runtime.

Avisos:
- .claude/skills/sf-discover/SKILL.md: o primeiro passo precisa ser `odin ensure sf-discovery`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Data Architect (`sf-data-architect`)

Entrega: 1 `SKILL.md`, 4 agentes, 1 regras, 25 referências, 9 arquivos de runtime.

Avisos:
- .claude/skills/sf-data-architect/references/data-mapping/Case_DataMapping_Completo.md: 7911 tokens (alvo de 5000)
- .claude/skills/sf-data-architect/references/data-mapping/Case_Dominios_de_Negocio.md: 6004 tokens (alvo de 5000)
- .claude/skills/sf-data-architect/references/data-mapping/Case_Mapeamento_Campos_por_Dominio.md: 6566 tokens (alvo de 5000)
- .claude/skills/sf-data-architect/references/data-mapping/Case_Mapeamento_Campos_por_Dominio_2.md: 6611 tokens (alvo de 5000)
- .claude/skills/sf-data-architect/SKILL.md: o primeiro passo precisa ser `odin ensure sf-data-architect`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Journey Designer (`sf-journey-designer`)

Entrega: 2 `SKILL.md`, 6 agentes, 3 regras, 0 referências, 0 arquivos de runtime.

Avisos:
- .claude/agents/sf-html-prototyper.md: 5279 tokens (alvo de 5000)
- .claude/skills/sf-spec/SKILL.md: o primeiro passo precisa ser `odin ensure sf-journey-designer`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Journey Developer (`sf-journey-developer`)

Entrega: 2 `SKILL.md`, 9 agentes, 5 regras, 5 referências, 1 arquivos de runtime.

Avisos:
- .claude/agents/sf-deploy-gate.md: 5930 tokens (alvo de 5000)
- .claude/skills/sf-build/SKILL.md: o primeiro passo precisa ser `odin ensure sf-journey-developer`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### LWC Developer (`sf-lwc-developer`)

Entrega: 3 `SKILL.md`, 0 agentes, 1 regras, 7 referências, 4 arquivos de runtime.

Avisos:
- .claude/skills/lwc-pattern-generator/SKILL.md: o primeiro passo precisa ser `odin ensure sf-lwc-developer`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Apex Callouts Developer (`sf-callouts-developer`)

Entrega: 1 `SKILL.md`, 4 agentes, 1 regras, 31 referências, 1 arquivos de runtime.

Avisos:
- .claude/skills/apex-callouts-developer/references/docs/tobe-arquitetura-integracoes.md: 6764 tokens (alvo de 5000)
- .claude/skills/apex-callouts-developer/references/docs/tobe-explicacao-simples.md: 6577 tokens (alvo de 5000)
- .claude/skills/apex-callouts-developer/SKILL.md: o primeiro passo precisa ser `odin ensure sf-callouts-developer`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Apex Cover Loop (`sf-apex-cover-loop`)

Entrega: 1 `SKILL.md`, 1 agentes, 1 regras, 9 referências, 2 arquivos de runtime.

Avisos:
- .claude/skills/apex-test-loop/SKILL.md: o primeiro passo precisa ser `odin ensure sf-apex-cover-loop`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Test Automator (`sf-test`)

Entrega: 2 `SKILL.md`, 4 agentes, 2 regras, 7 referências, 30 arquivos de runtime.

Avisos:
- .claude/skills/sf-test/SKILL.md: o primeiro passo precisa ser `odin ensure sf-test`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

### Deep Debugger (`sf-deep-debugger`)

Entrega: 1 `SKILL.md`, 1 agentes, 1 regras, 7 referências, 4 arquivos de runtime.

Avisos:
- .claude/skills/sf-deep-debugger/SKILL.md: o primeiro passo precisa ser `odin ensure sf-deep-debugger`
- sem avaliações de comportamento (evals/): obrigatório antes de promover para stable

