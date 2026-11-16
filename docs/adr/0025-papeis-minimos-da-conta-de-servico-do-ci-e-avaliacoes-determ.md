# 0025. Papéis mínimos da conta de serviço do CI e avaliações determinísticas das skills

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F1 (endurecimento), F6
**Documentos afetados:** docs/HOMOLOGACAO.md; docs/ESTADO.md; docs/STATUS-DO-PROJETO.md; CHANGELOG.md

## Contexto
O mantenedor autorizou três itens que tinham ficado de fora por risco: reduzir o papel Owner de `sa-ci-infra`, testar o disjuntor de custo de verdade e escrever as avaliações das skills.

## Decisão
1. **Papéis mínimos.** `sa-ci-infra` deixa de ser Owner e passa a ter só: `serviceusage.serviceUsageAdmin`, `iam.serviceAccountAdmin`, `iam.serviceAccountUser`, `iam.roleAdmin`, `resourcemanager.projectIamAdmin`, `cloudkms.admin`, `cloudkms.signerVerifier`, `cloudkms.publicKeyViewer`, `storage.admin`, `secretmanager.admin`, `run.admin`, `pubsub.admin`, `cloudscheduler.admin`, `datastore.owner`, `artifactregistry.admin` e `logging.viewer`. O workflow `papeis-ci.yml` aplica a lista (idempotente) e, com confirmação explícita, remove o Owner. A conta mantém `projectIamAdmin`, então consegue acrescentar um papel que falte; ela não consegue se devolver o Owner (só um Owner concede Owner). Validado: `infra.yml` (apply) e `homologar.yml` (26/26) verdes sem o Owner.
2. **Disjuntor testado de verdade.** O workflow `disjuntor-real.yml` (confirmação `FECHAR-E-REABRIR`) envia um aviso real de 316% do orçamento, confere que STS e MCP fecham para a internet e reabre, sempre (bloco `finally`).
3. **Avaliações determinísticas.** `pipeline/avaliar.ts` roda os casos de `evals/casos.yaml`, confere a composição mínima (ADR 0017) e aplica o portão de promoção. As 10 skills ganharam 10 a 13 casos cada, gerados por `scripts/gerar-evals.mjs` a partir das regras reais (guards, selftests, permissões, Unicode oculto, segredos, teto de tokens). Casos negativos e de injeção são críticos.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Manter o Owner | Uma conta de CI com Owner pode apagar o projeto e conceder acesso total |
| Papéis ainda mais estreitos por serviço | O Terraform administra todos os serviços do projeto; separar exigiria várias contas e fluxos |
| Só simular o disjuntor | Não prova que o fechamento e a volta funcionam |

## Consequências
- Melhora: o CI não consegue apagar o projeto nem se promover a Owner; o disjuntor está comprovado; as skills têm portão de promoção.
- Piora ou risco: `projectIamAdmin` ainda permite escalar por papéis fortes que não sejam Owner; mitigação: o CI só roda na `main`, só para o mantenedor. O disjuntor real causa um corte curto, só sob confirmação explícita. As avaliações determinísticas não substituem as com modelo.
- Testes e aceite: homologação 26/26 sem Owner; `disjuntor-real.yml` verde; `npm test` e `node scripts/avaliar-skill.ts` verdes nas 10 skills.

## Segurança
Remove o maior privilégio do CI. Registro: `gcloud projects get-iam-policy` mostra os papéis da conta no fim de cada execução do `papeis-ci.yml`.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade: não aplicável (sem regra verificável nova)
