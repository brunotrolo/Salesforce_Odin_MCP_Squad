# 03. Área do usuário

> [Índice do portal](README.md) · Para quem **consome** o MCP. Todas as páginas exigem sessão com segundo fator.

> **Situação (2026-11-16, ADR 0023):** versão interina no ar em `/conta`. Entrada por convite de uso único (72 h) criado por um administrador; a pessoa ativa o próprio dispositivo digitando o código do `odin setup`, vê seus perfis e skills (com canal e versão) e revoga os próprios dispositivos. Segundo fator e login com GitHub entram quando houver o OAuth App; até lá esta página **não** cumpre a exigência de MFA acima.

## 1. Navegação
Barra lateral: **Início · Conectar · Guia do MCP · Minhas skills · Meu consumo · Novidades · Solicitar acesso · Conhecimento · Conta**. Quem tem papel administrativo vê também **Administração**.

## 2. Páginas

### 2.1 Entrar (`/entrar`)
- Botão único **Entrar com GitHub**.
- Em seguida, o segundo fator: código do autenticador ou passkey.
- **Primeiro acesso:** cadastro obrigatório do fator (QR code para o autenticador, ou passkey), com a exibição única dos **10 códigos de recuperação** e a confirmação "guardei os códigos".
- **Sem acesso:** "Você ainda não tem acesso ao Odin. Peça a um administrador ou ao gestor do seu squad." O pedido fica registrado para o admin-identidade.
- **Erros:** código errado (com tentativas restantes); bloqueio temporário após 5 tentativas.

### 2.2 Início (`/`)
| Bloco | Conteúdo |
|---|---|
| Status da conexão | **Conectado** (dispositivo ativo e uso recente), **Ativado sem uso** ou **Não conectado** (com o botão "Conectar agora") |
| Meus squads e projetos | Squads, projetos atendidos e perfis em cada um |
| Skills disponíveis | Cartões com nome, versão vigente, canal e um exemplo de pedido |
| Consumo resumido | Requisições hoje e no mês, uso da cota (barra), tendência em relação ao mês anterior |
| Novidades | As 3 últimas mudanças nas skills que a pessoa usa |
| Pendências | Solicitações em andamento, convites, revisão de acesso pendente |
| Saúde do serviço | Operacional, degradado ou em manutenção (com a mensagem do administrador) |

### 2.3 Conectar (`/conectar`)
Guia passo a passo, com abas **macOS/Linux** e **Windows**:
1. **Pré-requisito:** Claude Code instalado (terminal ou extensão do VS Code).
2. **Instalar o CLI:** comando de uma linha (botão copiar) e o checksum, para quem quiser conferir.
3. **Rodar `odin setup`:** explica que o navegador vai abrir em `/ativar`, que é preciso confirmar o código e o que será instalado (com a frase "nada é escrito no seu projeto").
4. **Conferir:** `odin doctor` deve terminar verde; o status da página muda para **Conectado** sozinho.
5. **Primeiro pedido:** exemplos por perfil ("Detalhe o discovery da R02", "Crie a classe de teste do `CaseRouter`").

**Alternativa sem CLI** (recolhida, com aviso de que é exceção): gerar token pessoal e usar `claude mcp add --transport http --scope user odin https://mcp.<dominio>/mcp --header "Authorization: Bearer <token>"`. Skills que dependem de runtime local não funcionam assim.

### 2.4 Ativar dispositivo (`/ativar`)
- Campo do código (preenchido se veio pelo link do terminal).
- Exige MFA com menos de 5 min (pede o fator se precisar).
- Mostra **o dispositivo que pediu**: nome, sistema, versão do CLI, IP e local aproximado, horário. Alerta em destaque quando o local ou a rede diferem muito do navegador atual.
- Texto fixo: "Só confirme se **você** acabou de rodar `odin setup` neste computador. Ninguém do suporte vai pedir este código."
- Botões **Ativar** e **Não fui eu** (este revoga o pedido e alerta a segurança).

