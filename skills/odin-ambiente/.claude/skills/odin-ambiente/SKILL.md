---
name: odin-ambiente
description: Confere se a máquina está pronta para as skills do time (Node, Git, Salesforce CLI, org padrão, Playwright) e diz o que instalar ou corrigir. Use para "minha máquina está pronta?", "o que falta instalar", "preparar o ambiente".
---

# Ambiente

Diz, em poucas linhas, se a máquina está pronta para as skills do Odin e o que fazer se não estiver.

## Passos
1. Rode `odin ensure odin-ambiente`. Só continue se a resposta tiver `"ok": true`; senão, mostre a `mensagem` e pare.
2. Rode o verificador (ele só lê; não instala nem altera nada):
   ```bash
   node .claude/skills/odin-ambiente/scripts/verificar-ambiente.mjs
   ```
3. O verificador imprime um resumo de até 15 linhas e grava o detalhe em `.odin-ambiente/relatorio.json`. Mostre o resumo como veio. Não cole o JSON inteiro na conversa.
4. Para cada item marcado com `✗`, diga o comando exato de correção que o resumo traz. Se a pessoa pedir mais detalhe sobre um item, leia `references/prerequisitos.md`.
5. Não instale nada por conta própria: mostre o comando e deixe a pessoa decidir.

## Quando parar
- `odin ensure` falhou: mostre a mensagem e pare.
- O verificador não rodou (Node ausente): diga para instalar o Node 20 ou mais novo e pare.
