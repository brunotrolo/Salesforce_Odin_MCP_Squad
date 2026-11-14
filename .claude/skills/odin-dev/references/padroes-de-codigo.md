# Padrões de código

## Stack
| Parte | Escolha | Fonte |
|---|---|---|
| Servidor MCP, STS, webhooks, publisher, jobs | Node 22 + TypeScript, SDK oficial do MCP, Streamable HTTP sem estado | Arquitetura 03, 6.1 |
| Portal | Next.js (App Router), TypeScript, Radix UI + Tailwind, renderização no servidor, BFF | Portal 01, 5 |
| CLI e guard | Node 22 + TypeScript, executável único por plataforma (ferramenta decidida na F0) | Arquitetura 03, 9.1 |
| Infraestrutura | Terraform (`infra/modules`, `infra/envs/poc`) | Arquitetura 03, 11 |
| Testes | `node:test` ou Vitest; Playwright para o portal; k6 para carga | Este documento |

## Estrutura (plano, seção 19)
```
apps/mcp-server/  apps/portal/  apps/sts/  apps/webhooks/  apps/publisher/  apps/indexer/  apps/jobs/
packages/cli/  packages/guard/  packages/manifest/  packages/router/  packages/lint/  packages/shared/
catalog/  policies/  libs/  pipeline/  infra/  schemas/  tests/  docs/  .claude/
```
- `packages/shared`: tipos, códigos de erro, logger, validação de JWT, cliente do Firestore. Nada de lógica duplicada entre serviços.
- Ferramentas do MCP: um arquivo por ferramenta em `apps/mcp-server/src/tools/` (o teste CF-06 conta esses arquivos).

## Convenções
- **Configuração** por variáveis de ambiente validadas na inicialização (falha cedo, mensagem clara). Segredos só por Secret Manager (referência de versão).
- **Constantes de segurança** nomeadas e únicas em `packages/shared/src/limites.ts`: `ACCESS_TOKEN_TTL_SECONDS = 900`, `REVOCATION_CACHE_SECONDS = 30`, `MAX_TOOL_RESPONSE_TOKENS = 8000`, `OFFLINE_COPY_DAYS = 7`. Mudar = ADR (CF-05 confere o TTL).
- **Erros:** códigos estáveis (`sem_acesso`, `skill_inexistente`, `versao_indisponivel`, `limite_excedido`, `revogado`, `manutencao`, `invalido`), mensagem para a pessoa em português e `request_id`.
- **Logs:** JSON estruturado com `request_id`, `ator`, `acao`, `resultado`, `latencia_ms`. **Nunca** cabeçalho `Authorization`, token, segredo ou texto do pedido do usuário.
- **Validação de entrada** com schema em toda ferramenta MCP e rota (CT-10).
- **Datas** em UTC no armazenamento; horário de Brasília só na exibição.
- **Idempotência** em escritas (`Idempotency-Key` no portal, id de entrega nos webhooks).
- **Windows:** `path.join`/`path.resolve` sempre; nada de `/` fixo; testes do CLI e do guard rodam em `windows-latest`; cofre via Windows Credential Manager.
- **Dependências:** lockfile, versões fixas, sem `postinstall` de terceiros sem revisão; idade mínima de 7 dias para versões novas.
- **Acessibilidade e idioma** no portal: WCAG 2.1 AA; textos em arquivos de tradução (pt-BR).

## Commits e PRs
- Branch `odin/<fase>-<tema>`; commits pequenos, em português, no imperativo ("Adiciona validação de JWT").
- PR com: objetivo, critério de aceite atendido, testes executados, resultado dos revisores, ADR relacionado.
