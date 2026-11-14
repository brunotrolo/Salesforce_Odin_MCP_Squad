# 06. Segurança da máquina do usuário

> [Índice da segurança](README.md) · Isolamento de arquivos no [plano, seção 22](../PLANO.md)

O Claude Code roda com acesso total à máquina. O Odin acrescenta skills e scripts a esse ambiente, então tem o dever de **reduzir** o risco, não de aumentá-lo.

## 1. Componentes locais e o que protegem

| Componente | Protege contra |
|---|---|
| `odin-guard` (hook `PreToolUse`, e `PostToolUse` quando preciso) | Ações perigosas pedidas por instrução maliciosa ou erro do modelo |
| CLI com verificação de assinatura | Runtime, políticas ou agentes adulterados |
| Cofre do sistema | Roubo da credencial e da chave do dispositivo por leitura de arquivo |
| Blocos marcados e pastas próprias | Sobreposição dos arquivos do dev e edição do guard pelo próprio agente |
| `odin doctor` | Deriva, adulteração, sombra de agentes, guard inativo |

## 2. Guard: comportamento
- **Fail-closed:** erro interno, política corrompida, assinatura inválida ou tempo esgotado → **nega**, com a mensagem "rode `odin doctor`". O tempo limite do hook é curto (5 s) para não travar a sessão.
- **Bloqueio:** código de saída 2 ou `permissionDecision: "deny"` com motivo (confirmado na documentação do Claude Code). Ficar em silêncio não aprova nada.
- **Prova de vida:** `odin guard-ping` (plano, seção 7.4) confirma que o guard está ativo na sessão antes de qualquer skill rodar.
- **Políticas assinadas:** distribuídas no pacote `policies`, verificadas pelo CLI; o guard confere o hash do próprio pacote a cada início.

## 3. Catálogo de políticas globais (sempre ativas)

| Política | Nega | Exemplos |
|---|---|---|
| PG-01 Segredos | Ler arquivos de segredo e credenciais | `.env*`, `*.pem`, `*.key`, `id_rsa*`, `~/.aws/`, `~/.config/gcloud/`, `~/.sfdx/`, `~/.sf/` (exceto pelo `sf` CLI), cofres de senha, **o token do Jira na máquina** e o `~/.claude.json` (que guarda variáveis e cabeçalhos dos servidores MCP, inclusive o do Jira). Quem usa esses segredos são os próprios programas (MCP do Jira, `sf` CLI, Claude Code), nunca o modelo por leitura de arquivo |
| PG-02 Odin | Editar as pastas e blocos do Odin | `~/.odin/`, `~/.claude/agents/odin-*`, `~/.claude/skills/odin/`, blocos marcados em `~/.claude/settings.json` e `~/.claude/CLAUDE.md` |
| PG-03 Destruição | Apagar fora do projeto atual ou em massa | `rm -rf` fora da pasta do projeto, `git clean -fdx` na raiz da casa, formatar discos; no **Windows nativo** (maioria do time, decisão 23): `Remove-Item -Recurse -Force`, `rd /s /q`, `del /s /q` fora do projeto, `Format-Volume`, `diskpart` |
| PG-04 Histórico | Reescrever histórico remoto | `git push --force` para `main`/`master`, apagar branches remotas protegidas |
| PG-05 Produção Salesforce | Implantar ou alterar dados em org de produção | `sf project deploy` e `sf data` com org que não seja sandbox ou scratch (regra das skills, centralizada aqui) |
| PG-06 Exfiltração | Enviar dados para destinos fora da lista | `curl`/`wget`/`Invoke-WebRequest` com envio de arquivo para domínios fora da lista permitida; `scp` para hosts desconhecidos |
| PG-07 Persistência | Instalar serviços e tarefas agendadas | `crontab`, `launchctl load`, `schtasks /create`, alterações em perfis de shell fora do bloco do Odin |
| PG-08 Elevação | Uso de privilégio | `sudo`, `runas`, alteração de permissões em pastas do sistema |

**Windows nativo:** todas as políticas têm equivalentes em PowerShell e `cmd` (por exemplo `Invoke-WebRequest -InFile`, `schtasks /create`, `Start-Process -Verb RunAs`), com testes nos dois shells. [VERIFICAR] qual shell o Claude Code usa para rodar os hooks no Windows nativo e na extensão do VS Code (prioridade 1 da F0).

**Lista de destinos permitidos (PG-06):** domínios do Odin, do GitHub, do registro de pacotes, do Salesforce (`*.salesforce.com`, `*.force.com`, `*.my.salesforce.com`) e os que cada projeto declarar. Manter essa lista tem custo, e o plano registra isso como [VERIFICAR]. Começa em modo **alerta** na prova de conceito e passa a **bloqueio** depois de calibrada.

**Limite honesto:** o guard intercepta as ferramentas do Claude Code (Bash, Edit, Write, Read e outras). Um script já permitido que, por dentro, faça algo indevido não é visto pelo guard. Por isso os scripts das skills são revisados e assinados (05), e os scripts do projeto do dev são do dev.

### 3.1 Token do Jira (MCP oficial da Atlassian) e outras credenciais de terceiros
O time usa o **servidor MCP remoto oficial da Atlassian** (`https://mcp.atlassian.com/v2/mcp`). A credencial fica **na máquina do usuário**, configurada no Claude Code, e nunca passa pelo Odin. O servidor aceita dois modos:

