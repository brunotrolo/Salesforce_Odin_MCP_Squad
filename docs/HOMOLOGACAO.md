# Homologação na nuvem

**Data:** 2026-11-16 · **Projeto:** `salesforcemcpodin` (E0, `southamerica-east1`) · **Resultado: 20/20** · Execução `homologar.yml` #2 (commit `2a7dcd0`) · [ADR 0021](adr/0021-implementacoes-de-nuvem-servicos-no-cloud-run-e-homologacao.md)

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
| H20 | Limpeza dos dados de teste | ✓ |

## Controles de custo e privacidade observados
- Orçamento `salesforcemcpodin-budget` de R$ 30 ativo (há também dois alertas antigos da conta).
- Serviços: mínimo 0, máximo 3 instâncias (disjuntor máximo 1). O ingress dos serviços é `all`: STS e MCP são públicos por desenho (autenticam por token); o disjuntor exige identidade.
- Auditoria no Cloud Logging com 15 tipos de evento; **0** registros com o texto do pedido.

## Rodada anterior (16/20) e correções
| Achado | Causa | Correção |
|---|---|---|
| H01 | `/healthz` interceptado pelo Cloud Run | `/saude` |
| H14/H18 | dispositivo ativado depois da última leitura do cache de direitos | recarga única antes de negar; teste de regressão |
| H16 | credencial federada sem token de identidade | `generateIdToken` pela API do IAM |
| Custos | formato de projeção do gcloud | `--format=json` com `jq` |

## Fora do escopo desta homologação (pendente)
Skills reais publicadas na nuvem (repositórios privados), portal e login GitHub, medição de partida a frio (p95 ≤ 3 s) e carga de 50 usuários, teste do disjuntor com custo real, Windows e VS Code reais pelo mantenedor, redução do papel de `sa-ci-infra`.
