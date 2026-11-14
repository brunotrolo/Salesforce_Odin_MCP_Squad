# 10. Controles, testes e conformidade

> [Índice da segurança](README.md)

## 1. Matriz de controles

Referências: **OWASP ASVS 4.0** (aplicações web e APIs), **OWASP Top 10 para aplicações com LLM**, **CIS Google Cloud Foundations Benchmark**, **OAuth 2.0 Security Best Current Practice (RFC 9700)**.

| ID | Controle | Referência | Onde | Verificação |
|---|---|---|---|---|
| CT-01 | Login federado com MFA obrigatório do Odin | ASVS V2 | Portal, STS | Teste: sessão sem MFA não acessa nada |
| CT-02 | Passkey obrigatória para papéis administrativos | ASVS V2.8 | Portal | Teste: admin sem passkey não abre o console |
| CT-03 | Device Grant com aprovação com MFA e código de 10 min | RFC 8628, RFC 9700 | STS, portal | Teste de expiração e uso único |
| CT-04 | Refresh token rotativo, com detecção de reuso e prova de posse | RFC 9700 §4.14, RFC 7523 | STS | Teste: reuso revoga a família; sem assinatura não renova |
| CT-05 | JWT de 15 min, algoritmo fixo, `aud` e `typ` conferidos | RFC 9068, ASVS V3 | MCP | Testes com `alg=none`, `HS256`, `aud` trocado, expirado |
| CT-06 | Direitos no servidor e negado por padrão | ASVS V4 | MCP, portal | Testes de autorização ([04](04-autorizacao.md), seção 6) |
| CT-07 | Isolamento por projeto no banco | ASVS V4, LLM06 | Cloud SQL | Teste: A não lê B |
| CT-08 | Separação de funções e quatro olhos | ASVS V4.1 | Portal | Teste: autoaprovação recusada |
| CT-09 | Cookies `__Host-`, `HttpOnly`, CSRF, CSP | ASVS V3, V14 | Portal | DAST + testes de cabeçalho |
| CT-10 | Validação de entrada em todas as ferramentas MCP e APIs (schema) | ASVS V5 | MCP, portal | Fuzzing de entradas |
| CT-11 | Limites de taxa e WAF | ASVS V11 | Cloud Armor, serviços | Teste de carga com limites |
| CT-12 | Pacotes assinados e verificados, anti-rebaixamento | SLSA nível 3 (meta) | CI, CLI | Teste: pacote adulterado recusado |
| CT-13 | Ações fixadas por SHA, permissões mínimas no CI | OpenSSF Scorecard | GitHub | Scorecard no CI |
| CT-14 | Dependências varridas e com idade mínima | ASVS V14.2 | CI | Falha em vulnerabilidade alta |
| CT-15 | Guard fail-closed e políticas globais | LLM08 (agência excessiva) | Máquina | Testes de política (cada regra com casos de permitir e negar) |
| CT-16 | Conhecimento como evidência e filtro de injeção | LLM01 | Ingestão, skills | Casos de teste de injeção |
| CT-17 | Sem chaves de conta de serviço; WIF com condição | CIS 1.4, 1.5 | IAM | Teste de conformidade |
| CT-18 | Cloud SQL sem IP público, com TLS e IAM | CIS 6.x | Cloud SQL | Teste de conformidade |
| CT-19 | Buckets sem acesso público, com acesso uniforme e CMEK | CIS 5.x | Storage | Teste de conformidade |
| CT-20 | Logs de acesso a dados ligados e coletor protegido | CIS 2.x | Logging | Teste de conformidade |
| CT-21 | Auditoria de todas as ações, sem conteúdo dos pedidos | ASVS V7 | Todos | Teste: toda rota grava evento |
| CT-22 | Segredos só no Secret Manager, com rotação | ASVS V6 | Todos | Varredura de segredos |
| CT-23 | Revogação ≤ 30 s | Interno | MCP, STS | Teste com relógio controlado |
| CT-24 | Nada escrito no projeto do dev; blocos íntegros | Interno | CLI | Teste de isolamento ([plano](../PLANO.md), seção 22) |

## 2. Plano de testes de segurança

| Tipo | Ferramenta ou método | Quando |
|---|---|---|
| Análise estática (SAST) | CodeQL, linters de segurança | Todo PR |
| Segredos | Varredura de segredos do GitHub + gitleaks | Todo PR e push |
| Dependências (SCA) | OSV-Scanner, Dependabot | Todo PR e diário |
| Contêineres | Varredura do Artifact Registry | A cada imagem |
| IaC | Checkov ou tfsec + testes de conformidade próprios | Todo PR em `infra/` |
| Testes de autorização | Suíte própria ([04](04-autorizacao.md), seção 6) | Todo PR |
| Testes de tokens | `alg` inválido, assinatura trocada, expirado, `aud` errado, reuso de refresh, prova de posse ausente | Todo PR |
| Testes de política do guard | Casos de permitir e negar por regra | Todo PR em `policies/` |
| Testes de injeção | Documentos e respostas com instrução dirigida a agentes | Todo PR em skills e na ingestão |
| DAST | OWASP ZAP no portal e nas APIs (ambiente de teste) | Semanal e antes de cada liberação |
| Pentest | Externo, com escopo de portal, STS, MCP, CLI e cadeia de distribuição | Antes de liberar para o time (fase F10) e anual |
| Revisão do modelo de ameaças | Sessão com mantenedores | A cada fase e semestral |
| Simulação de incidente | Executar um playbook ([09](09-deteccao-e-resposta.md)) | Semestral |

## 3. Critérios de segurança por fase do plano

| Fase | Critério de segurança para concluir |
|---|---|
| F0 Verificações | Confirmados: `headersHelper` no escopo do usuário, comportamento com `401`, hooks na extensão do VS Code; MFA do Identity Platform com login GitHub (ou decisão pelo TOTP próprio) |
| F1 Fundação | Teste de conformidade da infraestrutura verde; nenhuma chave de conta de serviço; WIF com condição |
| F2 Identidade | CT-01 a CT-05 e CT-23 verdes; MFA obrigatório; passkey para administradores |
| F3 Catálogo e publicação | CT-12 a CT-14 verdes; pacote adulterado recusado |
| F4 MCP | CT-06, CT-07, CT-10, CT-21 verdes |
| F5 Runtime local | CT-15, CT-24 verdes; guard fail-closed comprovado |
| F6 Adaptação das skills | Políticas migradas com testes; nenhuma skill com segredo |
| F7 Conhecimento | CT-07 e CT-16 verdes; máscara de PII validada |
| F8 Operação | Detecções DT-01 a DT-18 configuradas; runbooks testados |
| F9 Validação pessoal | Simulação de incidente executada |
| F10 Time | **Pentest externo** sem achado crítico ou alto em aberto; termos de uso e aviso de privacidade publicados |

## 4. Exceções
Qualquer exceção a um controle (por exemplo, vulnerabilidade sem correção disponível) é registrada com: controle, motivo, risco, mitigação temporária, dono e **data de expiração**. Exceções vencidas bloqueiam a publicação.
