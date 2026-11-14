# 11. Runbooks de segurança

> [Índice da segurança](README.md) · Cada runbook é executado por duas pessoas quando indicado (👥), e toda execução é registrada na auditoria e no registro de incidentes.

## RB-01 Revogar um dispositivo
1. Portal → Pessoas → pessoa → Dispositivos → **Revogar** (motivo).
2. Conferir na auditoria `sts.device.revoke` e, em até 30 s, o próximo `401` daquele dispositivo.
3. Avisar a pessoa (o portal envia automaticamente).

## RB-02 Suspender uma pessoa (saída ou suspeita)
1. Portal → Pessoas → **Suspender** (motivo). Com organização GitHub, remover também do time ou da organização.
2. Conferir: dispositivos, tokens pessoais e sessões revogados; pertenças encerradas.
3. Revisar a auditoria dos últimos 30 dias da pessoa (em caso de suspeita).
4. Em 90 dias: o job pseudonimiza a pessoa.

## RB-03 Revogação global 👥
Quando usar: suspeita de comprometimento amplo (por exemplo, chave de JWT, base de refresh tokens).
1. Super-admin → Segurança → **Revogação global** → reautentica com passkey → motivo.
2. Segundo administrador confirma (ou, em emergência, uso da conta de emergência com alerta).
3. Conferir: novos `401` para tokens antigos; STS recusando refresh tokens anteriores ao carimbo.
4. Comunicar o time: "rode `odin login` de novo".
5. Se a chave de JWT estiver envolvida, seguir o RB-04.

## RB-04 Rotacionar a chave de JWT 👥
**Rotina semestral:**
1. Terraform: nova versão de `jwt-signing` (aplicada pelo pipeline de infraestrutura).
2. O STS publica a nova chave pública no JWKS (`kid` novo) **24 h antes** de começar a assinar com ela.
3. Trocar a chave ativa do STS (configuração versionada).
4. Depois de 24 h sem tokens com o `kid` antigo, retirar a antiga do JWKS e desabilitar a versão no KMS.

**Comprometimento:** os mesmos passos, sem as esperas, mais o RB-03.

## RB-05 Rotacionar a chave de assinatura de pacotes 👥
**Rotina anual** (cerimônia de [05](05-cadeia-de-suprimentos.md), seção 4):
1. Nova versão de `bundle-signing` no KMS.
2. Lançar o CLI com as duas chaves públicas; acompanhar a adoção pela métrica de versões do CLI.
3. Com ≥ 95% de adoção (ou prazo de 30 dias), o pipeline passa a assinar com a nova.
4. Na versão seguinte do CLI, retirar a antiga; desabilitar a versão no KMS.

**Comprometimento:**
1. Desabilitar a versão comprometida no KMS e congelar o `publish.yml`.
2. Nova chave; CLI novo que **rejeita** a chave comprometida.
3. Reassinar e republicar todas as versões vigentes.
4. Lista de versões proibidas com tudo o que foi assinado no período suspeito.
5. Comunicar: "atualize o CLI" (o `ensure` força a atualização).

## RB-06 Rotacionar segredos (GitHub App, webhook, OAuth, sessão, pimenta)
1. Gerar o novo valor na origem (GitHub App: nova chave privada; webhook: novo segredo; OAuth App: novo segredo do cliente).
2. Nova versão no Secret Manager (ou no Identity Platform, para o OAuth).
3. Implantar os serviços apontando para a versão nova.
4. Conferir o funcionamento (evento de webhook de teste, login de teste).
5. Revogar o valor antigo na origem e desabilitar a versão antiga no Secret Manager.
6. **Pimenta dos HMAC:** manter a versão anterior para validar os tokens existentes até eles vencerem (90 dias), depois desabilitar.

## RB-07 Zerar o MFA de uma pessoa 👥
1. Pedido registrado pelo admin-identidade, com o motivo.
2. Verificação de identidade fora do sistema (chamada de vídeo com o gestor do squad).
3. Segundo administrador aprova.
4. O portal zera os fatores e revoga todos os dispositivos; a pessoa cadastra os fatores de novo no próximo login.

## RB-08 Uso da conta de emergência 👥
1. Só em incidente SEV1 ou com o portal ou o Identity Platform indisponível.
2. Registrar o incidente antes do uso (ou imediatamente depois, se impossível).
3. Usar a passkey física guardada; o alerta dispara para todos os administradores.
4. Fazer só o necessário; tudo é auditado.
5. Revisão do uso por outra pessoa em até 48 h; trocar a credencial da conta de emergência depois do uso.

## RB-09 Tirar uma versão de skill de circulação
1. PR de rollback em `catalog/skills.yaml` (volta o SHA do canal); merge com revisão.
2. Se a versão for perigosa: incluí-la na **lista de versões proibidas** (assinada) para que o CLI e o guard a bloqueiem nas máquinas.
3. Conferir na telemetria a queda de uso da versão.

## RB-10 Restaurar dados
- **Firestore:** recuperação a um ponto no tempo (até 7 dias) ou importação da exportação diária, primeiro num banco de restauração para conferência e depois troca.
- **Cloud SQL:** clonar no ponto no tempo e apontar o `odin-mcp` para o clone após conferência; ou reindexar do zero pelo `odin-indexer` a partir do GitHub.
- **Pacotes:** restaurar a versão do objeto no bucket (versionamento) ou republicar pelo pipeline.
- Registrar RPO e RTO obtidos e comparar com as metas (1 h e 4 h).

## RB-11 Expurgo de um projeto (fim de contrato)
1. Pedido do responsável pelo cliente, registrado.
2. 👥 Aprovação de um segundo administrador.
3. Comando de expurgo: trechos e documentos do projeto no Cloud SQL, snapshots no Cloud Storage, coleções e propostas no Firestore; arquivar o repositório de conhecimento do projeto.
4. Registro do expurgo (sem o conteúdo) na auditoria.

## RB-12 Revisão trimestral de acessos
1. O `odin-jobs` gera a lista por squad (membros e perfis) e por papel administrativo.
2. Gestores e administradores confirmam no portal em até 15 dias.
3. O que não for confirmado expira automaticamente.
4. Relatório para o auditor.
