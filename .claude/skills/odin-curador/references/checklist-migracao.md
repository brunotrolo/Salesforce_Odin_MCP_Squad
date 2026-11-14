# Checklist de migração de uma skill para o Odin

## Inventário atual (base para a F6)
| Repositório | `SKILL.md` | Agentes | Regras | Hooks | Scripts | Observações |
|---|---|---|---|---|---|---|
| Salesforce_Discovery-to-Backlog | 11 | 7 | 2 (`discovery-governance`, `jira-write`) | PreToolUse (`guard-jira-write`) | ~20 | Publica no Jira pelo MCP oficial da Atlassian (OAuth); `jira.config.json` sem credencial |
| Salesforce_Journey_Designer | 11 (inclui terceiros) | 7 | 3 (`journey-designer`, `karpathy-guidelines`, `prototipo`) | PostToolUse (`verify-prototype`) | ~14 | Bibliotecas `salesforce`, `mattpocock`, `agent-skills` |
| Salesforce_Journey_Developer | 24 (inclui terceiros) | 10 | 5 (`apex`, `journey-developer`, `karpathy-guidelines`, `lwc`, `metadata`) | PreToolUse (deploy) | ~27 | Mesmas bibliotecas, conjunto diferente |
| Salesforce_Data_Architect | 1 | 4 | 1 (`data-governance`) | Pre e PostToolUse | ~19 | — |
| Salesforce_Test_Automator | 2 | 4 | 2 (`qa-governance`, `sandbox-only`) | PreToolUse (`guard-qa`) | ~30 | Playwright; 71 testes |

**Colisões conhecidas:** 5 skills idênticas em Designer e Developer (`design-systems-slds-apply`, `design-systems-slds-validate`, `experience-lwc-generate`, `platform-apex-generate`, `test-driven-development`) → pacote de biblioteca único. `karpathy-guidelines.md` com conteúdo diferente nos dois → fundir numa versão (decisão 12).

## Checklist por skill
- [ ] Inventário feito (skills, agentes, regras, hooks, scripts, `CLAUDE.md`, terceiros)
- [ ] `odin.yaml` completo e válido (schema)
- [ ] Só caminhos declarados; nenhum `CLAUDE.md`, `AGENTS.md`, `README.md`, `settings.json`, `.mcp.json`
- [ ] Regras do `CLAUDE.md` movidas para o `SKILL.md` ou referência
- [ ] Caminhos trocados por `{{ODIN_RUNTIME}}`; scripts resolvem a própria pasta
- [ ] Hooks viraram políticas do guard, com testes (incluindo Windows)
- [ ] Bibliotecas de terceiros: só as usadas, em `libs/`, com `LICENSE` e `NOTICE`
- [ ] Agentes com prefixo `odin-<skill>-` e restrições de ferramenta preservadas
- [ ] Primeiro passo da skill: `odin ensure <id>`
- [ ] Pontos de consulta e proposta ao conhecimento (coleções declaradas)
- [ ] `entrada`, `saida`, `proximo` declarados (encadeamento)
- [ ] 20 intenções escritas e revisadas pelo mantenedor
- [ ] Nenhum segredo, alias de org, nome real ou dado de cliente
- [ ] `SKILL.md` e referências ≤ 8.000 tokens cada
- [ ] Testes da skill passam a partir do runtime do Odin
- [ ] PR no catálogo (beta) com revisores de arquitetura e segurança
- [ ] Uma tarefa real completa ponta a ponta pelo Odin
- [ ] Promoção para stable; ESTADO atualizado
