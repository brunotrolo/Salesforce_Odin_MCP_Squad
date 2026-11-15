# 09. Contratos de dados e API do portal

> [Índice do portal](README.md) · A API do portal (`/api/*`) só é chamada pelas páginas do próprio portal (BFF). Toda rota confere sessão, MFA recente, CSRF (em escrita), papel e escopo, e grava auditoria.

## 1. Convenções
- JSON; datas em ISO 8601 (UTC) e exibidas no horário de Brasília.
- Paginação por cursor (`?cursor=…&limite=50`, máximo 200).
- Erros: `{ "erro": "<codigo>", "mensagem": "<texto para a pessoa>", "request_id": "…" }`, com códigos `nao_autenticado`, `mfa_necessario`, `sem_permissao`, `nao_encontrado`, `invalido`, `conflito`, `limite`, `quatro_olhos_pendente`.
- Escrita idempotente com o cabeçalho `Idempotency-Key`.
- **MFA:** coluna "MFA" = idade máxima do segundo fator exigida (5 min ou 15 min).

## 2. Área do usuário

| Tela | Método e rota | Permissão | MFA | Fonte |
|---|---|---|---|---|
| Início | `GET /api/me/resumo` | Sessão | 8 h | Firestore, `quotas`, `uso_diario`, `catalog_events` |
| Conectar | `GET /api/conectar` (comandos e checksums da release atual do CLI) | Sessão | 8 h | Release do CLI |
| Instalador e download do CLI | `GET /install.sh` · `GET /install.ps1` (script com o checksum fixado da versão atual) · `GET /download/cli/{versao}/{plataforma}` | **Público** (o binário não é segredo; os repositórios são privados) | — | Bucket privado `odin-cli-<amb>` |
| Ativar | `GET /api/ativar/{user_code}` · `POST /api/ativar/{user_code}` (`aprovar` ou `nao_fui_eu`) | Sessão | **5 min** | `device_codes` |
| Guia → Ferramentas | `GET /api/mcp/ferramentas` | Sessão | 8 h | `mcp_tools/{versao_servidor}` (publicado pelo `odin-mcp` ao iniciar) |
| Guia → Skills / Minhas skills | `GET /api/me/skills` | Sessão | 8 h | Direitos efetivos + `catalog_skills` |
| Meu consumo | `GET /api/me/consumo?periodo=` · `GET /api/me/chamadas?cursor=` · `GET /api/me/consumo/export` | Sessão | 8 h | `uso_diario`, `eventos`, `quotas` |
| Novidades | `GET /api/me/novidades` · `POST /api/me/novidades/lidas` | Sessão | 8 h | `catalog_events` filtrados pelos direitos |
| Solicitar | `POST /api/solicitacoes` · `GET /api/me/solicitacoes` | Sessão | 8 h | `access_requests` |
| Conhecimento | `GET /api/me/propostas` · `POST /api/propostas` | Direito `propor` | 8 h | `proposals` |
| Conta → MFA | `GET /api/me/mfa` · `POST /api/me/mfa/{tipo}` · `DELETE /api/me/mfa/{id}` · `POST /api/me/mfa/recuperacao` | Sessão | **5 min** | Identity Platform, `users/{id}/passkeys` |
| Conta → Dispositivos | `GET /api/me/dispositivos` · `PATCH /api/me/dispositivos/{id}` · `DELETE /api/me/dispositivos/{id}` · `DELETE /api/me/dispositivos` | Sessão | 8 h (revogar: sem exigência extra, para facilitar) | `devices` |
| Conta → Tokens | `GET /api/me/tokens` · `POST /api/me/tokens` · `DELETE /api/me/tokens/{id}` | Sessão | **5 min** para criar | `pats` |
| Meus dados | `GET /api/me/export` | Sessão | 5 min | Firestore + BigQuery |

## 3. Console de administração

