# 04. Guia do MCP para o usuário

> [Índice do portal](README.md) · Este é o conteúdo da página **Guia do MCP** (`/guia`). A lista de ferramentas é gerada a partir dos metadados do próprio servidor; o texto abaixo é a referência funcional.

## 1. O que é o MCP Odin
O Odin é um **servidor MCP** que o seu Claude Code usa para encontrar e carregar as **skills** da empresa (Discovery, Designer, Developer, Data Architect, Test Automator e as que vierem). Você **não precisa chamar as ferramentas**: basta pedir em linguagem natural ("quero detalhar o discovery da R02"). O Claude Code consulta o Odin, que:
1. confere quem você é e o que você pode usar;
2. escolhe a skill certa;
3. entrega a versão aprovada mais recente;
4. garante que os scripts e as proteções da sua máquina estão atualizados;
5. traz conhecimento do seu projeto com a fonte citada.

O trabalho continua **na sua máquina**: o Odin não vê o seu código nem o que você escreve para o Claude Code. Ele só registra as chamadas às próprias ferramentas.

## 2. Como conectar

### 2.1 Caminho normal (recomendado)
1. Tenha o **Claude Code** (terminal ou extensão do VS Code).
2. Instale o CLI do Odin:
   - macOS/Linux: `curl -fsSL https://odin.<dominio>/install.sh | sh`
   - Windows (PowerShell): `irm https://odin.<dominio>/install.ps1 | iex`
3. Rode **`odin setup`**. O navegador abre em `odin.<dominio>/ativar`; entre com GitHub e o segundo fator, confira o código e confirme.
4. Rode **`odin doctor`**: tudo verde = pronto.
5. Abra o Claude Code em qualquer projeto e peça o que precisa.

**O que o `odin setup` faz:**
- registra o servidor `odin` no Claude Code, no seu escopo de usuário (vale em todos os projetos);
- instala as proteções (hook `odin-guard`) e os scripts das skills que você pode usar, em `~/.odin/`;
- **não escreve nada no seu projeto.**

### 2.2 Conferir no Claude Code
- No Claude Code, `/mcp` lista os servidores: `odin` deve aparecer **conectado**.
- Os atalhos das skills aparecem como comandos: digite `/` e procure por `odin` (por exemplo, `/odin:discovery`).

### 2.3 Alternativa sem CLI (exceção)
Para uma situação em que o CLI não pode ser instalado:
1. Portal → **Conta → Tokens pessoais → Gerar** (validade de até 90 dias).
2. `claude mcp add --transport http --scope user odin https://mcp.<dominio>/mcp --header "Authorization: Bearer <token>"`
3. Limitações: skills que precisam de scripts locais (Test Automator, validadores, geradores de documentos) **não funcionam**; o token fica guardado em texto na configuração do Claude Code; revogue quando não precisar mais.

## 3. Autenticação: como funciona para você

| O que | Como | Com que frequência você age |
|---|---|---|
| Entrar no portal | GitHub + segundo fator (autenticador ou passkey) | A cada 8 h de sessão, quando usar o portal |
| Ativar uma máquina | `odin setup` + aprovação no portal | Uma vez por máquina, e de novo a cada 90 dias |
| Usar no Claude Code | Token de 15 min renovado sozinho pelo CLI | **Nunca**: é automático |
| Se a máquina ficar 30 dias sem uso | O dispositivo é desativado | Rode `odin login` de novo |

**Segurança que você precisa saber:**
- Nunca compartilhe o código de ativação. Ninguém do suporte vai pedi-lo.
- Se aparecer uma ativação que você não pediu, clique em **Não fui eu**.
- Perdeu a máquina? Portal → **Conta → Dispositivos → Revogar**.

## 4. Ferramentas do MCP

O Claude Code chama estas ferramentas **sozinho**, conforme o seu pedido. Você também pode pedir explicitamente ("use o Odin para buscar no conhecimento...").

