# Contratos do Odin

Fonte única dos contratos, em formato verificável (ADR 0018; entregável 3 das [decisões](../docs/DECISOES.md)). O código lê estes arquivos em vez de repetir as regras, e o CI os valida com `npm run verificar:schemas`.

| Arquivo | Contrato | Quem usa |
|---|---|---|
| `odin.schema.json` | `odin.yaml` na raiz de cada repositório de skill | `odin lint`, pipeline de publicação, skill `odin-curador` |
| `manifesto.schema.json` | Manifesto assinado de um pacote (`odin.bundle/1`) | Pipeline (gera), `odin-publisher` (confere e registra), CLI (confere e instala) |
| `eval-casos.schema.json` | `evals/casos.yaml` de cada skill | `odin lint`, `odin dev eval` |
| `eval-resultado.schema.json` | `evals/resultado.json` (`odin.eval/1`) | CI do catálogo, no portão de promoção para `stable` |
| `evento-auditoria.schema.json` | Evento de auditoria gravado por todos os serviços | Serviços (testes de contrato), consultas do portal |
| `odin-configuration.schema.json` | `/.well-known/odin-configuration` | Portal (publica), CLI (lê os endereços) |
| `mcp-tools.json` | As 7 ferramentas MCP: nome, descrição, entrada, saída estruturada e anotações | `odin-mcp` (carrega as definições), guia do portal |
| `openapi/v1.yaml` | API REST `/v1` usada pelo CLI (OpenAPI 3.1) | `odin-mcp`, CLI, testes de contrato |
| `exemplos/` | Um exemplo válido por schema, com dados fictícios | CI e documentação |

## Regras
- **Contrato primeiro:** mudança de contrato começa aqui, com ADR, e só depois vai para o código.
- **Compatibilidade:** campo novo é opcional; remover ou mudar o significado de um campo exige versão nova do `schema` (por exemplo `odin.bundle/2`), com as duas aceitas durante a transição.
- **`additionalProperties: false`** em todo objeto: campo desconhecido é erro, não é ignorado.
- **Sem dado real:** exemplos usam `exemplo.com.br`, hashes repetidos e ids inventados.
- **Ferramentas MCP:** no máximo 7, descrição de até 600 caracteres começando pelas palavras que o modelo buscaria; os nomes precisam bater com as tabelas do plano e da arquitetura técnica (o CI confere).

## Verificar
```bash
npm run verificar:schemas
```
