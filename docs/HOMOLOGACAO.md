# Homologação na nuvem

**Data:** 2026-11-16 · **Projeto:** `salesforcemcpodin` (E0, `southamerica-east1`) · **Resultado: 25/25** · Execução `homologar.yml` #4 (commit `1531c99`, com o portal); 21/21 na #3 e 20/20 na #2 · [ADR 0021](adr/0021-implementacoes-de-nuvem-servicos-no-cloud-run-e-homologacao.md)

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
| H20 | Limpeza dos dados de teste | ✓ |

## Controles de custo e privacidade observados
- Orçamento `salesforcemcpodin-budget` de R$ 30 ativo (há também dois alertas antigos da conta).
- Serviços: mínimo 0, máximo 3 instâncias (disjuntor máximo 1). O ingress dos serviços é `all`: STS e MCP são públicos por desenho (autenticam por token); o disjuntor exige identidade.
- Auditoria no Cloud Logging com 20 tipos de evento, incluindo `portal.admin_login`, `portal.convite`, `portal.dispositivo.ativar`, `portal.dispositivo.revogar` e `portal.csrf`; **0** registros com o texto do pedido.

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

## Fora do escopo desta homologação (pendente)
skills reais em `stable` (faltam as avaliações por skill), login com GitHub e segundo fator (o portal interino está homologado; falta o OAuth App), teste do disjuntor com custo real, Windows e VS Code reais pelo mantenedor, redução do papel de `sa-ci-infra`.