| Área | Rotas principais | Papel e escopo | MFA |
|---|---|---|---|
| Painel | `GET /api/admin/painel` | Qualquer papel administrativo (recorte pelo escopo) | 15 min |
| Pessoas | `GET /api/admin/pessoas` · `GET /api/admin/pessoas/{id}` · `POST /api/admin/pessoas/convites` · `POST /api/admin/pessoas/{id}/suspender` · `POST /api/admin/pessoas/{id}/reativar` | admin-identidade, super-admin; gestor-squad (convite e leitura no seu squad) | 15 min |
| Pertenças | `PUT /api/admin/squads/{sq}/membros/{pessoa}` (perfis) · `DELETE /api/admin/squads/{sq}/membros/{pessoa}` | admin-identidade; gestor-squad (o seu, perfis permitidos) | 15 min |
| Squads e projetos | `GET/POST/PATCH /api/admin/squads` · `POST /api/admin/squads/{sq}/time-github` · `GET/POST/PATCH /api/admin/projetos` · `POST /api/admin/projetos/{id}/expurgo` (quatro olhos) | admin-identidade, super-admin | 15 min |
| Perfis | `GET /api/admin/perfis` · `POST /api/admin/perfis/simular` (quem é afetado) · `PUT /api/admin/perfis` (nova versão) · `GET /api/admin/perfis/versoes` | admin-catalogo, super-admin | 15 min |
| Concessões | `POST /api/admin/concessoes` · `DELETE /api/admin/concessoes/{id}` | Conforme o alvo (skill: admin-catalogo; coleção: curador; squad: gestor) | 15 min |
| Solicitações | `GET /api/admin/solicitacoes` · `POST /api/admin/solicitacoes/{id}/aprovar` · `…/recusar` | Aprovadores do escopo; **nunca** o solicitante | 15 min |
| Quatro olhos | `POST /api/admin/mudancas` · `POST /api/admin/mudancas/{id}/aprovar` · `…/recusar` | Conforme o tipo; aprovador ≠ solicitante | 15 min + passkey |
| Dispositivos e tokens | `GET /api/admin/dispositivos` · `DELETE /api/admin/dispositivos/{id}` · `POST /api/admin/dispositivos/revogar-em-massa` · `GET/DELETE /api/admin/tokens` | admin-identidade, super-admin | 15 min |
| Catálogo | `GET /api/admin/catalogo` · `GET /api/admin/catalogo/{skill}` · `GET /api/admin/catalogo/{skill}/historico` · `GET /api/admin/catalogo/{skill}/comparar?de=&para=` · `GET /api/admin/catalogo/{skill}/uso` · `POST /api/admin/catalogo/{skill}/pr` (`promover`, `rollback`, `depreciar`, `retirar`) | Leitura: papéis administrativos; PR: admin-catalogo | 15 min |
| Histórico geral | `GET /api/admin/catalogo/historico?tipo=&de=&ate=` | Papéis administrativos | 15 min |
| Consumo | `GET /api/admin/consumo/visao` · `…/ranking` · `…/detalhe` · `…/anomalias` · `GET /api/admin/consumo/export` | admin-catalogo, admin-identidade, auditor, super-admin; gestor (o seu squad) | 15 min |
| Cotas | `GET /api/admin/cotas` · `PUT /api/admin/cotas/perfis` · `POST /api/admin/cotas/excecoes` · `DELETE /api/admin/cotas/excecoes/{id}` | admin-catalogo, super-admin | 15 min |
| Conhecimento | `GET /api/admin/conhecimento/propostas` · `POST …/{id}/aprovar` (abre PR) · `…/ajustar` · `…/recusar` · `GET /api/admin/conhecimento/lacunas` | curador (a sua coleção e projeto), super-admin | 15 min |
| Segurança | `GET /api/admin/seguranca/alertas` · `PATCH …/{id}` · `POST /api/admin/seguranca/revogacao-global` | admin-identidade (sem a global), super-admin | 15 min + passkey |
| Auditoria | `GET /api/admin/auditoria?…` · `GET /api/admin/auditoria/export` | auditor, super-admin; recortes por papel | 15 min |
| Saúde | `GET /api/admin/saude` | Papéis administrativos | 15 min |
| Configurações | `GET /api/admin/configuracoes` · `POST /api/admin/mudancas` (tipo `configuracao`) | super-admin (quatro olhos); auditor (leitura) | 15 min + passkey |

## 4. Dados novos ou detalhados para o portal (Firestore)
```
mcp_tools/{versao_servidor}       nome, descricao, quando_usar, entrada_schema, exemplo   (gravado pelo odin-mcp ao iniciar)
catalog_events/{id}               evento do ciclo de vida (07, seção 2)
quotas/{pessoaId}/{dia}           requisicoes (contador atômico), limite, origem_do_limite
quota_rules/{id}                  alvo (perfil|squad|pessoa), limite_minuto, limite_dia, prazo?, motivo, criadoPor
notifications/{pessoaId}/{id}     tipo, texto, link, lida, criadaEm
policy_versions/{n}               matriz perfil × skill × coleção, autor, quando, motivo
review_campaigns/{id}             revisão trimestral: escopo, itens, status
```

## 5. Integrações e permissões novas
- **`odin-mcp` grava `mcp_tools`** ao iniciar uma versão nova: o guia do portal reflete sempre as ferramentas reais, sem chamada entre serviços.
- **`sa-portal`** passa a precisar de `bigquery.jobUser` e `dataViewer` também em `odin_metrics` (consumo), além do conjunto de auditoria.
- **GitHub App:** para abrir PRs de catálogo pelo portal, precisa de `contents: write` e `pull_requests: write` no repositório Odin. O app cria só branches `portal/*`; o merge é do mantenedor (único com escrita, GitHub Free), com o CI verde. Atualizar a tabela de permissões da [arquitetura técnica, seção 7.2](../arquitetura/03-arquitetura-tecnica.md).
- **`odin-publisher`** (job que confere a assinatura do manifesto) grava os eventos `skill_incorporada`, `versao_publicada`, `versao_promovida`, `rollback`, `depreciada`, `retirada` e `metadados_alterados`; o portal grava `perfil_alterado`; o runbook RB-09 grava `versao_proibida`.
