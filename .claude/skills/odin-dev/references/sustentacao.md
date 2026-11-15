# Sustentação e melhoria contínua

## Bug
1. Reproduza: escreva o teste que falha (com o id da issue do `odin-suporte` no nome).
2. Classifique: é segurança? Se sim, siga a severidade de `docs/seguranca/09` e chame a skill `odin-operacao` para conter antes de corrigir.
3. Corrija o mínimo necessário; teste verde; casos vizinhos cobertos.
4. Revisores: arquitetura e testes; segurança se tocar autenticação, tokens, guard, IAM, dados ou distribuição.
5. Versão: correção = versão de *patch*; deploy pelo fluxo seguro (fumaça + rollback).
6. Feche a issue com o link do PR; ESTADO atualizado.

## Melhoria
1. Verifique se muda decisão, limite, fluxo ou contrato. Se sim: ADR primeiro (`odin-arquiteto`).
2. Escreva o critério de aceite e o teste.
3. Implemente; documentação do usuário (guia do MCP, portal) atualizada junto.
4. Mudança visível para o usuário: entrada em "Novidades" do portal (evento do ciclo de vida, quando for skill).

## Versões e compatibilidade
- Serviços: SemVer; API `/v1` e ferramentas MCP **não quebram** contratos sem nova versão e período de convivência.
- CLI: versão atual + anterior por 30 dias (decisão 22); depois, atualização forçada pelo `ensure`.
- Skills: canais `beta` → `stable`; rollback por PR; versão perigosa → lista de versões proibidas (RB-09).
- Mudou o formato de `odin.yaml` ou do manifesto: versão nova do schema, `odin lint` aceita as duas durante a transição.

## Rotina do mantenedor
| Frequência | O quê |
|---|---|
| Semanal | Relatório do `odin-auditor`; issues do `odin-suporte`; alertas abertos; Dependabot; **custo por serviço** e maior variação da semana (arquitetura 05, seção 8) |
| Mensal | Rotação da credencial do teste sintético; custo contra a meta do estágio (E0 ≤ US$ 3, E1 ≤ US$ 25); limpeza do Artifact Registry conferida; lacunas de conhecimento |
| Trimestral | Revisão de acessos (RB-12); revisão das compensações do GitHub Free; reavaliar cotas; reavaliar os gatilhos de estágio com as medições (partida a frio, DT-18, recuperação do RAG) |
| Semestral | Rotação de chaves e segredos (RB-04, RB-06); simulação de incidente; revisão do modelo de ameaças |
| Anual | Rotação de `bundle-signing` e `cli-signing` (RB-05); pentest |

## Incidentes
Use a skill `odin-operacao` (playbooks de `docs/seguranca/09` e runbooks de `docs/seguranca/11`). Depois do incidente: ADR se um controle mudou, teste que impede a repetição e relatório sem culpados.
