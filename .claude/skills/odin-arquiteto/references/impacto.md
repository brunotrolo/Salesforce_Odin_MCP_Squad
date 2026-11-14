# Mapa de impacto: onde cada mudança aparece

| Tipo de mudança | Documentos a atualizar juntos |
|---|---|
| Método de autenticação, MFA, sessão | segurança 02 e 03; arquitetura 03 §5; portal 03, 04 e 09; plano 5; funcional RN e RF; segurança 10 (controles) |
| TTL, revogação, refresh, chaves | segurança 03 e 11; arquitetura 03 §5 e §8.2; plano 5; portal 04 (guia); conformidade CF-05 |
| Perfis, papéis, quatro olhos | segurança 04; funcional §4; portal 02, 05 e 09; plano 6 |
| Ferramentas MCP, limites, gatilho | plano 7.6 e 10; arquitetura 03 §6; portal 04 e 09; conformidade CF-06 |
| Catálogo, `odin.yaml`, publicação, ciclo de vida | plano 8 e 22; portal 07; segurança 05; skill odin-curador |
| Runtime, guard, políticas, isolamento | plano 7 e 22; segurança 06; conformidade CF-09 |
| Conhecimento (RAG) | plano 11; arquitetura 03 §4.3; segurança 08; portal 05 (curadoria); decisões 7, 18 a 20 |
| Infraestrutura, rede, IAM, custo | arquitetura 01 §8, 03 §1-3, §13 e §14; segurança 07; plano 14; conformidade CF-01 a CF-04 |
| Pipeline, CI/CD, GitHub | arquitetura 03 §7; segurança 05; skill odin-dev (cicd-e-gcp); conformidade CF-10 |
| Consumo e cotas | portal 06; arquitetura 03 §6.1; plano 13 |
| Operação, detecções, runbooks | segurança 09 e 11; plano 16 (F8); skill odin-operacao |
| Fases, portões, estimativa | plano 16, 16.1 e 23; ESTADO; skill odin-dev (fases) |
| Qualquer decisão do mantenedor | `docs/DECISOES.md` (nova decisão numerada ou ADR) |

Sempre: `docs/PLANO.md` seção 20 (linha de revisão), `docs/ESTADO.md`, índice de `docs/adr/README.md`.
