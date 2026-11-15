# CI/CD e testes no Google Cloud

Fontes: arquitetura 03 seções 1, 3, 7 e 11; arquitetura 05 (custos); segurança 05 e 07; decisões 6, 7, 34, 41 e 42 a 48. Modelos prontos em `templates/github-workflows/`, `templates/smoke/`, `templates/sintetico/` e `templates/carga/`.

## Pipelines (repositório Odin)
| Workflow | Gatilho | Faz | Identidade |
|---|---|---|---|
| `ci.yml` | Todo PR e push | Testes, emuladores, schemas, conformidade (inclusive custo), docs, skills, segurança (CodeQL, gitleaks, OSV, Checkov), matriz do CLI e do guard (Windows e Linux em PR; macOS só em release e semanal), isolamento do RAG em contêiner Postgres + pgvector, `terraform plan` (sem aplicar). Execuções repetidas do mesmo PR são canceladas | Nenhuma no GCP para PR; leitura via WIF para `plan` em `main` |
| `deploy.yml` | Disparo manual do mantenedor (`workflow_dispatch`) em `main` | Build, SBOM, varredura, push no Artifact Registry, deploy no Cloud Run **sem tráfego** (revisão etiquetada) dos serviços `odin-mcp`, `odin-sts`, `odin-portal` e atualização da imagem dos jobs, **fumaça na revisão nova**, migração de tráfego; falha → tráfego volta para a revisão anterior | `sa-ci-deploy` (WIF, `actor_id` do mantenedor) |
| `publish.yml` | Merge em `catalog/` na `main` | Lê skills privadas com token do GitHub App, valida, testa, `odin lint`, empacota, assina no KMS, envia ao bucket, **executa o job `odin-publisher`** (que confere a assinatura e registra), smoke de roteamento | `sa-ci-signer` (WIF, `actor_id`, `main`) |
| `infra.yml` | Disparo manual do mantenedor | `terraform plan` + `apply` em `infra/envs/poc` | `sa-ci-infra` (WIF, `actor_id`, `main`) |
| `cli-release.yml` | Tag `cli-v*` criada pelo mantenedor | Binários por plataforma, assinatura `cli-signing`, bucket privado, script de instalação com checksum fixado | `sa-ci-signer` |
| `sintetico.yml` | Manual (o sintético contínuo roda no `odin-jobs`, pelo `odin-tick`) | Executa o `odin-jobs` com a tarefa `sintetico` e a carga leve; abre issue se falhar | `sa-ci-deploy` |

## Identidade federada (sem chave)
- Pool `github`, provedor `github-oidc`, condição: dono do repositório **e** `assertion.actor_id == '<id do mantenedor>'` **e** `assertion.ref == 'refs/heads/main'` (PRs não acessam a nuvem). CF-04 confere.
- Cada workflow assume só a conta de serviço dele; permissões mínimas no recurso.
- Ações de terceiros fixadas por SHA completo (CF-10); `permissions:` explícitas por job; sem `pull_request_target`.

## Deploy seguro no Cloud Run
1. `gcloud run deploy <svc> --image <digest> --no-traffic --tag cand-<sha7>`.
2. Fumaça contra a URL etiquetada (`templates/smoke/smoke.mjs`), com a conta de teste.
3. Verde → `gcloud run services update-traffic <svc> --to-tags cand-<sha7>=100`.
4. Vermelho → não migra tráfego; o workflow falha, registra e mantém a revisão anterior.
5. Pós-migração: fumaça de novo contra a URL principal; falha → `--to-revisions <anterior>=100`.

## Testes contínuos no Google Cloud
- **Sintético** (`templates/sintetico/`): tarefa do job `odin-jobs`, executada pelo agendamento único `odin-tick` a cada 15 min (sem job nem agendamento próprios). Executa token → `initialize` → `tools/list` → `odin_rotear` com intenção conhecida → `odin_carregar_skill` → `odin_conhecimento_buscar` → confere o evento de auditoria. Falha gera métrica e alerta (Cloud Monitoring, e-mail ao mantenedor).
- **Verificações de disponibilidade** (uptime checks) em `/healthz` do MCP, do STS e do portal.
- **Carga** (`templates/carga/k6-50-usuarios.js`): 50 usuários virtuais, 10 min; limites p95 do MCP < 300 ms e erros < 1%.
- **Custos:** jobs e verificações cabem na faixa gratuita; confirme no orçamento (alerta em US$ 5 em E0).

## Custo no pipeline (arquitetura 05)
- `terraform plan` recebe o **estágio** (`e0`, `e1`, `e2`); os módulos recusam recurso fora dele, e `npm run conformidade` repete a checagem (CF-11 a CF-14).
- Orçamento, tópico `budget-alerts`, função `odin-disjuntor` e limpeza do Artifact Registry entram na F1, antes de qualquer serviço.
- **Minutos do GitHub Free** (2.000/mês; Windows em dobro, macOS dez vezes): `concurrency` com cancelamento, `timeout-minutes` em todo job, filtros de caminho, macOS só em release.
- Ensaio do disjuntor na F8: simular o aviso de 300%, conferir o ingress fechado, o modo degradado e a volta pelo RB-13.

## Ambientes
- **Local:** emuladores (Firestore, Auth), contêiner Postgres + pgvector para o isolamento do RAG, servidores locais, JWKS de teste.
- **PoC (`odin-poc`, estágio E0):** `run.app`; o deploy e os testes acima rodam aqui. Continua como ambiente de ensaio depois que o `prod` existir.
- **Produção (`odin-prod`, estágio E1):** criada no Portão 2, com o mesmo Terraform (`infra/envs/prod`) e a mesma topologia. Não há ambiente de teste permanente na nuvem. E2 só por gatilho.
