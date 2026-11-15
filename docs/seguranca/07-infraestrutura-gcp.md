# 07. Infraestrutura e rede no Google Cloud

> [Índice da segurança](README.md) · Inventário completo em [03 Técnica](../arquitetura/03-arquitetura-tecnica.md)

## 1. Projeto e organização
- **Um projeto por ambiente** (`odin-poc`, depois `odin-prod`), cada um num **estágio de custo** (E0, E1 ou E2; [arquitetura 05](../arquitetura/05-custos-e-finops.md)). Os controles desta página valem em todos os estágios, salvo quando a linha diz o estágio.
- **Produção numa organização GCP**, com estas políticas de organização:
  - `iam.disableServiceAccountKeyCreation` (nenhuma chave de conta de serviço);
  - `iam.allowedPolicyMemberDomains` (só identidades da empresa);
  - `storage.publicAccessPrevention`;
  - `storage.uniformBucketLevelAccess`;
  - `sql.restrictPublicIp`;
  - `run.allowedIngress` (só interno e Load Balancer), em E2;
  - `gcp.resourceLocations` (só `southamerica-east1`);
  - `compute.requireOsLogin`.
- **Projeto pessoal (prova de conceito):** sem organização não há políticas de organização nem VPC Service Controls. As mesmas regras são aplicadas **pelo Terraform** e verificadas por um teste de conformidade no CI.

## 2. IAM: pessoas
| Papel no Google Cloud | Quem | Como |
|---|---|---|
| Proprietário do projeto | Ninguém no dia a dia; 2 contas de emergência | Uso só por runbook, com alerta |
| Operação | Mantenedores | Papéis específicos (`run.viewer`, `logging.viewer`, `monitoring.viewer`); elevação temporária (acesso com prazo) para mudanças fora do Terraform |
| Auditoria | Auditor | `logging.viewer`, `bigquery.dataViewer` no conjunto de auditoria |
| MFA | Todas as contas Google com acesso ao projeto | 2FA obrigatório (passkey ou chave física para as de emergência) |

## 3. IAM: contas de serviço
Uma por componente, **sem chaves exportadas**, com papéis mínimos (tabela da [arquitetura técnica, seção 3](../arquitetura/03-arquitetura-tecnica.md)). Regras adicionais:
- Papéis concedidos **no recurso** (bucket, chave KMS, segredo, tópico) e não no projeto, sempre que o serviço permitir.
- Condições do IAM onde couber (por exemplo, `sa-ci-signer` só na versão ativa da chave).
- Revisão trimestral com o Recomendador de IAM (remover permissões não usadas).

## 4. Rede
| Controle | Configuração |
|---|---|
| Borda | E0 e E1: `run.app` com TLS gerenciado (≥ 1.2). E2: HTTPS Load Balancer externo com certificado gerenciado |
| Ingress do Cloud Run | E0 e E1: público nos três serviços (`odin-mcp`, `odin-sts`, `odin-portal`), com autenticação, limites no serviço e teto de 3 instâncias. E2: "interno e Cloud Load Balancing" (o `run.app` direto fica bloqueado). Jobs não têm porta |
| Superfície anônima | Só as rotas listadas na [arquitetura técnica, seção 2](../arquitetura/03-arquitetura-tecnica.md), com limite por IP; teste automatizado garante que nenhuma outra rota responde sem token |
| Cloud SQL (quando houver) | **Só IP privado**; conexão por saída direta para VPC; TLS obrigatório; autenticação IAM |
| Saída | Sem Cloud NAT e sem conector de VPC em E0 e E1; saída direta para VPC só para o Cloud SQL |
| VPC Service Controls (E2, com organização) | Perímetro com Firestore, Cloud SQL, Cloud Storage, KMS, Secret Manager e BigQuery |

