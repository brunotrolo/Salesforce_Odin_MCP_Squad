# 09. Detecção e resposta a incidentes

> [Índice da segurança](README.md) · Passos operacionais em [11 Runbooks](11-runbooks.md)

## 1. Severidades

| Severidade | Definição | Exemplo | Resposta inicial |
|---|---|---|---|
| **SEV1** | Comprometimento confirmado de chave, de conta administrativa ou da cadeia de distribuição; vazamento de dado confidencial | Chave de assinatura usada fora do pipeline | Imediata (até 15 min); revogação global avaliada |
| **SEV2** | Credencial de pessoa comprometida; tentativa de elevação; skill maliciosa no canal `beta` | Reuso de refresh token detectado | Até 1 h |
| **SEV3** | Anomalia sem comprometimento confirmado | Pico de recusas de autorização | Até 1 dia útil |
| **SEV4** | Melhoria ou achado de configuração | Achado do Security Command Center | Backlog |

## 2. Catálogo de detecções

| ID | Detecção | Fonte | Sev. |
|---|---|---|---|
| DT-01 | **Reuso de refresh token** (família revogada) | `odin-sts` | SEV2 |
| DT-02 | Uso de conta de emergência | Auditoria do portal e do Google Cloud | SEV1 (até revisão) |
| DT-03 | Assinatura do KMS fora do workflow `publish.yml` | Logs de acesso a dados do KMS | SEV1 |
| DT-04 | Pacote com assinatura inválida reportado por um CLI | Telemetria do CLI | SEV1 |
| DT-05 | Mudança de IAM, de Cloud Armor, do coletor de logs ou de chave KMS fora do Terraform | Logs de atividade administrativa | SEV2 |
| DT-06 | Criação de chave de conta de serviço | Logs administrativos | SEV1 |
| DT-07 | Muitas falhas de MFA (≥ 5 em 15 min) para uma pessoa | Portal | SEV3 (SEV2 se seguidas de sucesso) |
| DT-08 | Login ou ativação de país ou rede inéditos | Portal, STS | SEV3 |
| DT-09 | Aprovação de ativação com IP muito diferente do pedido (possível phishing de device code) | STS | SEV2 |
| DT-10 | Token pessoal usado de IP novo ou após muito tempo parado | MCP | SEV3 |
| DT-11 | Token `odin_` encontrado pela varredura de segredos | GitHub, CI | SEV2 (revogação automática) |
| DT-12 | Pico de `sem_acesso` de uma pessoa (sondagem) | Auditoria | SEV3 |
| DT-13 | Consulta ao RAG fora dos projetos da pessoa (bloqueada pela política de linha) | Banco + MCP | SEV2 (indica falha da primeira camada) |
| DT-14 | Guard inativo ou desligado em uma máquina | Telemetria do CLI | SEV3 |
| DT-15 | Agente `odin-*` em pasta de projeto (sombra) | Guard, doctor | SEV3 |
| DT-16 | Publicação no catálogo sem PR aprovado | Pipeline, `odin-publisher` | SEV1 |
| DT-17 | Pico de custo no projeto GCP | Orçamento | SEV3 |
| DT-18 | Pico de 4xx/5xx ou de limites do Cloud Armor | Monitoring | SEV3 |

Alertas SEV1 e SEV2: notificação imediata (e-mail + canal de mensagens dos administradores) e registro de incidente. SEV3: painel e resumo diário.

## 3. Ciclo de resposta
1. **Detectar e registrar:** abrir o incidente (id, hora, detecção, quem responde).
2. **Conter:** revogar (dispositivo, pessoa, token, global), bloquear no Cloud Armor, desabilitar versão de chave, tirar uma versão do canal.
3. **Investigar:** auditoria no BigQuery, logs do Google Cloud, histórico do Git, telemetria do CLI.
4. **Erradicar:** remover a causa (credencial, versão, dependência, permissão).
5. **Recuperar:** reemitir, republicar, restaurar backup; acompanhar por 7 dias.
6. **Aprender:** relatório sem culpados em até 5 dias úteis; atualizar o modelo de ameaças, as detecções e os runbooks.
7. **Comunicar:** pessoas afetadas; gestores; jurídico e encarregado de dados (DPO) quando houver dado pessoal ou de cliente (LGPD: avaliar a comunicação à ANPD e aos titulares em prazo razoável, conforme a regulamentação vigente).

## 4. Playbooks

| Incidente | Conter | Erradicar e recuperar |
|---|---|---|
| **Credencial de dispositivo roubada** (DT-01, DT-09) | Família já revogada pelo STS; revogar os demais dispositivos da pessoa se houver dúvida | Pessoa reativa com MFA; investigar a máquina (malware) |
| **Conta do GitHub de uma pessoa tomada** | Suspender a pessoa no portal; revogar tudo | Pessoa recupera o GitHub, troca o MFA do Odin (com verificação de identidade) e reativa |
| **Mantenedor comprometido** (código malicioso em PR ou skill) | Tirar a versão do canal (PR de rollback), suspender o mantenedor, bloquear merges em `catalog/` | Auditar as versões publicadas, reassinar, comunicar quem usou a versão |
| **Chave de assinatura de pacotes suspeita** (DT-03, DT-04) | Desabilitar a versão da chave no KMS; congelar o pipeline | Nova chave por cerimônia; CLI novo com a chave antiga revogada; reassinar os pacotes vigentes; forçar a atualização do CLI |
| **Chave de JWT suspeita** | Revogação global | Nova versão da chave; retirar a antiga do JWKS; todos reativam |
| **Vazamento entre projetos no RAG** (DT-13) | Desligar a ferramenta de busca (manutenção) | Corrigir; reexecutar os testes de isolamento; avaliar a comunicação ao cliente |
| **Token pessoal vazado** (DT-11) | Revogação automática | Avisar a pessoa; revisar o uso no período |
| **Skill maliciosa em `beta`** | Rollback do canal; revogar os runtimes da versão (o CLI recebe a lista de versões proibidas no próximo `ensure`) | Investigar como passou na revisão |
| **Indisponibilidade** | Página de status; o runtime instalado continua para skills já em uso | Restaurar pelo runbook; RTO de 4 h |

## 5. Lista de versões proibidas
O `/v1/policies` inclui uma **lista de versões proibidas** (assinada). O CLI se recusa a rodar uma versão de runtime da lista e o guard bloqueia a skill até a atualização. É o mecanismo para "puxar o freio" de uma versão ruim já instalada.
