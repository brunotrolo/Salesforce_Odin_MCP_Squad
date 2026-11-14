# CI/CD e testes no Google Cloud

Fontes: arquitetura 03 seções 1, 3, 7 e 11; segurança 05 e 07; decisões 6, 7, 34, 41. Modelos prontos em `templates/github-workflows/`, `templates/smoke/`, `templates/sintetico/` e `templates/carga/`.

## Pipelines (repositório Odin)
| Workflow | Gatilho | Faz | Identidade |
|---|---|---|---|
| `ci.yml` | Todo PR e push | Testes, emuladores, conformidade, docs, skills, segurança (CodeQL, gitleaks, OSV, Checkov), matriz do CLI e do guard, `terraform plan` (sem aplicar) | Nenhuma no GCP para PR; leitura via WIF para `plan` em `main` |
| `deploy.yml` | Disparo manual do mantenedor (`workflow_dispatch`) em `main` | Build, SBOM, varredura, push no Artifact Registry, deploy no Cloud Run **sem tráfego** (revisão etiquetada), **fumaça na revisão nova**, migração de tráfego; falha → tráfego volta para a revisão anterior | `sa-ci-deploy` (WIF, `actor_id` do mantenedor) |
| `publish.yml` | Merge em `catalog/` na `main` | Lê skills privadas com token do GitHub App, valida, testa, `odin lint`, empacota, assina no KMS, publica, smoke de roteamento | `sa-ci-signer` (WIF, `actor_id`, `main`) |
| `infra.yml` | Disparo manual do mantenedor | `terraform plan` + `apply` em `infra/envs/poc` | `sa-ci-infra` (WIF, `actor_id`, `main`) |
| `cli-release.yml` | Tag `cli-v*` criada pelo mantenedor | Binários por plataforma, assinatura `cli-signing`, bucket privado, script de instalação com checksum fixado | `sa-ci-signer` |
| `sintetico.yml` | Agenda diária + manual | Dispara o job sintético e a carga leve; abre issue se falhar | `sa-ci-deploy` |

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
- **Sintético** (`templates/sintetico/`): Cloud Run Job `odin-sintetico` + Cloud Scheduler a cada 15 min. Executa token → `initialize` → `tools/list` → `odin_rotear` com intenção conhecida → `odin_carregar_skill` → `odin_conhecimento_buscar` → confere o evento de auditoria. Falha gera métrica e alerta (Cloud Monitoring, e-mail ao mantenedor).
- **Verificações de disponibilidade** (uptime checks) em `/healthz` do MCP, do STS e do portal.
- **Carga** (`templates/carga/k6-50-usuarios.js`): 50 usuários virtuais, 10 min; limites p95 do MCP < 300 ms e erros < 1%.
- **Custos:** jobs e verificações cabem na faixa gratuita ou custam centavos; confirme no orçamento (alerta em US$ 5).

## Ambientes
- **Local:** emuladores (Firestore, Pub/Sub, Auth), servidores locais, JWKS de teste.
- **PoC (`odin-poc`):** `run.app`, sem Load Balancer; o deploy e os testes acima rodam aqui.
- **Teste e produção:** criados no Portão 2, com o mesmo Terraform (`infra/envs/<amb>`).