## 4.1 Teto e disjuntor de custo
Custo inesperado é sinal de abuso e, numa conta pessoal, também é dano. Controles (detalhe em [arquitetura 05](../arquitetura/05-custos-e-finops.md), seção 5):
- `max` de 3 instâncias por serviço em E0 e E1;
- orçamento com alertas em 50%, 90%, 100%, 200% e 300%;
- **disjuntor:** a 300%, a função `odin-disjuntor` muda o ingress dos três serviços para interno. Nada é apagado; o time segue pelo modo degradado; a volta é pelo runbook [RB-13](11-runbooks.md);
- a conta `sa-disjuntor` só pode atualizar esses três serviços.

## 5. Cloud Armor (política `odin-edge-policy`, só no estágio E2)
Em E0 e E1 os limites das prioridades 300 e 400 são aplicados **no próprio serviço** (por IP e por pessoa).

| Prioridade | Regra | Ação |
|---|---|---|
| 100 | Faixas de IP do GitHub em `hooks.` (lista atualizada por job) | Permitir; o resto de `hooks.` é negado |
| 200 | Regras pré-configuradas OWASP (sqli, xss, lfi, rfi, rce, scannerdetection, protocolattack, sessionfixation) | Negar (403) |
| 300 | `auth.` `/oauth/*` e `odin.` `/ativar`, `/sessao`: 30 req/min por IP | Limitar (429) com banimento de 10 min ao exceder 3 vezes |
| 400 | `mcp.`: 300 req/min por IP | Limitar (429) |
| 500 | Países fora da lista (opcional, por configuração) | Negar |
| 1000 | Padrão | Permitir (a autenticação acontece nos serviços) |
Começa em modo de **pré-visualização** (só registra) por uma semana, depois em bloqueio.

## 6. Criptografia
- **Em trânsito:** TLS em toda conexão externa e interna (Google Front End, Cloud SQL com TLS obrigatório).
- **Em repouso:** criptografia padrão do Google em tudo. **CMEK** (chave `cmek`, rotação de 90 dias) em buckets e Cloud SQL só em E2, por exigência contratual. [VERIFICAR] CMEK no Firestore na região (precisa ser definido na criação do banco).
- **Campos sensíveis:** segredos TOTP cifrados por envelope (KMS, chave `campos`) antes de ir ao Firestore, em todos os estágios; refresh tokens e tokens pessoais só como HMAC.

## 7. Segredos
- Só no **Secret Manager**, com acesso por segredo (não por projeto), versões e rotação (calendário em [03, seção 6](03-tokens-sessoes-e-chaves.md)).
- Montados como variáveis apenas no serviço que precisa, por referência de versão (não `latest` em produção).
- Nunca em Terraform, imagens, repositórios ou logs.

## 8. Logs de auditoria do Google Cloud
- **Atividade administrativa:** ligada por padrão (não desligável).
- **Acesso a dados:** **ligar** para Cloud KMS, Secret Manager e IAM (e Cloud SQL Admin, quando houver). No Firestore, só leitura administrativa: o registro de cada leitura de dados encheria o Logging sem ganho, porque a aplicação já audita cada ação.
- **Exclusões:** logs das verificações de saúde não são gravados.
- Coletor `odin-audit-sink` para o BigQuery, com **trava de retenção** no bucket de arquivo de logs a partir do E1.
- Alertas sobre os próprios logs: mudança de IAM, de ingress ou de teto de instâncias dos serviços, do coletor de logs e de chaves KMS (e de política de Cloud Armor, em E2); uso de conta de emergência; criação de chave de conta de serviço (deve ser zero).

## 9. Postura e conformidade contínua
- Security Command Center (nível padrão): achados de configuração com revisão semanal.
- Teste de conformidade no CI de infraestrutura, por exemplo: nenhum bucket público, nenhum IP público no Cloud SQL, nenhum papel `owner` ou `editor` para contas de serviço, ingress dos serviços conforme a tabela, logs de acesso a dados ligados.
- Orçamento com alertas e disjuntor (seção 4.1).
- **Conformidade de custo** no CI: CF-11 a CF-14 (`scripts/conformidade.mjs`).
