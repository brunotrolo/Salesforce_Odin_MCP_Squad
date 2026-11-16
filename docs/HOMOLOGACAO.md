# Homologação na nuvem

**Data:** 2026-11-16 · **Projeto:** `salesforcemcpodin` (E0, `southamerica-east1`) · **Resultado: 26/26** · Execução `homologar.yml` #6 (commit `e54d8ea`, com o login GitHub e as 10 skills); 25/25 na #4 (portal), 21/21 na #3 e 20/20 na #2 · [ADR 0021](adr/0021-implementacoes-de-nuvem-servicos-no-cloud-run-e-homologacao.md)

| # | Verificação | Resultado |
|---|---|---|
| H01 | Serviços no ar e primeira chamada com escala a zero; disjuntor protegido | ✓ |
| H02 | Descoberta e chaves públicas (JWKS) do KMS | ✓ |
| H03 | Rotas sem token recusadas; GET no MCP = 405 | ✓ |
| H04 | Semente: 10 skills, 5 perfis, mantenedor (idempotente) | ✓ |
| H05 | Publicação: lint, pacote, assinatura no KMS, promoção | ✓ |
| H06 | Publicação adulterada recusada (manifesto, pacote, chave de outra origem) | ✓ |
| H07 | Ativação de dispositivo: segredo errado recusado, certo aprova | ✓ |
| H08 | MCP real: 7 ferramentas, atalhos do perfil, roteamento, skill entregue, negada fora do perfil | ✓ |
| H09 | Conhecimento com citação, isolamento por projeto, filtro de injeção | ✓ |
| H10 | `odin ensure` por URL assinada do Cloud Storage | ✓ |
| H11 | Integridade no uso: adulteração detectada e reinstalada | ✓ |
| H12 | Guard: bloqueia produção, credenciais, histórico remoto, pasta do Odin | ✓ |
| H13 | Renovação rotativa com prova de posse; reuso derruba a família | ✓ |
| H14 | Token inválido recusado de verdade (audiência, vencido, adulterado) | ✓ |
| H15 | Modo degradado com servidor fora | ✓ |
| H16 | Disjuntor protegido; abaixo de 300% não age; simulação a 316% não fecha nada | ✓ |
| H17 | Job `odin-jobs` no Cloud Run registra o tick | ✓ |
| H18 | Revogação efetiva em 18 s (cache de 30 s) e sem renovar | ✓ |
| H19 | Desinstalação devolve o Claude Code ao que era | ✓ |
| H21 | Skills reais publicadas (as 10, com o Data Architect): assinatura do KMS, hashes dos pacotes e passo `odin ensure` conferidos ([ADR 0022](adr/0022-publicacao-das-skills-reais-na-nuvem-sem-github-app.md)) | ✓ |
| H22 | Portal admin: entrada só com o segredo, cookie `HttpOnly` + `Secure` + `SameSite=Strict`, CSP, POST sem CSRF recusado, dados de admin ocultos sem sessão ([ADR 0023](adr/0023-portal-interino-de-administracao-e-de-pessoa-no-servico-do-e.md)) | ✓ |
| H23 | Portal admin: cria pessoa (nome escapado) e convite de uso único; a pessoa entra pelo convite; reuso e convite inventado recusados; pessoa não vê a administração | ✓ |
| H24 | Portal pessoa + CLI: ativa o dispositivo digitando o código do `odin setup` na página, o token funciona no MCP, a pessoa revoga o próprio dispositivo (não o de outra pessoa) e o token cai | ✓ |
| H25 | Portal admin: catálogo com as versões publicadas, proposta aprovada vira conhecimento, suspensão derruba a conta, revogação global gravada | ✓ |
| H26 | Login com GitHub: o portal redireciona ao OAuth App certo (client id, `redirect_uri` e escopo `read:user`), estado e cookie protegidos, callback sem estado válido recusado, o GitHub reconhece o app e aceita o segredo guardado no Secret Manager ([ADR 0024](adr/0024-login-do-portal-com-github-oauth-app.md)) | ✓ |
| H20 | Limpeza dos dados de teste | ✓ |

