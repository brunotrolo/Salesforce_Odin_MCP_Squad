# Segurança do Odin MCP Squad

> Documentação de cibersegurança da solução. Complementa o [plano](../PLANO.md) e a [arquitetura](../arquitetura/03-arquitetura-tecnica.md). **Em caso de diferença, vale esta pasta para tudo o que é segurança.**
> **Status:** desenho, nada foi desenvolvido. [VERIFICAR] = confirmar na prova de conceito.

## Documentos

| # | Documento | Responde |
|---|---|---|
| 01 | [Modelo de ameaças](01-modelo-de-ameacas.md) | O que protegemos, de quem, por onde podem atacar (STRIDE por componente) |
| 02 | [Autenticação e MFA](02-autenticacao-e-mfa.md) | Qual método de autenticação em cada ponto e por quê (comparação com client credentials, OAuth 2.1, bearer, API key, mTLS, DPoP); MFA com aplicativo autenticador e chave de acesso |
| 03 | [Tokens, sessões e chaves](03-tokens-sessoes-e-chaves.md) | Cada credencial: formato, validade, onde fica, renovação (refresh token), rotação, revogação, validação |
| 04 | [Autorização e controle de acesso](04-autorizacao.md) | Perfis, papéis, avaliação de política, separação de funções, quatro olhos, acesso de emergência |
| 05 | [Cadeia de suprimentos e distribuição](05-cadeia-de-suprimentos.md) | Assinatura de pacotes, atestação, SBOM, dependências, proteção do GitHub, cerimônia de chaves |
| 06 | [Segurança da máquina do usuário](06-seguranca-do-endpoint.md) | Guard, políticas, cofre do sistema, isolamento, injeção de instrução, repositório malicioso |
| 07 | [Infraestrutura e rede no Google Cloud](07-infraestrutura-gcp.md) | IAM, contas de serviço, rede, Cloud Armor, criptografia, segredos, logs, políticas de organização |
| 08 | [Proteção de dados e LGPD](08-dados-e-lgpd.md) | Classificação, inventário de dados pessoais, retenção, direitos do titular, isolamento do RAG |
| 09 | [Detecção e resposta a incidentes](09-deteccao-e-resposta.md) | Detecções, severidades, playbooks de incidente, comunicação |
| 10 | [Controles, testes e conformidade](10-controles-e-testes.md) | Matriz de controles (OWASP ASVS, OWASP Top 10 para LLM, CIS GCP), plano de testes de segurança, critérios por fase |
| 11 | [Runbooks de segurança](11-runbooks.md) | Passo a passo: rotação de chaves e segredos, revogação, saída de pessoa, acesso de emergência, restauração |

## Resumo das decisões de segurança

| Tema | Decisão |
|---|---|
| Login das pessoas | **OAuth 2.0 / OIDC com GitHub** (via Identity Platform), mais **segundo fator do Odin**: aplicativo autenticador (TOTP, como o Google Authenticator) obrigatório, ou chave de acesso (passkey/FIDO2), recomendada e obrigatória para administradores |
| Ativação do CLI | **OAuth 2.0 Device Authorization Grant (RFC 8628)**, aprovado no portal **com MFA** |
| Renovação | **Refresh token opaco, rotativo, com detecção de reuso e ligado à chave do dispositivo** (prova de posse por `private_key_jwt`, RFC 7523) |
| Acesso ao MCP | **Bearer token** JWT (perfil RFC 9068), ES256, **15 min**, sem direitos dentro do token |
| Client credentials | **Não usado por pessoas.** Só entre máquinas, e mesmo assim substituído por identidade federada (Workload Identity Federation) e IAM, sem segredo guardado |
| Token pessoal | Exceção, ≤ 90 dias, criado com MFA, detectável por varredura de segredos |
| Planos separados | O token do MCP **nunca** dá poder administrativo; administração só no portal, com MFA recente |
| Cadeia de distribuição | Pacotes assinados no Cloud KMS, verificados pelo CLI com chave pública embutida |
| Máquina | Guard fail-closed, assinado; o Odin nunca escreve no projeto do dev |
| Dados | Região no Brasil, CMEK, RAG separado por projeto no banco, auditoria sem conteúdo dos pedidos |

## Donos e revisão
- **Dono da segurança da solução:** mantenedor principal (na prova de conceito); em produção, um responsável de segurança nomeado.
- **Revisão:** esta pasta é revisada a cada fase do plano, a cada incidente e no mínimo a cada 6 meses. O modelo de ameaças é refeito sempre que um componente novo entra.
