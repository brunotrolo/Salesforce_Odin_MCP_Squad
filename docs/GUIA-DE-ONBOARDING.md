# Guia de onboarding (uma página)

Para quem vai usar as skills do time no Claude Code. Leva menos de 10 minutos e é feito **uma vez**.

## Antes de começar
- **Node 22 ou mais novo** (`node --version`).
- **Claude Code** instalado (terminal ou extensão do VS Code).
- Um **convite** de um administrador do Odin (link de uso único) ou o seu login do GitHub cadastrado.

## Passo 1: instalar
Baixe `instalador/instalar.mjs` e `chaves-publicas.json` (publicados juntos, no repositório do Odin) e rode:

```
node instalar.mjs --servidor https://odin-sts-177809673592.southamerica-east1.run.app --chaves chaves-publicas.json
```
O instalador confere a assinatura do CLI com a chave fixada; se não bater, **nada é instalado**.

## Passo 2: ativar este computador
O instalador mostra um código no formato `ABCD-EFGH`. Abra o portal (o endereço acima), entre com o GitHub (ou pelo convite), vá em **Minha conta** e digite o código em **Ativar um dispositivo**.

## Passo 3: usar
Abra uma sessão nova do Claude Code e peça o que precisa ("transformar esta transcrição em backlog", "criar a classe de teste do CaseRouter"). O Odin escolhe a skill certa e prepara tudo sozinho. Você não instala nem atualiza skills.

## No dia a dia
- `odin status`: quem você é e quais skills você tem.
- `odin update`: atualiza o CLI (o runtime das skills se atualiza sozinho no primeiro uso).
- `odin doctor`: confere a instalação e diz o que corrigir.
- `odin doctor --limpar-copias --sim`: arquiva e remove as cópias antigas de skills do projeto atual. Para desfazer em até 30 dias: `odin restore-copias`.
- `odin uninstall`: remove o Odin e devolve os seus arquivos do Claude Code como estavam.

## Se algo der errado
Rode `odin doctor` e leia a mensagem. Acesso revogado ou vencido: `odin login`. Ainda travado: fale com o suporte do time (repositório de suporte) e informe o resultado do `odin doctor`.
