# 0028. Bibliotecas de terceiros compartilhadas (libs) resolvidas na publicacao

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F6
**Documentos afetados:** docs/PLANO.md (seções 8.5, 12, 22.3); docs/PIPELINE.md; .claude/skills/odin-curador/SKILL.md

## Contexto
As skills Journey Designer e Journey Developer carregam as mesmas bibliotecas de terceiros (Salesforce oficial, Agent Skills, Matt Pocock), com conteúdo idêntico, e seus agentes as citam por caminhos como `.claude/skills/salesforce/<item>`. Esses arquivos não eram entregues no pacote (só o que a skill declara), então as referências ficavam sem destino. O contrato já previa `usa: [lib-x@^1]`.

## Decisão
1. A cópia canônica vive em `libs/<id>/` neste repositório: `lib.yaml` (id, versão, grupo, licença, origem, itens), `LICENSE`, `NOTICE` e `conteudo/`. Três libs: `lib-salesforce-oficial` (14 itens usados), `lib-agent-skills` e `lib-mattpocock`.
2. A skill declara `usa` e `licenca_terceiros` no `odin.yaml`. O lint confere a existência e a versão (`^`, `~` ou exata).
3. O publicador inclui os arquivos da lib no **runtime assinado** da skill (`libs/<id>/…`, com hash no manifesto, e `entrega.libs` no manifesto) e troca os caminhos `.claude/skills/<grupo>/<item>` por `{{ODIN_RUNTIME}}/libs/<id>/<item>`.
4. O `odin ensure` resolve `{{ODIN_RUNTIME}}` também nas cópias dos agentes.
5. `scripts/verificar-libs.mjs` (parte do `npm run verificar`) reprova lib incompleta, Unicode oculto, segredo e colisão de item entre libs.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Pacote de lib entregue à parte e resolvido pelo `ensure` | Mais uma cadeia de instalação, versão e integridade para o mesmo resultado; o runtime assinado já tem hash por arquivo. |
| Manter as cópias em cada repositório | Duplica 6 MB, deixa divergir e não entrega o conteúdo. |
| Apagar as cópias dos repositórios das skills | Quebra o uso da skill dentro do próprio repositório; ficam como cópia de desenvolvimento (a fonte canônica é `libs/`). |

## Consequências
- Cada skill que usa as libs entrega cerca de 1,5 MB a mais no runtime (baixado uma vez por versão).
- LWC Developer e Apex Cover Loop tinham cópias vendorizadas mais antigas (versão 1.0 do upstream). Foram **fundidas na versão canônica** (a mais nova, 1.1) e passaram a usar `usa: [lib-salesforce-oficial@^1]` (a lib subiu para 1.1.0 com `platform-apex-test-run`, `platform-apex-logs-debug` e `platform-data-manage`). Testes e avaliações das duas skills seguem verdes.
- O publicador reescreve também a forma plana `.claude/skills/<item>` (usada por LWC e Cover Loop), respeitando o limite do nome do item.
- Atualizar uma lib exige subir a versão em `libs/` e republicar as skills que a usam.

## Segurança
Conteúdo de terceiros entra no pacote assinado e passa pelas mesmas varreduras (Unicode oculto, segredos). Licença e NOTICE seguem com a lib.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [ ] Testes de conformidade (scripts/conformidade.mjs), se a regra é verificável
