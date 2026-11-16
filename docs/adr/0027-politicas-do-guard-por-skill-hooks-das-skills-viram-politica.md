# 0027. Politicas do guard por skill (hooks das skills viram politicas assinadas)

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F6
**Documentos afetados:** docs/seguranca/06-seguranca-do-endpoint.md; .claude/skills/odin-curador/SKILL.md

## Contexto
As skills têm hooks `PreToolUse` próprios (por exemplo, o Deep Debugger nega mutação de dados e pede confirmação para deploy). O Odin não entrega `settings.json` (o lint proíbe), então esses hooks se perdiam na migração. O contrato já aceitava `politicas` no `odin.yaml`, mas o guard só tinha as políticas globais PG-01 a PG-08.

## Decisão
1. Uma skill declara `politicas: [<id>]` e entrega `<runtime.dir>/politicas/<id>.mjs`. O arquivo exporta uma função pura `(evento, ambiente) => null | {decisao: 'negar'|'perguntar'|'alertar', motivo}`. Vai no runtime assinado, com hash no manifesto, e é instalado pelo `odin ensure`.
2. O guard registra a skill na sessão quando vê `odin ensure <skill>` passar e, depois das políticas globais, aplica só as políticas das skills ativas **naquela sessão**. A mais severa vence (negar, perguntar, alertar).
3. `perguntar` vira `permissionDecision: ask` no hook. Política que não carrega ou lança exceção **nega** (fail-closed), citando a skill.
4. O lint reprova política declarada sem o arquivo no runtime.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Aplicar as políticas de todas as skills instaladas | Uma skill que precisa de `sf data create` seria bloqueada pela política de outra. |
| Entregar o `settings.json` da skill | Vai contra o isolamento (a skill mexeria na configuração da pessoa). |
| Reescrever cada hook em TypeScript dentro do Odin | Duplica a regra; o módulo da skill reaproveita o mesmo código que a skill já testa. |

## Complementos (decididos na migração)
- A política pode **ler** arquivos do projeto (por exemplo, o plano aprovado do Discovery), mas não grava nem abre rede.
- Hooks `PostToolUse` de verificação (rodar `selftest`, `test-skill.sh`, build do protótipo) **não** viram política: são autoverificação coberta pelo CI de cada skill; em runtime, o equivalente é um passo explícito no `SKILL.md`.
- As regras `permissions.deny` do `settings.json` (que o Odin não entrega) passam a ser políticas quando a skill precisa delas: o Archaeologist ganhou a política de somente leitura da org.

## Consequências
- Os hooks das 10 skills podem migrar um a um (o Deep Debugger é o primeiro).
- Código da skill roda dentro do guard: por isso é função pura, assinada pelo KMS, conferida pelo `odin ensure` e testada em CI.
- Uma sessão sem `odin ensure` não recebe as políticas da skill (as globais continuam valendo).

## Segurança
Amplia a superfície do guard (carrega módulo assinado). Mitigações: hash e assinatura no manifesto, fail-closed, id validado contra caminho relativo, registro de sessão limitado a 50 entradas.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [ ] Testes de conformidade (scripts/conformidade.mjs), se a regra é verificável
