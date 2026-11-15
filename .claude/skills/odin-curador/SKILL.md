---
name: odin-curador
description: Inclui uma skill nova no catálogo do Odin ou ajusta uma skill existente (nova versão, metadados, perfis, depreciação, retirada), garantindo o contrato odin.yaml, o isolamento (nada de CLAUDE.md, settings.json ou .mcp.json no pacote), as regras movidas para dentro da skill, as 20 intenções de roteamento, licenças de terceiros, ausência de segredos e o fluxo beta → stable por PR. Use para "incluir a skill X no Odin", "migrar o Test Automator", "publicar nova versão da skill Y", "depreciar/retirar a skill Z", "ajustar quem acessa a skill W".
argument-hint: incluir <repo> | versao <skill> | ajustar <skill> | depreciar <skill> | retirar <skill>
---

# odin-curador: catálogo de skills do Odin

Abra a sessão com `node scripts/sessao.mjs inicio`. Fontes: `docs/PLANO.md` seções 8, 12, 15 e 22; `docs/portal/07-ciclo-de-vida-das-skills.md`; decisões 8 a 13 e 17 em `docs/DECISOES.md`. **Quem decide é o código** (`odin lint` e o pipeline); esta skill prepara e confere.

## incluir <repo>  ·  (também usada na F6 para as 5 skills atuais)
1. **Inventário** do repositório da skill: `SKILL.md` (principal e subskills), agentes, regras (`.claude/rules`), hooks (`settings.json`), scripts, `CLAUDE.md`/`AGENTS.md`, bibliotecas de terceiros embutidas. Use `references/checklist-migracao.md`.
2. **`odin.yaml`** a partir de `templates/odin.yaml`: id, nome, domínio, dono, descrição, intenções, perfis sugeridos, entrada, saída, próximo, skills, agentes, regras, runtime (pré-requisitos), políticas, coleções de conhecimento, licenças, `usa`. Só o que estiver declarado é entregue.
3. **Regras do `CLAUDE.md`** da skill: mova o que é regra operacional para o `SKILL.md` ou uma referência; o `CLAUDE.md` fica só para quem mantém (decisão 13).
4. **Caminhos:** troque `.claude/skills/<x>/scripts` por `{{ODIN_RUNTIME}}`; scripts resolvem a própria pasta (`import.meta.url`).
5. **Hooks → políticas** do `odin-guard` (`policies/<id>.mjs`) com os testes migrados; equivalentes Windows quando o hook mexe com comandos.
6. **Bibliotecas de terceiros:** só as usadas, como pacote compartilhado em `libs/` com `LICENSE` e `NOTICE` (decisão 11); registre em `licenca_terceiros` e `usa`.
7. **Intenções de roteamento:** proponha **20 frases reais** (`references/intencoes.md`) e peça a revisão do mantenedor (decisão 17).
8. **Varreduras:** nenhum segredo, alias de org, nome real ou dado de cliente; nenhuma colisão de nome com outra skill ou biblioteca.
9. **Testes** da skill rodando a partir do runtime do Odin, e **avaliações** em `evals/` (`references/avaliacoes.md`): ao menos 10 casos, camada determinística passando, nota de referência com modelo registrada.
   - **Economia de contexto:** `SKILL.md` e referências com alvo de 5.000 tokens; trabalho pesado em script que devolve só o resumo.
10. **PR no catálogo** (`catalog/skills.yaml`, canal `beta`, SHA fixado). Peça os revisores `odin-revisor-arquitetura` e `odin-revisor-seguranca`.
11. Depois de usar em `beta` sem regressão: `odin dev eval <skill>` gera `evals/resultado.json` do SHA; PR de promoção para `stable` (recusado se a nota cair mais de 5 pontos ou um caso `critico` falhar). Registre em `docs/ESTADO.md`.

## versao <skill>
Tag nova no repositório da skill → PR no catálogo trocando o SHA do canal `beta` → pipeline verde (inclui avaliações determinísticas, Unicode oculto e o smoke de roteamento ≥ 90%) → uso em beta → `odin dev eval` → PR de promoção. Mudança de comportamento visível vai no changelog do PR (aparece em Novidades no portal).

## ajustar <skill>
- **Acesso** (quem usa): é no portal, matriz de perfis (não é PR). Explique ao mantenedor o efeito (quantas pessoas, quais squads).
- **Metadados** (descrição, intenções, pré-requisitos, coleções): PR no repositório da skill + nova versão.

## depreciar <skill> / retirar <skill>
PR no catálogo com a data prevista, a skill substituta e o motivo; na retirada, `renames`/estado `retirada`. Versão perigosa: lista de versões proibidas (runbook RB-09, com a skill `odin-operacao`).

## Regras
- Nunca entregar `CLAUDE.md`, `AGENTS.md`, `README.md`, `settings.json`, `.mcp.json` ou arquivo não declarado (plano 22.1).
- Nome de tudo que vai para a máquina leva o prefixo da skill (`odin-<skill>-…`).
- Só o mantenedor aprova a entrada no catálogo (decisão 31); a decisão final técnica é do `odin lint` e do pipeline.

## Referências
- `references/checklist-migracao.md`: checklist por skill, com o inventário atual das 5 skills.
- `references/intencoes.md`: como escrever e avaliar as 20 intenções.
- `references/avaliacoes.md`: formato dos casos de avaliação de comportamento e portão de promoção.
- `templates/odin.yaml`: modelo comentado do contrato.
