# Como contribuir com o Odin

Vale para pessoas e para o Claude. O resumo das regras está em [CLAUDE.md](CLAUDE.md); o estado atual, em [docs/ESTADO.md](docs/ESTADO.md).

## Antes de começar
```bash
npm ci
node scripts/sessao.mjs inicio     # estado, próximo passo, ADR aberto
```
Use a skill certa: `/odin-dev` (construir, corrigir, melhorar), `/odin-curador` (catálogo de skills), `/odin-arquiteto` (arquitetura e decisões), `/odin-operacao` (incidentes e rotinas).

## Fluxo
1. **Branch** `odin/<tema>` a partir da `main`.
2. **Mudou decisão, arquitetura, segurança, portal ou plano?** ADR primeiro: `node scripts/adr.mjs novo "título"`. O hook bloqueia a edição dos documentos protegidos sem ADR aberto.
3. **Mudou contrato** (ferramenta MCP, `odin.yaml`, manifesto, auditoria, `/v1`)? Mude o schema em [`schemas/`](schemas/README.md) antes do código.
4. **Teste antes do código** para todo critério de aceite e todo bug.
5. **Verifique:** `npm test` e `npm run verificar` (documentação, skills, contratos, conformidade de segurança e de custo).
6. **Revisores independentes** (agentes somente leitura) conforme a área: arquitetura, segurança, testes, documentação.
7. **PR** para a `main` com o modelo preenchido; merge só com o CI verde e o "ok" do mantenedor.
8. Atualize `docs/ESTADO.md` e o `CHANGELOG.md`; `node scripts/sessao.mjs fim`.

## Definição de pronto
- Critério de aceite com teste nomeado pelo id (por exemplo `CT-05`, `AC-U11`), incluindo os casos negativos.
- Windows nativo coberto quando a mudança toca o CLI ou o guard.
- Nenhum recurso de nuvem com custo fixo sem gatilho medido e ADR ([arquitetura 05](docs/arquitetura/05-custos-e-finops.md)).
- Documentos e contratos alinhados com o código; `npm run verificar` verde.
- Nada escrito no projeto do dev; nenhum segredo; português do Brasil em documentos, interface e mensagens.

## Donos por área
| Área | Pasta | Dono |
|---|---|---|
| Decisões, plano, arquitetura | `docs/` | Mantenedor |
| Segurança | `docs/seguranca/`, `policies/`, `packages/guard/` | Mantenedor (responsável de segurança nomeado antes do time) |
| Catálogo de skills | `catalog/` | Mantenedor (decisão 31) |
| Infraestrutura e custo | `infra/` | Mantenedor |
| Contratos | `schemas/` | Mantenedor |

No GitHub Free não há revisão obrigatória em repositório privado (decisão 41): só o mantenedor tem escrita, e a garantia de integridade é o CI mais a assinatura no KMS. O arquivo `CODEOWNERS` entra junto com a organização GitHub.

## Commits
Mensagem em português, no imperativo, dizendo o que mudou e por quê. Mudança de decisão cita o ADR. Sem dado sensível na mensagem.
