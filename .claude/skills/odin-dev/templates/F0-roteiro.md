# Roteiro da F0 (modelo)

> Copiar para `docs/F0-ROTEIRO.md` e completar com os endereços do servidor de teste. Executado pelo mantenedor (decisão 2), **primeiro no Windows nativo com a extensão do VS Code**, depois no terminal (decisões 23 e 24), com o LiteLLM real (decisão 3).

## Preparação
- Servidor MCP de teste no ar (Cloud Run da `odin-poc` ou local), com: 2 ferramentas, 1 prompt, 1 recurso, instruções do servidor, autenticação por `Authorization: Bearer` e resposta `401` quando o token vence.
- Script `odin-teste-token` que imprime `{"Authorization":"Bearer <token de teste>"}` e registra cada chamada num arquivo.
- Hook de teste que registra cada `PreToolUse` e bloqueia um comando marcado.

## Testes (registrar: resultado, versão do Claude Code, superfície, observações)
| # | Teste | Como | Esperado | Afeta |
|---|---|---|---|---|
| T01 | Registro no escopo do usuário | `claude mcp add --transport http --scope user odin-teste <url>` + `headersHelper` | Servidor aparece conectado em qualquer pasta | Plano 5.1 |
| T02 | `headersHelper` chamado e renovado em `401` | Forçar expiração do token | Helper chamado de novo e a chamada repetida sem erro visível | Plano 5.1; R2 |
| T03 | Instruções do servidor como gatilho | Pedido em linguagem natural sem citar o servidor | O modelo chama a ferramenta de roteamento | Plano 7.6 |
| T04 | Prompts como comandos | Digitar `/` | `/odin-teste:<prompt>` aparece | Plano 10 |
| T05 | Recursos com `@` | `@odin-teste:skill://…` | Conteúdo anexado | Plano 10 |
| T06 | Limite de saída | Ferramenta devolve 12.000 tokens | Aviso; corte em 25.000 | Plano 10 |
| T07 | Busca de ferramentas via LiteLLM | Uso normal com o LiteLLM real | Ferramentas carregadas sob demanda, sem erro do gateway | R11 |
| T08 | Hook no Windows nativo | Comando marcado pelo hook de teste | Bloqueado; registrar qual shell executou o hook | Segurança 06 |
| T09 | Observador de hooks | Alterar o hook com a sessão aberta | Mudança vale sem reiniciar (ou registrar que exige reinício) | Plano 7.4 |
| T10 | Observador de agentes | Criar agente em `~/.claude/agents/` com a sessão aberta | Disponível na delegação seguinte | Plano 7.2 |
| T11 | Importação `@~/` no `CLAUDE.md` do usuário | Linha `@~/.odin/ODIN.md` | Conteúdo carregado | R13 |
| T12 | Modo sem estado do MCP | Servidor sem `Mcp-Session-Id` | Funciona normalmente | Arquitetura 03, 6.1 |
| T13 | Onde fica o token OAuth do MCP do Jira | Inspecionar após `/mcp` | Local identificado para a política PG-01 | Segurança 06, 3.1 |
| T14 | Cofre do sistema pelo CLI | Gravar e ler segredo de teste no Windows Credential Manager | Funciona sem prompt | Segurança 06, 7 |
| T15 | Empacotamento do CLI | Executável único com acesso ao cofre | Funciona no Windows, macOS e Linux | Decisão 39 |

## Fechamento
Para cada teste: `[CONFIRMADO]` ou ADR com a mudança. Atualizar `docs/ESTADO.md` e a tabela de revisões (plano, seção 20).