## Controles de custo e privacidade observados
- Orçamento `salesforcemcpodin-budget` de R$ 30 ativo (há também dois alertas antigos da conta).
- Serviços: mínimo 0, máximo 3 instâncias (disjuntor máximo 1). O ingress dos serviços é `all`: STS e MCP são públicos por desenho (autenticam por token); o disjuntor exige identidade.
- Auditoria no Cloud Logging com 20 tipos de evento, incluindo `portal.admin_login`, `portal.convite`, `portal.dispositivo.ativar`, `portal.dispositivo.revogar` e `portal.csrf`; **0** registros com o texto do pedido.

## Endurecimento (ADR 0025)
- **Sem Owner:** `sa-ci-infra` só tem os papéis mínimos do ADR 0025; `infra.yml` (apply) e `homologar.yml` (26/26) passaram sem o Owner.
- **Disjuntor real** (`disjuntor-real.yml`, execução #2): aviso de 316% fechou STS e MCP para a internet (`ingress=internal`), o disjuntor recusou chamada sem identidade, e os dois serviços foram reabertos (`ingress=all`).
- **Avaliações das skills:** as 10 skills têm 10 a 13 casos determinísticos com 100% de acerto.

## Desempenho (workflow `desempenho.yml`, execução #1)
- **Partida a frio** (primeira chamada após uma revisão nova, sem instância ativa; 3 medições em cada serviço): STS 394, 317 e 168 ms; MCP 330, 309 e 165 ms. **p95 = 394 ms** (meta ≤ 3000 ms).
- **Carga de 50 usuários simultâneos** (300 chamadas): 226 chamadas/s, p50 141 ms, **p95 322 ms**, máximo 588 ms, **0 erros** (meta p95 ≤ 2000 ms).
- **Carga autenticada** (execução #2; 50 usuários, 300 chamadas a `/v1/me` com token assinado pelo KMS e direitos lidos do Firestore): 123 chamadas/s, p50 198 ms, **p95 1259 ms**, máximo 1433 ms, **0 erros** (meta ≤ 2000 ms). A primeira leitura de cada usuário vai ao Firestore, o que explica a cauda; as seguintes usam o cache de 30 s.
- Na mesma execução, partida a frio p95 306 ms e carga sem login p95 409 ms.

## Rodada anterior (16/20) e correções
| Achado | Causa | Correção |
|---|---|---|
| H01 | `/healthz` interceptado pelo Cloud Run | `/saude` |
| H14/H18 | dispositivo ativado depois da última leitura do cache de direitos | recarga única antes de negar; teste de regressão |
| H16 | credencial federada sem token de identidade | `generateIdToken` pela API do IAM |
| Custos | formato de projeção do gcloud | `--format=json` com `jq` |

## Rodada final (31/31): F2, F3, F5, F6, F7, F8
Pipeline completo do commit `910dff6` (16/11/2026): qualidade, Terraform, publicação, homologação **31/31** e desempenho, todos verdes.
| Verificação | O que provou |
|---|---|
| H27 | as 10 skills em `stable`, versão assinada, avaliação registrada (nota ≥ 90 em ≥ 10 casos) e evento de promoção |
| H28 | nova versão em stable chega ao MCP (1 s), rollback efetivo em ~30 s e skill real entregue |
| H29 | CLI 0.2.0 assinado pelo KMS, `odin update` confere assinatura e hashes e o CLI instalado roda |
| H30 | embeddings da Vertex AI: recall@5 ≥ 80% (total e por coleção), perguntas fora do assunto recusadas, isolamento por projeto |
| H31 | segundo fator no portal real: sessão nova exige o fator, TOTP sem repetição, código de recuperação de uso único, passkey (WebAuthn com autenticador de software), reset pelo admin |
Achados e correções desta rodada: H28 reativa um dispositivo depois da revogação do H24; trecho sem embedding passou a valer pela nota lexical (H09); piso de similaridade 0,6 calibrado com as notas reais (respostas certas 0,67 a 0,86; fora do assunto ≤ 0,56); `terraform fmt` do módulo de observabilidade.

## Fora do escopo desta homologação (pendente)
Windows e VS Code reais, cadastro do 2º fator com a passkey do seu navegador e F0, F9 e F10 (você); avaliações com modelo e checklist do `odin-curador` na F6; canal de e-mail dos alertas; repositório `odin-knowledge`.
