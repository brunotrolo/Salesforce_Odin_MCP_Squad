# Odin MCP Squad: instruções para o Claude

Servidor MCP único (Google Cloud) que entrega as skills de engenharia do time no Claude Code, com login GitHub + segundo fator, perfis, runtime local assinado, base de conhecimento e portal. **Estado atual e próximo passo: `docs/ESTADO.md`.**

## Comece toda sessão assim
1. `node scripts/sessao.mjs inicio`
2. Leia `docs/ESTADO.md` e `docs/DECISOES.md`, depois só o documento da área da tarefa (mapa em `.claude/skills/odin-dev/references/mapa-de-documentos.md`).
3. Use a skill certa: **odin-dev** (construir, corrigir, melhorar o Odin) · **odin-curador** (incluir ou ajustar uma skill no catálogo) · **odin-arquiteto** (dúvida ou mudança de arquitetura) · **odin-operacao** (incidente, revogação, rotação de chaves).
4. Ao terminar: atualize `docs/ESTADO.md` e rode `node scripts/sessao.mjs fim`.

## Fonte da verdade (em caso de conflito, vale o primeiro)
`docs/DECISOES.md` → `docs/seguranca/` (segurança) → `docs/portal/` (portal) → `docs/arquitetura/` → `docs/PLANO.md` → ADRs aceitos em `docs/adr/` (que atualizam os anteriores). Contratos: `schemas/` é a fonte para formato de dados e ferramentas MCP.

## Regras invioláveis (detalhe e fonte em `.claude/skills/odin-dev/references/regras-inviolaveis.md`)
1. Mudou decisão, arquitetura, segurança, portal ou plano → **ADR primeiro** (`node scripts/adr.mjs novo "título"`). O hook bloqueia a edição sem ADR.
2. O Odin **nunca escreve no projeto do dev**; só em `~/.odin`, `~/.claude/agents/odin-*`, `~/.claude/skills/odin/` e blocos marcados.
3. **Sem segredo, dado de cliente, alias de org ou nome real** em código, skill, teste ou documento.
4. **Sem chave de conta de serviço**; CI entra no Google Cloud por identidade federada restrita ao mantenedor (`actor_id`) e à `main`; pacotes e CLI assinados no KMS.
5. Token de acesso **ES256, 15 min, sem perfis dentro**; direitos resolvidos no servidor; revogação ≤ 30 s; refresh rotativo com prova de posse.
6. **Negado por padrão.** No máximo **7 ferramentas MCP** e respostas ≤ 8.000 tokens. Sem chamada de modelo no caminho principal. Trabalho pesado em script que devolve só o resumo; nenhum caractere Unicode oculto (ADR 0017).
7. **Custo por estágio** (`docs/arquitetura/05-custos-e-finops.md`): tudo escala a zero, máximo de 3 instâncias, 3 serviços + 3 jobs; nenhum recurso de custo fixo (Cloud SQL, Load Balancer, Cloud Armor, instância quente) sem gatilho medido e ADR; **nenhum conhecimento confidencial** antes do Cloud SQL com isolamento no banco.
8. **Prioridade de teste: Windows nativo e extensão do VS Code.**
9. GitHub Free: só o mantenedor escreve; trabalhe em branch, PR com CI verde; merge com o "ok" do mantenedor.
10. Uma fase só fecha com os critérios da seção 16 do plano, os revisores independentes e os testes verdes.

## Comandos
`npm ci` · `npm test` · `npm run verificar` (docs + skills + contratos + conformidade + roteamento + tipos) · `npm run demo` · `npm run dev` · `node scripts/adr.mjs listar|novo|aceitar|fechar` · `node scripts/sessao.mjs inicio|fim`

Idioma: português do Brasil em documentos, interface e mensagens.