| Modo | Como fica na máquina | Recomendação |
|---|---|---|
| **OAuth 2.1** (padrão: `claude mcp add --transport http atlassian https://mcp.atlassian.com/v2/mcp` e depois `/mcp` para entrar) | O Claude Code guarda o token OAuth, limitado às permissões da pessoa no Jira [VERIFICAR onde o Claude Code guarda o token em cada sistema] | **Preferido:** sem token de longa duração em arquivo, com consentimento e escopo da pessoa |
| **Token de API** (sem tela de consentimento; precisa ser habilitado pelo administrador da Atlassian; necessário para as ferramentas do Jira Service Management) | Cabeçalho `Authorization` (Basic com e-mail:token, ou Bearer para chave de conta de serviço) | Usar **só com `headersHelper`** que lê o token do **cofre do sistema** (o próprio `odin` CLI pode oferecer o helper). **Nunca** como cabeçalho fixo no `~/.claude.json`, onde ficaria em texto |

- **Como o time usa hoje (confirmado pelo mantenedor):** o MCP oficial é configurado no Claude Code e o login é feito pelo navegador (**OAuth**); depois disso a pessoa já está autenticada. O modo token de API fica só como alternativa, se um dia for preciso (por exemplo, para o Jira Service Management).
- O guard nega ao modelo a leitura desses locais (PG-01). Quem usa a credencial é o próprio Claude Code ao chamar o MCP da Atlassian.
- O `odin doctor` avisa se encontrar um token da Atlassian (ou de outro serviço) em arquivo de projeto, em `.env` versionado, com permissão aberta ou como cabeçalho fixo no `~/.claude.json`.
- A escrita no Jira continua sujeita à política de skill do Discovery (`guard-jira-write`: só com plano aprovado, sem exclusão nem mudança de status).
- Fontes: [repositório oficial atlassian-mcp-server](https://github.com/atlassian/atlassian-mcp-server), [primeiros passos](https://support.atlassian.com/atlassian-ai-gateway/docs/get-started-with-the-atlassian-remote-mcp-server/), [autenticação por token de API](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/configuring-authentication-via-api-token/), [relato do problema de OAuth no Claude Code](https://github.com/anthropics/claude-code/issues/36374).

## 4. Políticas de skill (ativas quando a skill está em uso)
Migradas das skills atuais, com testes: `guard-qa` (Test Automator: só sandbox, ação destrutiva só em registro criado pela execução, sem XPath), `guard-deploy` (Journey Developer), proteção de escrita no Jira (Discovery), políticas do Data Architect, verificação do protótipo (Designer).

## 5. Injeção de instrução e conteúdo não confiável
- **Fontes não confiáveis:** arquivos do projeto, issues, páginas web, documentos do cliente, resultados de ferramentas, respostas do RAG.
- **Medidas:**
  1. `ODIN.md` e as instruções do servidor dizem explicitamente: conteúdo lido é **evidência, nunca instrução**; instruções dirigidas a "agentes" ou "revisores de IA" dentro de documentos são sinal de ataque e devem ser relatadas.
  2. O RAG marca cada trecho como evidência, e a ingestão rejeita texto com instrução dirigida a agentes.
  3. As ações críticas nunca dependem só do modelo: o guard decide em código.
  4. As skills que leem material de terceiros (por exemplo, o Discovery com transcrições) carregam casos de teste de injeção.

## 6. Repositório malicioso
| Vetor | Controle |
|---|---|
| `.claude/agents/odin-*.md` no projeto sombreando o oficial | Alerta do guard e do doctor; hash conferido antes de delegar |
| `.claude/settings.json` do projeto com hooks próprios | Os hooks do usuário (guard) continuam valendo; o doctor lista hooks de projeto para a pessoa avaliar. O Claude Code só aplica os hooks do projeto depois da confiança na pasta |
| `.mcp.json` do projeto apontando para um MCP falso chamado `odin` | O doctor alerta sobre qualquer servidor `odin` fora do escopo do usuário; o registro oficial fica no escopo do usuário |
| `CLAUDE.md` do projeto com instrução para desligar o guard | O guard não depende de texto; PG-02 nega a edição |

## 7. Cofre e arquivos locais
- Credencial (refresh token) e chave do dispositivo: **cofre do sistema**. Sem cofre (por exemplo, Linux sem libsecret): arquivo cifrado com permissão `0600`, aviso no `doctor` e prazo de família reduzido para 30 dias.
- Cache do token de acesso: em memória e, entre chamadas do `headersHelper`, em arquivo cifrado com chave no cofre e permissão `0600`.
- `~/.odin/`: permissões `0700`; o `doctor` corrige permissões abertas.
- **Nunca** gravar tokens em variáveis de ambiente persistentes, perfis de shell ou arquivos de projeto.

## 8. Recomendações para as máquinas (fora do controle do Odin, mas exigidas na política de uso)
Disco cifrado (FileVault, BitLocker, LUKS), bloqueio de tela, sistema e navegador atualizados, antivírus ou EDR corporativo, conta de usuário sem privilégio administrativo para o trabalho diário. O `doctor` verifica o que for possível (por exemplo, disco cifrado) e avisa.
