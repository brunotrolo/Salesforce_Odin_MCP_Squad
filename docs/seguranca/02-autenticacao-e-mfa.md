# 02. Autenticação e MFA

> [Índice da segurança](README.md)

## 1. Quem se autentica, onde e como

| # | Quem → onde | Método escolhido | Fatores |
|---|---|---|---|
| AU-1 | Pessoa → portal | **OAuth 2.0 Authorization Code** com o GitHub, conduzido pelo Identity Platform (PKCE e `state` onde o provedor e o SDK suportarem [VERIFICAR]); o portal recebe um ID token OIDC do Identity Platform | GitHub (com o 2FA do GitHub) **+ segundo fator do Odin** (TOTP ou passkey) |
| AU-2 | CLI → STS (ativação) | **OAuth 2.0 Device Authorization Grant** (RFC 8628), aprovado no portal | A aprovação exige sessão do portal **com MFA válido**; o dispositivo prova posse de uma chave própria |
| AU-3 | CLI → STS (renovação) | **Refresh token** (OAuth 2.0) **+ prova de posse** `private_key_jwt` (RFC 7523) | Algo que o dispositivo tem: credencial + chave privada no cofre do sistema |
| AU-4 | Claude Code → MCP; CLI → `/v1` | **Bearer token** (RFC 6750) com JWT de acesso (perfil RFC 9068) | Herdado da sessão do dispositivo |
| AU-5 | Exceção sem CLI → MCP | **Token pessoal** (Bearer opaco) | Criado no portal com MFA recente |
| AU-6 | Evolução → MCP | **OAuth 2.1 do MCP** (Authorization Code + PKCE, metadados RFC 8414 e RFC 9728) | Mesmo login do portal (com MFA) |
| AU-7 | GitHub Actions → Google Cloud | **Workload Identity Federation** (troca de token OIDC do GitHub, RFC 8693) | Identidade do workflow (dono, repositório, ref) |
| AU-8 | Google Cloud → GitHub | **GitHub App** (JWT do app → token de instalação) | Chave privada do app no Secret Manager |
| AU-9 | GitHub → webhooks (só E2; em E0 e E1 não há webhooks) | **HMAC SHA-256** + faixa de IP do GitHub | Segredo compartilhado |
| AU-10 | Serviço → serviço | **IAM do Cloud Run** (ID token OIDC da conta de serviço) | Identidade gerenciada pelo Google |
| AU-11 | Serviço → Cloud SQL | **Autenticação IAM do banco** | Identidade gerenciada pelo Google |

## 2. Por que estes métodos (e não outros)

| Método | Para quê serve | Usado no Odin? | Motivo |
|---|---|---|---|
| **Client credentials** (OAuth 2.0) | Máquina falando com máquina, sem pessoa | **Não para pessoas.** Entre serviços também não: usamos identidade federada e IAM | Daria a cada máquina um *segredo compartilhado* sem identidade de pessoa: não sabemos **quem** está usando, não há MFA, e o segredo vazaria dos computadores. Entre serviços do Google, o IAM dá a mesma coisa sem segredo nenhum |
| **Authorization Code + PKCE** (OAuth 2.1) | Pessoa fazendo login num navegador | **Sim** (portal e evolução do MCP) | Padrão atual para login com navegador; o PKCE impede o roubo do código de autorização |
| **Device Authorization Grant** | Programa sem navegador próprio (CLI) fazendo login | **Sim** (ativação do CLI) | O CLI não precisa ver senha nem segredo; a pessoa aprova no navegador, com MFA |
| **Refresh token** | Renovar o acesso sem novo login | **Sim, com proteções** | Sem ele, a pessoa faria login a cada 15 min. Com rotação, detecção de reuso e ligação à chave do dispositivo, o roubo do refresh token não basta |
| **Bearer token** | Enviar o token de acesso em cada chamada | **Sim, só com JWT curto** | É o que o Claude Code envia pelo `headersHelper`. A exposição é limitada: 15 min, público restrito, sem direitos embutidos |
| **API key fixa** | Chave longa e estática | **Não** | Não expira, não tem pessoa, vaza fácil |
| **Token pessoal** (estilo PAT) | Quando não há CLI | **Só como exceção** | Prazo curto, MFA para criar, varredura de segredos, auditoria |
| **mTLS** (certificado do cliente) | Amarrar o token a um certificado | **Não** (por ora) | O Claude Code não oferece certificado de cliente para servidores MCP [VERIFICAR]; a ligação a chave fica na renovação |
| **DPoP** (RFC 9449) | Amarrar o token a uma chave, a cada requisição | **Não no MCP; sim, em espírito, na renovação** | O DPoP exige uma prova nova por requisição (método e URL). O `headersHelper` roda por conexão, não por requisição, então não consegue gerar essa prova. A renovação usa `private_key_jwt`, que dá a mesma garantia onde mais importa |
| **Senha própria do Odin** | Login com usuário e senha | **Não** | Mais um segredo para vazar; o GitHub e o segundo fator já cobrem a identidade |

**Resumo:** OAuth 2.0/2.1 em todos os pontos com pessoa (Authorization Code + PKCE no navegador, Device Grant no CLI), refresh token protegido, Bearer só para um token curto. Entre máquinas, identidade federada e IAM, sem `client_secret`.

## 3. MFA: camadas

### 3.1 Primeiro fator: GitHub
- Login com GitHub (OAuth 2.0, escopos mínimos: `read:user`, `user:email`; `read:org` só se houver organização).
- **2FA no GitHub:** em produção, a organização do GitHub deve **exigir** 2FA de todos os membros. Na conta pessoal da prova de conceito não há como exigir, por isso o segundo fator do Odin é obrigatório.

