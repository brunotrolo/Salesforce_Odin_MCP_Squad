# 0020. Desenvolvimento local primeiro e ajustes de implementação

**Status:** Aceito (2026-11-15)
**Data:** 2026-11-15
**Fase:** F2 a F5 (antecipadas, em modo local)
**Documentos afetados:** docs/DECISOES.md (decisão 53); docs/PLANO.md §3.3, §7.4, §8.3, §16, §20; docs/seguranca/05 §3; docs/seguranca/06 §2; docs/arquitetura/03 §9.1; schemas/manifesto.schema.json

## Contexto
O mantenedor liberou o desenvolvimento e escolheu construir tudo localmente, publicar no GitHub, testar e só depois levar ao Google Cloud. Ao escrever o primeiro caminho completo (emissor de tokens, servidor MCP, pipeline, CLI, guard), alguns pontos do desenho precisaram de ajuste.

## Decisão
1. **Local primeiro.** Cada dependência de nuvem fica atrás de uma interface com duas implementações: local (memória, arquivo, chave local) e Google Cloud (Firestore, Cloud Storage, KMS, Vertex AI), esta última na F1. Interfaces: `Store`, `Armazenamento`, `Assinador`, `Embedder`, `Cofre`.
2. **TypeScript executado direto pelo Node 22** (sem etapa de build), com checagem de tipos pelo `tsc` no CI. Um pacote npm só, com pastas `apps/` e `packages/`.
3. **Prova de vida do guard pelo próprio `odin ensure`:** o guard grava um marcador ao ver o comando passar, e o `ensure` exige o marcador recente. O `guard-ping` com nonce não funcionaria: um comando chamado de dentro do `ensure` é subprocesso, e hooks só veem chamadas de ferramenta do modelo.
4. **Pacote `.odinpkg`** (JSON canônico comprimido com gzip) no lugar de `tar.zst`: determinístico, sem dependência externa e conferível arquivo a arquivo.
5. **Manifesto com o campo `entrega`** (pré-requisitos, agentes, coleções, políticas), para o servidor e o CLI não precisarem abrir o pacote.
6. **Roteador léxico local** atrás da interface `Embedder` (95% no conjunto de avaliação). Quando o pedido parece de uma skill fora do perfil, responde "não sei" e diz qual, em vez de sugerir outra.
7. **Página de ativação de desenvolvimento** no emissor (escolha de pessoa fictícia) até o portal existir. Só liga com `loginDev`, nunca na nuvem.
8. **Cofre em arquivo com permissão 0600** nesta etapa; o cofre do sistema entra atrás da mesma interface.
9. **Skill de apoio `odin-ambiente`**, do próprio Odin, usada no fluxo local e útil ao time.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Começar pela nuvem (F0 e F1) | O mantenedor preferiu custo zero e ciclos rápidos; as interfaces mantêm a troca barata |
| Emuladores do Firestore no dia a dia | Mais lentos e pesados que a implementação em memória; entram no teste da implementação de nuvem |
| Servidor MCP escrito à mão | O SDK oficial reduz o risco de incompatibilidade com o Claude Code; os testes usam o cliente oficial |
| `tar.zst` | Exigiria biblioteca nativa ou binário externo no CLI |

## Consequências
- Melhora: o Odin inteiro roda e é testado na máquina, em segundos, sem custo; 44 testes, um deles de ponta a ponta.
- Piora ou risco: o que só a nuvem prova (KMS, IAM, partida a frio, Claude Code real com LiteLLM) continua pendente e concentra risco no fim (**R24**); cofre em arquivo é mais fraco que o cofre do sistema até a troca (**R25**).
- Testes: CT-03, CT-04, CT-05, CT-12, CT-15, CT-25, CT-26 e CT-29 já têm teste; CF-05 passou a conferir a definição da constante.

## Segurança
Sem regressão nos controles. A prova de vida do guard ficou mais forte (não depende de um segundo comando). O cofre em arquivo é um risco aceito só para o desenvolvimento local.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade: CF-05 ajustada
