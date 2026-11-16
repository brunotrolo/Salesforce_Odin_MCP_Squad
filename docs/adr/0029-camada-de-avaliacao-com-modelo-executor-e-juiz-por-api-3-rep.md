# 0029. Camada de avaliacao com modelo: executor e juiz por API, 3 repeticoes

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F6
**Documentos afetados:** .claude/skills/odin-curador/references/avaliacoes.md; docs/PIPELINE.md

## Contexto
O ADR 0017 definiu duas camadas de avaliação: a determinística (no pipeline, sem modelo) e a com modelo, que ficou como "roda na máquina do mantenedor" sem implementação. Todas as skills tinham só a camada determinística, e o portão de promoção não media se a skill se comporta bem quando um modelo a usa.

## Decisão
1. `pipeline/avaliar-modelo.ts` roda os casos `camada: modelo` de `evals/casos.yaml` por **nível de prompt**: o executor recebe o `SKILL.md` e as regras da skill e o pedido (e, se houver, `documento` como dado, não instrução), descreve o que faria sem executar nada, e um **juiz independente** (outra chamada, só com a rubrica e a resposta) devolve `{ok, motivo}`.
2. 3 repetições por caso; vale a maioria. Resultado misto vira `instavel` e é corrigido. Erro de API conta como falha, com o motivo. Saída: `evals/resultado-modelo.json` (`odin.eval-modelo/1`).
3. Cada skill ganhou 3 casos de modelo: um positivo, um negativo (crítico) e um de injeção (crítico).
4. O workflow manual `avaliar-modelo.yml` roda as 10 skills com o segredo `ANTHROPIC_API_KEY`. Sem o segredo, termina sem executar e sem falhar. O modelo padrão é `claude-sonnet-5-5` (`ODIN_EVAL_MODELO` troca).
5. A camada determinística continua sendo a que bloqueia o pipeline. A nota com modelo é a referência registrada no PR de promoção, e queda maior que 5 pontos ou caso crítico falhando reprova a promoção.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Rodar o Claude Code de ponta a ponta em cada caso | Caro, lento e difícil de reproduzir no CI; o nível de prompt já testa se a skill orienta o comportamento certo. |
| Juiz no mesmo contexto do executor | Contamina o julgamento com a narrativa; o juiz recebe só a rubrica e a resposta. |
| Tornar a camada de modelo obrigatória no pipeline | Custo e variabilidade em todo push; fica manual e gera a referência antes da promoção. |

## Consequências
- Executar exige uma chave de API (custo por execução: 10 skills x 3 casos x 3 repetições x 2 chamadas).
- Avalia a skill como texto de orientação, não a execução real de ferramentas.

## Segurança
A chave fica só em segredo do repositório; o job não escreve nada nos repositórios das skills; casos de injeção verificam que documento do projeto não manda no agente.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [ ] Testes de conformidade (scripts/conformidade.mjs), se a regra é verificável