### 3.2 Segundo fator do Odin (sempre, independentemente do GitHub)
O Odin **não confia só no GitHub**: uma conta do GitHub tomada não basta para entrar.

| Fator | Exemplos | Quem | Observação |
|---|---|---|---|
| **TOTP** (RFC 6238) | Google Authenticator, Microsoft Authenticator, Authy, 1Password | **Obrigatório** para todos (mínimo) | Código de 6 dígitos que muda a cada 30 s |
| **Passkey / chave de segurança** (WebAuthn / FIDO2) | Touch ID, Windows Hello, YubiKey | **Recomendado** para todos; **obrigatório** para papéis administrativos | Resistente a phishing: não há código para a pessoa digitar num site falso |
| Códigos de recuperação | 10 códigos de uso único | Todos | Guardados só como hash; usar um deles avisa a pessoa e os administradores de identidade |
| SMS | — | **Não usado** | Vulnerável a troca de chip (SIM swap) |

**Implementação:**
- **TOTP:** pelo MFA do Identity Platform, que suporta TOTP como segundo fator. [VERIFICAR] se o MFA do Identity Platform se aplica a login federado com GitHub. Se não se aplicar, o `odin-sts` implementa TOTP próprio: segredo de 160 bits cifrado com o KMS, janela de ±1 passo e proteção contra reuso do mesmo código.
- **Passkeys:** WebAuthn no portal, com biblioteca madura de servidor. A chave pública fica no Firestore (`users/{id}/passkeys`). Exige verificação do usuário (biometria ou PIN) e atestação opcional para chaves de administradores.

### 3.3 Quando o MFA é pedido

| Momento | MFA? | Por quê |
|---|---|---|
| Login no portal | **Sim**, a cada sessão (8 h) | Porta de entrada de tudo |
| Aprovar a ativação de um dispositivo (`/ativar`) | **Sim**, MFA com menos de 5 min | É aqui que nasce a credencial de 90 dias; também mitiga o phishing de device code |
| Uso diário no Claude Code (token, renovação) | **Não** | O dispositivo já é "algo que você tem" (credencial + chave no cofre). Pedir MFA aqui seria fricção sem ganho proporcional |
| Gerar token pessoal | **Sim**, menos de 5 min | Credencial portátil |
| Qualquer ação administrativa no console | **Sim**, menos de 15 min; **passkey** para papéis administrativos | Poder alto |
| Trocar ou remover fatores de MFA | **Sim**, com o fator atual (ou código de recuperação) + aviso por e-mail | Evita tomada de conta silenciosa |
| Reativar um dispositivo revogado | **Sim** (é uma ativação nova) | — |
| A cada 90 dias por dispositivo | **Sim** (nova ativação) | Limita a vida da credencial |

### 3.4 Níveis de garantia

| Nível | Requisito | Libera |
|---|---|---|
| **N1: usuário** | GitHub + TOTP (ou passkey) | Portal do usuário, ativar dispositivos, usar o MCP pelo dispositivo |
| **N2: administrador** | GitHub + **passkey** + reautenticação com menos de 15 min | Console de administração do seu papel |
| **N3: emergência** | N2 + uso da conta de emergência com motivo + alerta a todos os administradores | Super-admin em incidente |

**Separação de planos:** o token do MCP (AU-4) é sempre N1, mesmo de quem é administrador. **Nenhuma ação administrativa é possível pelo MCP ou pelo CLI.** Administração só no portal, com N2.

### 3.5 Inscrição e recuperação
- **Primeiro acesso:** depois do login com GitHub, o portal obriga a cadastrar o TOTP (QR code) antes de qualquer outra coisa, e oferece a passkey. Mostra os 10 códigos de recuperação uma vez.
- **Perdeu o celular:** usa um código de recuperação → cadastra o fator novo → todos os dispositivos ativos recebem aviso, e a pessoa pode revogá-los.
- **Perdeu tudo:** pedido ao `admin-identidade` → verificação de identidade fora do sistema (por exemplo, chamada de vídeo com o gestor) → **quatro olhos** (dois administradores) → o MFA da pessoa é zerado, todos os dispositivos dela são revogados e ela recadastra.
- **Administrador sem passkey:** não acessa o console até cadastrar uma.

## 4. Proteções no login e na ativação
- **Limite de tentativas:** 5 códigos TOTP errados → bloqueio de 15 min e alerta; limite por IP e por pessoa no `/ativar` e no `/sessao`.
- **Login novo:** e-mail ou aviso no portal em login de um país, navegador ou rede inéditos para a pessoa.
- **Dispositivo novo:** aviso para a pessoa ("um dispositivo 'notebook (Windows)' foi ativado na sua conta") com link para revogar.
- **Phishing de device code:** a tela de ativação mostra nome, sistema, IP e local aproximado do **dispositivo que pediu**, e alerta quando são muito diferentes dos do navegador que aprova. O código só vale 10 minutos, e o texto diz "só aprove se você acabou de rodar `odin setup`".
- **Sem enumeração:** mensagens iguais para "pessoa não existe" e "sem acesso".

## 5. Configuração dos provedores
- **GitHub OAuth App** (usado pelo Identity Platform): URL de retorno só a do Identity Platform; escopos mínimos; segredo no Identity Platform, com rotação anual.
- **Identity Platform:** domínios autorizados só `odin.<dominio>` (e `localhost` só no ambiente de desenvolvimento); provedores não usados desligados; criação de conta só pelo fluxo controlado (convite ou time mapeado), nunca aberta.
- **Google e Microsoft (opcionais):** mesmas regras; o segundo fator do Odin vale para qualquer provedor.