| Ferramenta | Para que serve | Quando é usada | Entradas principais |
|---|---|---|---|
| `odin_rotear` | Escolher a skill certa para o seu pedido | No começo de qualquer tarefa coberta pelo Odin | O pedido; os artefatos que existem no projeto |
| `odin_carregar_skill` | Carregar as instruções da skill escolhida, na versão aprovada | Logo depois do roteamento | A skill (e a subskill, se houver) |
| `odin_ler_referencia` | Ler uma referência da skill sob demanda (tabelas, modelos, regras) | Quando a skill precisa de um detalhe | Skill e caminho da referência |
| `odin_conhecimento_buscar` | Buscar conhecimento funcional, técnico, de negócio, lições ou dados, **com a fonte** | Quando a skill precisa de uma regra ou padrão | Consulta, coleções, projeto |
| `odin_conhecimento_propor` | Propor um conhecimento novo (vai para um curador) | Quando a skill identifica algo que vale guardar | Texto, coleção, projeto, fonte |
| `odin_proximo_passo` | Sugerir a próxima skill da jornada (Discovery → Designer → Developer → Test) | Ao terminar uma etapa | Artefatos presentes |
| `odin_feedback` | Avaliar a resposta do roteamento | Quando você diz que a skill escolhida não era a certa | Nota e comentário |

**Atalhos (prompts MCP):** cada skill principal tem um comando `/odin:<skill>` (por exemplo, `/odin:discovery`, `/odin:test`).
**Recursos:** você pode citar o texto de uma skill com `@odin:skill://<skill>/SKILL.md`.

## 5. Skills
A página **Guia → Skills** mostra só as skills **que você pode usar**, com descrição, exemplos de pedido, pré-requisitos, o que cada uma lê e produz, e o próximo passo. Exemplos:

| Skill | Peça assim | Precisa de |
|---|---|---|
| Discovery-to-Backlog | "Detalhe o discovery da release R02" | Node (instalado pelo CLI) |
| Journey Designer | "Crie a spec da capacidade 001 do domínio atendimento" | — |
| Journey Developer | "Implemente a spec 001" / "Crie a classe de teste do `CaseRouter`" | `sf` CLI, org sandbox |
| Data Architect | "Revise o modelo de dados do domínio atendimento" | — |
| Test Automator | "Teste a capacidade 001 na sandbox" | `sf` CLI, Playwright (o CLI instala o navegador) |

## 6. Consumo e cotas
- Cada chamada às ferramentas do Odin conta como **uma requisição**. O uso de modelo (tokens do LiteLLM) **não** é contado aqui.
- Seu perfil tem uma **cota diária** e um **limite por minuto** (para proteger o serviço). Você vê o uso em **Meu consumo**.
- Ao atingir a cota, novas chamadas recebem a mensagem "cota atingida" com a hora em que ela renova; o trabalho na sua máquina continua, só o Odin fica indisponível até a renovação. Peça aumento em **Meu consumo → Pedir aumento**.

## 7. Problemas comuns

| Você vê | O que significa | O que fazer |
|---|---|---|
| `sem_acesso` | Seu perfil não inclui essa skill ou coleção | **Solicitar acesso** |
| `revogado` ou `401` contínuo | Seu dispositivo foi revogado ou ficou 30 dias sem uso | `odin login` |
| "guard inativo nesta sessão" | As proteções foram instaladas agora e a sessão ainda não as carregou | Reinicie a sessão do Claude Code e repita o pedido |
| "runtime desatualizado" | Versão nova da skill | Nada: o Odin atualiza sozinho |
| `limite_excedido` | Cota ou limite por minuto | Aguarde a renovação ou peça aumento |
| `manutencao` | Serviço em manutenção | Veja a faixa no portal |
| `odin` não aparece em `/mcp` | O registro não foi feito ou foi removido | `odin setup` de novo; `odin doctor` |
| "versão proibida" | Uma versão foi retirada por segurança | `odin ensure <skill>` (ou nada: o próximo pedido atualiza) |

## 8. Perguntas frequentes
- **O Odin lê meu código?** Não. Ele vê apenas as chamadas às ferramentas dele (qual ferramenta, qual skill, resultado).
- **Posso usar em vários computadores?** Sim, um dispositivo por computador; todos aparecem em **Conta → Dispositivos**.
- **Preciso atualizar alguma coisa?** Não. Skills e proteções se atualizam sozinhas.
- **Como desinstalo?** `odin uninstall` remove tudo o que o Odin instalou e devolve seus arquivos de configuração como estavam.
