# Registro de decisões de arquitetura (ADR)

Toda mudança de decisão no Odin, depois da linha de base abaixo, vira um ADR numerado nesta pasta. É assim que outra sessão (outro chat, outra pessoa) entende **por que** algo é como é e não desfaz uma decisão sem querer.

## Linha de base (não repetir aqui)
- **ADR-01 a ADR-15:** decisões de arquitetura em [arquitetura de solução, seção 5](../arquitetura/01-arquitetura-de-solucao.md).
- **Decisões 1 a 41:** respostas do mantenedor em [DECISOES.md](../DECISOES.md).
- **Rodadas de revisão 1 a 15:** histórico em [plano, seção 20](../PLANO.md).

## Quando abrir um ADR
- Mudar qualquer documento protegido: `docs/DECISOES.md`, `docs/PLANO.md`, `docs/arquitetura/**`, `docs/seguranca/**`, `docs/portal/**`.
- Resultado da F0 que confirma ou derruba uma premissa `[VERIFICAR]`.
- Trocar uma tecnologia, um fluxo de autenticação, um limite (TTL, cota, tamanho) ou uma política do guard.
- Incidente que muda um controle.

Correções de texto sem efeito em decisão (ortografia, link) também passam pelo ADR aberto, mas podem reaproveitar um ADR de "manutenção de documentação" já aceito: `node scripts/adr.mjs abrir <n>`.

## Como
```bash
node scripts/adr.mjs novo "Título da decisão"   # cria NNNN-titulo.md (Proposto) e libera os documentos por 12 h
# preencher o ADR, atualizar os documentos afetados, ESTADO e a tabela de revisões do plano
node scripts/adr.mjs aceitar NNNN               # depois do "ok" do mantenedor
node scripts/adr.mjs fechar                     # fecha a liberação
```
O hook `.claude/hooks/guard-docs.mjs` bloqueia a edição dos documentos protegidos sem ADR aberto, e o CI (`npm run verificar:docs -- --base origin/main`) recusa um conjunto de mudanças que altere documento protegido sem um ADR junto.

## Estados
`Proposto` → `Aceito` ou `Rejeitado`; um ADR aceito pode depois ficar `Substituído` por outro.

## Índice
| ADR | Status | Título |
|---|---|---|
| [0016](0016-skill-de-desenvolvimento-e-sustentacao-do-odin.md) | Aceito | Skill de desenvolvimento e sustentação do Odin |
