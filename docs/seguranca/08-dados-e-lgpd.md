# 08. Proteção de dados e LGPD

> [Índice da segurança](README.md)

## 1. Classificação

| Classe | Exemplos | Regras |
|---|---|---|
| **Pública** | README do Odin, documentação geral | Sem restrição |
| **Interna** | Skills, agentes, padrões técnicos globais, métricas agregadas | Acesso por perfil; repositórios podem ser públicos só por decisão explícita |
| **Confidencial** | Regras de negócio e decisões de clientes (`negocio`), conhecimento por projeto, auditoria | Repositório privado, CMEK, segurança em nível de linha por projeto, acesso mínimo |
| **Restrita** | Credenciais, chaves, segredos TOTP | Nunca em claro fora do cofre, KMS ou Secret Manager; nunca em log |

**Proibido em qualquer lugar do Odin:** segredos de clientes, credenciais Salesforce, dados pessoais de clientes finais e alias de org. As skills já seguem essa regra; o pipeline verifica.

## 2. Inventário de dados pessoais (titulares: pessoas do time)

| Dado | Onde | Finalidade | Base legal (a validar com o jurídico) | Retenção |
|---|---|---|---|---|
| Id e login do GitHub, nome | Firestore `users` | Identificação e autorização | Execução de contrato / legítimo interesse | Enquanto ativo + 90 dias |
| E-mail (opcional, do GitHub) | Firestore `users` | Avisos de segurança | Legítimo interesse | Idem |
| IP, agente e local aproximado dos dispositivos | Firestore `devices`, auditoria | Segurança (detecção de abuso) | Legítimo interesse | Dispositivo: até revogar + 90 dias; auditoria: 1 ano |
| Fatores de MFA (chave pública da passkey, segredo TOTP cifrado) | Firestore | Autenticação | Execução de contrato | Enquanto ativo |
| Registro de chamadas (sem conteúdo) | BigQuery | Auditoria e métricas | Legítimo interesse, obrigação de segurança | 1 ano |
| Propostas de conhecimento (autoria) | Firestore, GitHub | Curadoria | Legítimo interesse | Vida do conhecimento |

**O que não é coletado:** o texto dos pedidos feitos ao Claude Code, o código dos projetos e as respostas do modelo. O Odin só vê as chamadas às suas próprias ferramentas.

## 3. Minimização
- Escopos mínimos no GitHub (`read:user`, `user:email`; `read:org` só com organização).
- Auditoria guarda ação, alvo e resultado, **não** o pedido. Amostragem de conteúdo para melhorar o roteamento só se habilitada, com máscara de PII e retenção de 30 dias.
- Local aproximado do IP calculado na hora e guardado só no nível de cidade ou país.

## 4. Direitos do titular
| Direito | Como atender |
|---|---|
| Acesso | **Meu uso** no portal + exportação dos próprios dados (JSON) |
| Correção | Nome e e-mail vêm do GitHub; correção lá ou pelo admin-identidade |
| Eliminação | Ao sair: dados de identidade apagados após 90 dias; auditoria **pseudonimizada** (id trocado por hash com pimenta), porque a trilha precisa permanecer íntegra para segurança |
| Portabilidade | Exportação JSON |
| Informação | Termos de uso e aviso de privacidade no portal (fase F10 do plano) |

## 5. Dados de clientes no conhecimento (RAG)
- Cada item tem `projeto` e `sensibilidade`. O `confidencial` só fica em repositório **privado**.
- **Isolamento por projeto em duas camadas** (aplicação e banco, [04](04-autorizacao.md)), com teste automatizado. **Na PoC (Firestore) só a camada da aplicação**: por isso nenhum conhecimento confidencial entra antes da migração para o Cloud SQL.
- **Máscara de PII** na ingestão: documentos, e-mails, telefones e nomes de pessoas (reaproveitando o `pii.mjs` das skills), além de rejeitar texto com instrução dirigida a agentes.
- **Fim de contrato com um cliente:** comando de expurgo do projeto que apaga os trechos do banco, os snapshots e as coleções, mantendo só o registro de que o expurgo aconteceu.
- Embeddings também são dados do cliente: ficam sob as mesmas regras.

## 6. Residência e transferência
- Dados e serviços em **`southamerica-east1`**.
- Exceções a confirmar: o Identity Platform é um serviço global [VERIFICAR onde guarda os dados das contas]; o GitHub fica nos Estados Unidos (já usado hoje pelo time para o código); o Vertex AI deve ser configurado para a região [VERIFICAR o modelo de embeddings disponível na região].
- A inferência de modelos segue pelo LiteLLM, fora do Odin, com as regras atuais do time.

## 7. Retenção (resumo)
| Item | Retenção |
|---|---|
| Auditoria | 365 dias (configurável; trava de retenção em produção) |
| Pacotes publicados | 365 dias por versão |
| Snapshots do conhecimento | 180 dias |
| Dispositivos revogados | 90 dias |
| Pessoas que saíram | 90 dias, depois pseudonimização |
| Amostras de pedidos (se habilitadas) | 30 dias |
| Backups | Firestore: PITR de 7 dias + exportações de 30 dias; Cloud SQL: 7 dias + PITR |
