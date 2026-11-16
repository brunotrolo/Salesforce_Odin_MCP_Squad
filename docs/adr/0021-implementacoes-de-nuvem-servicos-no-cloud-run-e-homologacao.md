# 0021. Implementações de nuvem, serviços no Cloud Run e homologação

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F1 a F5 (nuvem), sustentação
**Documentos afetados:** docs/PLANO.md §14 e §18; docs/DECISOES.md (decisão 1); docs/seguranca/07-infraestrutura-gcp.md §1; docs/RELATORIO-DE-PROGRESSO.md; docs/ESTADO.md

## Contexto
O mantenedor criou o projeto `salesforcemcpodin` (número 177809673592, `southamerica-east1`) e pediu implementação de nuvem ponta a ponta, testada e homologada, sem colar comandos. O projeto de referência dos documentos ainda se chamava `odin-poc`. A primeira rodada de homologação (2026-11-16) passou 16 de 20 verificações e achou quatro falhas reais: o caminho `/healthz` é reservado pelo frontend do Cloud Run (404), dispositivo ativado depois da última leitura do cache de direitos era recusado, o token de identidade do disjuntor não saía das credenciais federadas, e a consulta de custos do workflow tinha formato inválido.

## Decisão
1. O projeto do estágio E0 passa a se chamar `salesforcemcpodin`; todo documento que citava `odin-poc` é atualizado.
2. As implementações de nuvem (Firestore, Cloud Storage, KMS software, Secret Manager) ficam atrás das interfaces existentes, e STS, MCP, disjuntor e jobs rodam no Cloud Run (máx. 3 instâncias, mínimo 0). STS e MCP são públicos por `allUsers` com marcador `odin:permitir-publico`; o disjuntor é protegido por identidade (IAM + Pub/Sub OIDC).
3. A saúde dos serviços usa `/saude`; `/healthz` fica apenas como alias.
4. O resolvedor de direitos recarrega uma vez antes de negar um dispositivo que o cache não conhece (uso imediato após ativação); a revogação segue o cache de 30 s.
5. Interino até o portal existir: ativação de dispositivo por página de mantenedor protegida por segredo (`odin-ativacao-admin`, Secret Manager).
6. A homologação é o workflow `homologar.yml` (20 verificações H01 a H20, relatório em artefato), executado pela identidade federada sem chave. Só vale como homologado quando passa 20/20 na versão implantada.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Mínimo de 1 instância para evitar partida a frio | Custo contínuo; o estágio E0 aceita partida a frio (medida na homologação) |
| Manter `/healthz` | O Cloud Run o intercepta; a verificação nunca chegaria ao serviço |
| Chave de conta de serviço para o CI | Segredo versionável; a identidade federada dispensa chave |
| Cache de direitos sem recarga | Recusa o dispositivo recém-ativado até 30 s |

## Consequências
- Melhora: caminho completo comprovado na nuvem real; custo contido (orçamento R$ 30 com alertas e disjuntor).
- Piora ou risco: ativação interina por segredo (substituir pelo portal na F4); a conta `sa-ci-infra` tem papel Owner durante a construção (reduzir ao fim); skills reais ainda não publicadas na nuvem (repositórios privados exigem GitHub App).
- Testes e aceite: `homologar.yml` 20/20; 50 testes locais; CF-01 a CF-14 verdes.

## Segurança
Sem token de GitHub no Google Cloud nem chave de conta de serviço; identidade federada limitada ao mantenedor na `main`. Auditoria no Cloud Logging sem o texto dos pedidos (verificado: 0 ocorrências). O disjuntor recusa chamada sem identidade (verificado em H16). Risco residual: ativação interina (mitigada por segredo aleatório de uso único e código de uso único).

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade (scripts/conformidade.mjs), se a regra é verificável
