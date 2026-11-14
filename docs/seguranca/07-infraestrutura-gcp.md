# 07. Infraestrutura e rede no Google Cloud

> [Índice da segurança](README.md) · Inventário completo em [03 Técnica](../arquitetura/03-arquitetura-tecnica.md)

## 1. Projeto e organização
- **Um projeto por ambiente** (`odin-poc`, depois `odin-prod`).
- **Produção numa organização GCP**, com estas políticas de organização:
  - `iam.disableServiceAccountKeyCreation` (nenhuma chave de conta de serviço);
  - `iam.allowedPolicyMemberDomains` (só identidades da empresa);
  - `storage.publicAccessPrevention`;
  - `storage.uniformBucketLevelAccess`;
  - `sql.restrictPublicIp`;
  - `run.allowedIngress` (só interno e Load Balancer);
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
| Borda | HTTPS Load Balancer externo, certificado gerenciado, TLS ≥ 1.2 com política moderna |
| Ingress do Cloud Run | Serviços públicos: "interno e Cloud Load Balancing" (o `run.app` direto fica bloqueado em produção); serviços internos: "interno" + IAM |
| Cloud SQL | **Só IP privado**; sem IP público; conexão por saída direta para VPC; TLS obrigatório; autenticação IAM |
| Saída | Serviços sem necessidade de internet ficam com saída só para a VPC; Cloud NAT só para quem precisa (GitHub, Vertex) |
| VPC Service Controls (produção, com organização) | Perímetro com Firestore, Cloud SQL, Cloud Storage, KMS, Secret Manager e BigQuery; nenhum acesso aos dados de fora do perímetro |

## 5. Cloud Armor (política `odin-edge-policy`)
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
- **Em repouso:** padrão do Google em tudo, mais **CMEK** (chave `cmek`, rotação de 90 dias) no bucket de pacotes, no bucket de snapshots do conhecimento e no Cloud SQL. [VERIFICAR] CMEK no Firestore na região.
- **Campos sensíveis:** segredos TOTP cifrados por envelope (KMS) antes de ir ao Firestore; refresh tokens e tokens pessoais só como HMAC.

## 7. Segredos
- Só no **Secret Manager**, com acesso por segredo (não por projeto), versões e rotação (calendário em [03, seção 6](03-tokens-sessoes-e-chaves.md)).
- Montados como variáveis apenas no serviço que precisa, por referência de versão (não `latest` em produção).
- Nunca em Terraform, imagens, repositórios ou logs.

## 8. Logs de auditoria do Google Cloud
- **Atividade administrativa:** ligada por padrão (não desligável).
- **Acesso a dados:** **ligar** para Cloud KMS, Secret Manager, IAM, Cloud SQL Admin e Firestore (leitura administrativa).
- Coletor `odin-audit-sink` para o BigQuery, com **trava de retenção** no bucket de arquivo de logs em produção.
- Alertas sobre os próprios logs: mudança de IAM, de política de Cloud Armor, do coletor de logs e de chaves KMS; uso de conta de emergência; criação de chave de conta de serviço (deve ser zero).

## 9. Postura e conformidade contínua
- Security Command Center (nível padrão): achados de configuração com revisão semanal.
- Teste de conformidade no CI de infraestrutura, por exemplo: nenhum bucket público, nenhum IP público no Cloud SQL, nenhum papel `owner` ou `editor` para contas de serviço, ingress dos serviços conforme a tabela, logs de acesso a dados ligados.
- Orçamento com alertas (custo inesperado também é sinal de abuso).
