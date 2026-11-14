---
name: odin-arquiteto
description: Guardião da arquitetura do Odin. Responde se uma ideia ou mudança respeita as decisões, a arquitetura, a segurança e o portal documentados e, quando uma mudança é legítima, conduz o ADR (registro de decisão) e a atualização consistente de todos os documentos afetados. Use quando surgir "posso mudar X?", "e se usarmos Y?", resultado da F0 que confirma ou derruba premissa, conflito entre documentos, ou quando o hook guard-docs bloquear a edição de um documento protegido.
argument-hint: consultar <pergunta> | mudar <proposta> | resultado-f0 <teste> | revisar
---

# odin-arquiteto: decisões e documentos de referência

Abra a sessão com `node scripts/sessao.mjs inicio`. Leia `docs/DECISOES.md`, `docs/adr/README.md` e o documento da área (mapa em `../odin-dev/references/mapa-de-documentos.md`).

## consultar <pergunta>
1. Encontre a resposta nos documentos e **cite a fonte** (arquivo e seção). Ordem de precedência: DECISOES → segurança → portal → arquitetura → plano; ADRs aceitos atualizam todos.
2. Se a resposta não estiver documentada, diga isso e proponha: decidir agora (mantenedor) e registrar como ADR.
3. Não altere nada nesse modo.

## mudar <proposta>
1. **Impacto:** liste os documentos e seções afetados (use `references/impacto.md`), riscos (plano, seção 18), controles de segurança (`docs/seguranca/10`) e regras de conformidade (`scripts/conformidade.mjs`).
2. **Pergunte ao mantenedor** quando a mudança altera custo, segurança, experiência do usuário ou uma das 41 decisões. Apresente alternativas com a recomendação.
3. **ADR:** `node scripts/adr.mjs novo "Título"` (abre a liberação dos documentos protegidos por 12 h). Preencha todas as seções do modelo.
4. **Atualize todos os documentos afetados de uma vez**, mantendo os mesmos números e termos em todos; acrescente a linha na tabela de revisões (plano, seção 20); se o termo antigo não pode mais aparecer, inclua-o em `scripts/termos-proibidos.json`; se a regra é verificável, acrescente o teste em `scripts/conformidade.mjs`.
5. **Verifique:** `npm run verificar` e `npm test`; chame `odin-revisor-documentacao` (consistência) e, se tocar segurança, `odin-revisor-seguranca`.
6. Com o "ok" do mantenedor: `node scripts/adr.mjs aceitar NNNN`, atualize o índice em `docs/adr/README.md`, `docs/ESTADO.md`, e `node scripts/adr.mjs fechar`.

## resultado-f0 <teste>
Para cada teste do `docs/F0-ROTEIRO.md`: se confirmou, troque `[VERIFICAR]` por `[CONFIRMADO]` nos documentos (um ADR de "resultados da F0" cobre todos os confirmados); se derrubou a premissa, um ADR por mudança, usando a alternativa já prevista no documento.

## revisar
Rode `npm run verificar`, chame o `odin-revisor-documentacao` e o `odin-auditor`, e apresente o relatório (sem alterar nada).

## Regras
- Nunca contorne o hook `guard-docs`: ele existe para forçar o ADR.
- Uma mudança de número (TTL, cota, limite, prazo) é decisão.
- Todo documento atualizado no mesmo conjunto de mudanças: nada de "atualizo depois".

## Referências
- `references/impacto.md`: onde cada tipo de mudança aparece nos documentos.
