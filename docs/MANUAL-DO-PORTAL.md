# Manual do portal (versão interina)

Endereço: `https://odin-sts-177809673592.southamerica-east1.run.app` (o portal usa o mesmo endereço do emissor de tokens). Decisão: [ADR 0023](adr/0023-portal-interino-de-administracao-e-de-pessoa-no-servico-do-e.md). Resultado da homologação: [HOMOLOGACAO.md](HOMOLOGACAO.md).

## Entrar com GitHub (recomendado)
Na página inicial ou em `/admin`, clique em **Entrar com GitHub** e autorize o app `Odin` (só lê o seu perfil público). Quem tem o perfil `mantenedor` entra como administrador; as demais pessoas entram em **Minha conta**. A sua conta GitHub precisa estar cadastrada: o administrador cria a pessoa com o **login do GitHub** dela. Ative a verificação em duas etapas na sua conta do GitHub; o Odin não consegue conferir isso.

## Administrador
1. (Acesso de emergência) Abra `/admin` e digite o **segredo de administração**. Ele fica no Secret Manager (`odin-ativacao-admin`, projeto `salesforcemcpodin`); a conta do Google Cloud do mantenedor pode lê-lo em *Segurança → Secret Manager*. A sessão dura 2 horas.
2. **Pessoas → Nova pessoa**: informe nome, squad e perfil. A tela mostra o **link de convite** uma única vez (vale 72 horas e só pode ser usado uma vez). Envie o link à pessoa.
3. **Pessoas**: *Convite* gera outro link; *Suspender* derruba todos os dispositivos da pessoa; *Reativar* devolve o acesso.
4. **Dispositivos**: revoga qualquer dispositivo. A revogação vale em até cerca de 30 segundos.
5. **Skills**: mostra cada skill do catálogo, as versões nos canais beta e stable e quais perfis têm acesso.
6. **Propostas**: conhecimento sugerido pelas skills. *Aprovar* grava o texto na base consultada pelo MCP; *Rejeitar* descarta.
7. **Painel → Revogação global**: emergência. Todos precisam ativar o dispositivo de novo.

## Pessoa
1. Entre com GitHub (se o administrador cadastrou o seu login) ou abra o link de convite recebido e clique em **Entrar**.
2. No terminal, rode `odin setup`. Aparece um código no formato `ABCD-EFGH`.
3. Na página **Minha conta**, digite o código em **Ativar um dispositivo**.
4. A página mostra seus perfis e skills (com canal e versão) e seus dispositivos; você pode revogar os seus.

## Limites desta versão
- Há um único segredo de administração (sem MFA nem passkey). Rotação: gerar uma nova versão do segredo `odin-ativacao-admin` e reiniciar o serviço.
- Quem perde o convite precisa que um administrador gere outro.
- O segundo fator é o da conta do GitHub (o Odin não verifica); o segredo de administração é só acesso de emergência.
