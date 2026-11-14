# 0016. Skill de desenvolvimento e sustentação do Odin

**Status:** Aceito (2026-11-14)
**Data:** 2026-11-14
**Fase:** pré-F0 (Portão 1)
**Documentos afetados:** docs/PLANO.md (seções 19, 20, 22.4, 23); README.md; CLAUDE.md; docs/ESTADO.md

## Contexto
O mantenedor vai continuar o desenvolvimento em outros chats e, depois, manter o Odin (incluir e ajustar skills). Um chat novo não lembra das conversas anteriores: só sabe o que está no repositório. Era preciso garantir que a arquitetura, a segurança e as decisões sejam respeitadas em qualquer sessão.

## Decisão
Criar no próprio repositório do Odin três camadas de continuidade:
1. **Memória:** `CLAUDE.md` (regras invioláveis e ordem de leitura), `docs/ESTADO.md` (onde estamos e o próximo passo) e esta pasta de ADRs.
2. **Skills e agentes:** `odin-dev` (construir e sustentar), `odin-curador` (incluir e ajustar skills no catálogo), `odin-arquiteto` (consultar e mudar a arquitetura por ADR), `odin-operacao` (incidentes e runbooks); revisores independentes somente leitura (arquitetura, segurança, testes, documentação) e o `odin-auditor`.
3. **Imposição em código:** hook `guard-docs` (documentos protegidos só com ADR aberto), verificações de documentação, de skills e de conformidade, testes automatizados e CI; modelos de pipeline com testes no Google Cloud (fumaça pós-deploy, sintéticos agendados, carga) para ativar a partir da F1.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Só um `CLAUDE.md` longo | Fica grande, é pago a cada turno e não impõe nada |
| Skills fora do repositório (na máquina do mantenedor) | Não viajam para outro chat nem para a nuvem |
| Só revisão humana | O mantenedor é a única pessoa (R15); precisa de verificação automática |

## Consequências
- Qualquer sessão que abra o repositório recebe as regras e as skills.
- Mudança em documento de referência exige ADR (pequeno atrito intencional).
- As skills do Odin podem depois ser publicadas pelo próprio Odin para o perfil `mantenedor` (plano, seção 22.4).

## Segurança
Reduz o risco de uma sessão desfazer controles de segurança por desconhecimento (revisor de segurança obrigatório e conformidade no CI). O hook é fail-closed. Nenhum segredo é guardado nos arquivos criados.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20
- [x] docs/ESTADO.md
- [x] Testes de conformidade (scripts/conformidade.mjs)