### 2.5 Guia do MCP (`/guia`)
Conteúdo do [guia](04-guia-do-mcp.md), com três subpáginas:
- **Ferramentas** (`/guia/ferramentas`): gerada a partir dos metadados publicados pelo próprio servidor MCP. Mostra nome, para que serve, quando o Claude Code a usa, entradas e exemplo.
- **Skills** (`/guia/skills`): as skills que **a pessoa** pode usar, com descrição, exemplos de pedido, pré-requisitos (por exemplo, Playwright, `sf` CLI), o que lê e o que produz, e o próximo passo da jornada.
- **Problemas comuns** (`/guia/problemas`): mensagens de erro do MCP e do CLI, com a correção.

### 2.6 Minhas skills (`/minhas-skills`)
Tabela: skill · versão vigente · canal · **por que tenho acesso** (perfil X no squad Y, ou concessão até a data Z) · última vez que usei · botão "detalhes". Detalhe: descrição, exemplos, pré-requisitos, histórico recente de versões (ligado a [07](07-ciclo-de-vida-das-skills.md)).

### 2.7 Meu consumo (`/meu-consumo`)
- **Período:** hoje, 7 dias, 30 dias, mês corrente.
- **Gráficos:** requisições por dia; por skill; por ferramenta; taxa de erro.
- **Cota:** limite do meu perfil, uso atual, data de renovação e botão "pedir aumento".
- **Últimas chamadas** (sem conteúdo): horário, ferramenta, skill, resultado (`ok`, `negado`, `erro`), dispositivo.
- **Exportar** os próprios dados (CSV ou JSON), um direito do titular.
Detalhe das métricas em [06](06-consumo-cotas-e-metricas.md).

### 2.8 Novidades (`/novidades`)
Linha do tempo das mudanças no catálogo **que afetam a pessoa**: skill nova disponível para o perfil, versão nova em `stable`, mudança de comportamento destacada no changelog, depreciação com data, retirada, perda ou ganho de acesso. Filtro por skill. Marca de "lido".

### 2.9 Solicitar acesso (`/solicitar`)
- Formulário: o que (skill ou coleção de conhecimento) · projeto · motivo (obrigatório) · prazo (até 90 dias).
- Mostra quem vai aprovar (gestor do squad, admin de catálogo ou curador).
- Lista **Minhas solicitações** com status (pendente, aprovada até a data X, recusada com motivo, expirada).

### 2.10 Conhecimento (`/conhecimento`)
Minhas propostas (feitas por skills em meu nome ou por mim): coleção, projeto, status e motivo da decisão, e o link do PR quando aprovada. Botão **Propor** (formulário com fonte obrigatória).

### 2.11 Conta (`/conta`)
| Subpágina | Conteúdo e ações |
|---|---|
| **Segurança da conta** (`/conta/mfa`) | Fatores cadastrados, últimos logins (data, local, navegador), códigos de recuperação restantes; cadastrar ou remover fator (exige o fator atual); gerar novos códigos |
| **Dispositivos** (`/conta/dispositivos`) | Nome, sistema, ativado em, último uso, IP; **renomear**, **revogar** um ou **revogar todos** |
| **Tokens pessoais** (`/conta/tokens`) | Lista (prefixo, últimos 4 caracteres, criado em, expira em, último uso); **gerar** (MFA < 5 min, motivo, prazo; exibido uma vez); **revogar** |
| **Meus dados** | Exportar meus dados; ver o aviso de privacidade |

## 3. Estados e mensagens padrão
| Situação | Mensagem |
|---|---|
| Sem skills | "Você ainda não tem skills liberadas. Peça acesso ao gestor do seu squad." + botão **Solicitar acesso** |
| Sem dispositivo | "Seu Claude Code ainda não está conectado ao Odin." + botão **Conectar** |
| Cota perto do limite (80%) | Faixa amarela no Início e em Meu consumo |
| Cota excedida | Faixa vermelha: "Você atingiu a cota de hoje. Ela renova às 00:00. Precisa de mais? **Pedir aumento**" |
| Manutenção | Faixa no topo com a mensagem do administrador |
| Acesso alterado | Aviso em Novidades e no Início: "Seu acesso a X mudou em DD/MM: motivo" |
