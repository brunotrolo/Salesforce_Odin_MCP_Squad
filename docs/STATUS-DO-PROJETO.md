# Status do projeto: o plano, o que foi feito, o que foi homologado e o que falta

Atualizado em 2026-11-16. Fonte do plano: [PLANO.md](PLANO.md) (seção 16, fases F0 a F10). Resultados medidos: [HOMOLOGACAO.md](HOMOLOGACAO.md). Estado corrente: [ESTADO.md](ESTADO.md).

**Em uma frase:** o núcleo da prova de conceito (fases F1, F3, F4 e a maior parte de F2, F5 e F8) está **construído e homologado no Google Cloud**; falta terminar a adaptação definitiva das skills (F6), o conhecimento (F7), parte da operação (F8) e tudo o que depende de você ou de decisão externa (F0 com o Claude Code real, F9, F10).

## 1. O plano completo (11 fases)
| Fase | O que entrega |
|---|---|
| F0 | Verificações com o Claude Code real (Windows nativo, VS Code, LiteLLM) e ferramentas de manutenção |
| F1 | Projeto Google Cloud, Terraform, identidade federada, orçamento com disjuntor, Cloud Run |
| F2 | ✅ | Emissor de tokens (KMS), device flow, renovação rotativa com detecção de reuso, revogação ≤ 30 s, portal de administração e de pessoa, login com GitHub e **segundo fator próprio**: TOTP, 10 códigos de recuperação de uso único e passkey (WebAuthn), com reconfirmação a cada 15 minutos (H31, ADR 0026). Limites: a atestação da passkey não é verificada; o segredo de administração (emergência) não exige o 2º fator. |
| F3 | ✅ | `odin.yaml`, catálogo, `odin lint`, pacote determinístico, manifesto assinado pelo KMS, publisher que confere a assinatura. **Publicação automática** a cada push (`pipeline-completo.yml`), só do que mudou, com portão de avaliação, promoção a `stable` e rollback de canal (`canal.yml`); H27 e H28. |
| F4 | Servidor MCP: ferramentas, autorização por perfil e projeto, auditoria |
| F5 | ✅ 👤 | `setup`, `login`, `token`, `ensure`, `doctor`, `status`, `uninstall`, guard PG-01 a PG-08 e agora `update` (CLI assinado pelo KMS, H29), `restore-copias`, `doctor --limpar-copias` e instalador multiplataforma. O CI roda o demo no Linux e no Windows. Falta só a sua prova no Windows e no VS Code reais. Não há binário empacotado: o CLI roda no Node, sem dependências de terceiros. |
| F6 | ✅ | As 10 skills em `stable`, com contrato, `odin ensure`, 20 intenções cada (roteamento 38/38), **políticas do guard por skill** (hooks migrados; ADR 0027), **bibliotecas de terceiros compartilhadas** em `libs/` (ADR 0028; H32 e H33) e **camada de avaliação com modelo** implementada (ADR 0029; 3 casos de modelo por skill). Falta só rodar a avaliação com modelo com o seu `ANTHROPIC_API_KEY` para registrar a nota de referência, e fundir as cópias divergentes de bibliotecas do LWC Developer e do Apex Cover Loop. |
| F7 | ✅ | Busca híbrida (embeddings `text-embedding-005` da Vertex AI + léxica) com citação, isolamento por projeto, filtro de injeção, propostas com aprovação no portal, indexador no pipeline e **medição de recuperação na nuvem** (H30: recall@5 ≥ 80%, fora do assunto recusado; piso de similaridade calibrado com notas reais). A fonte está em `conhecimento/` deste repositório porque o `odin-knowledge` não pôde ser criado (403 da integração). |
| F8 | ✅ | Carga de 50 usuários (p95 322 a 1259 ms, zero erros), partida a frio p95 394 ms, disjuntor testado de verdade, **auditoria em BigQuery** (`odin_auditoria`, 400 dias), painel operacional, 3 alertas (5xx, latência, negações) e runbooks `docs/RUNBOOKS-OPERACIONAIS.md`. Os alertas chegam por e-mail ao endereço do mantenedor (variável `ALERTA_EMAIL` do repositório; sem ela vale o endereço padrão do `infra.yml`). |
| F9 | Validação pessoal pelo mantenedor com as 10 skills |
| F10 | Preparação para o time (Portão 2) e corte único |

## 2. Situação por fase
Legenda: ✅ pronto e homologado · 🟡 parcial · ⬜ não feito · 👤 depende de você ou de decisão externa

| Fase | Situação | Detalhe |
|---|---|---|
| F0 | ⬜ 👤 | As ferramentas locais existem (`npm test`, `npm run verificar`, `npm run dev`). Falta provar tudo no Claude Code real, no Windows nativo e na extensão do VS Code, com o LiteLLM. |
| F1 | ✅ | Projeto `salesforcemcpodin`, Terraform (53+ recursos), identidade federada sem chave, orçamento de R$ 30 com alertas, disjuntor, limpeza do repositório de imagens. |
| F2 | 🟡 | Feito: emissor de tokens (chave no KMS), device flow com chave do dispositivo, renovação rotativa com detecção de reuso, revogação ≤ 30 s, portal de administração e de pessoa, login com GitHub. Falta: TOTP, passkey e códigos de recuperação; o segundo fator é o do GitHub e o Odin não consegue verificá-lo. |
| F3 | ✅ | `odin.yaml`, catálogo, `odin lint`, pacote determinístico, manifesto assinado pelo KMS, publisher que confere a assinatura, pacote adulterado recusado. A publicação é por workflow manual (`publicar-skills.yml`), não a cada merge. |
| F4 | ✅ | 7 ferramentas MCP, perfis e projetos resolvidos no servidor, roteador (95% de acerto), 100% das chamadas auditadas sem o texto dos pedidos. |
| F5 | 🟡 👤 | Feito: `setup`, `login`, `token`, `ensure` (assinatura, hashes, integridade no uso, modo degradado), `doctor`, `status`, `uninstall`, guard PG-01 a PG-08. Falta: `update`, `restore-copias`, binário do CLI e a prova no Windows nativo e no VS Code. |
| F6 | 🟡 | As 10 skills passam no `odin lint`, estão publicadas na nuvem em **rascunho (canal beta)** e têm avaliações determinísticas (10 a 13 casos cada, 100% de acerto). Falta: mover as regras dos `CLAUDE.md`, hooks como políticas do guard, pacote compartilhado das bibliotecas de terceiros, revisar as 20 intenções, avaliações **com modelo**, rodar os testes de cada skill a partir do runtime Odin. Nenhuma está em `stable`. |
| F7 | 🟡 | Feito: busca por citação, isolamento por projeto, filtro de injeção, propostas das skills com aprovação no portal. Falta: repositório `odin-knowledge` e pipeline, embeddings (Vertex AI) e a medição de recuperação, pgvector com isolamento no banco. |
| F8 | 🟡 | Feito: carga de 50 usuários (sem login p95 322 a 409 ms; autenticada p95 1259 ms, zero erros), partida a frio p95 394 ms, **disjuntor testado de verdade** (fechou o acesso externo e reabriu). Falta: painéis, alertas além do orçamento, auditoria no BigQuery, runbooks completos. |
| F9 | ⬜ 👤 | Uso real por você, como PO e como dev. |
| F10 | ⬜ 👤 | Portão 2: organização GitHub com 2FA, projeto `prod` em E1, segundo super-admin, jurídico (LGPD), pentest, guia de onboarding, repositório de suporte, ensaio do corte com 2 ou 3 pessoas. |

## 3. O que já foi homologado no Google Cloud (33 verificações, todas verdes)
H01 serviços no ar · H02 descoberta e chaves (JWKS) · H03 rotas sem token recusadas · H04 semente de catálogo e perfis · H05 publicação assinada pelo KMS · H06 publicação adulterada recusada · H07 ativação de dispositivo · H08 MCP (7 ferramentas, atalhos, roteamento, negado fora do perfil) · H09 conhecimento com citação e filtro de injeção · H10 `odin ensure` por URL assinada · H11 integridade no uso · H12 guard · H13 renovação rotativa e reuso · H14 tokens inválidos recusados · H15 modo degradado · H16 disjuntor protegido por identidade · H17 job no Cloud Run · H18 revogação em ~18 s · H19 desinstalação · H21 as 10 skills reais publicadas e conferidas · H22 a H25 portal (admin, convite, pessoa + CLI, propostas) · H26 login com GitHub · H27 as 10 skills em stable com nota ≥ 90 · H28 canais e rollback de ponta a ponta · H29 CLI assinado e `odin update` · H30 conhecimento com embeddings da Vertex AI · H31 segundo fator (TOTP, recuperação, passkey, reset) · H32 política de guard por skill no runtime assinado · H33 bibliotecas compartilhadas no runtime assinado · H20 limpeza.

Também medidos: desempenho (acima) e o **teste real do disjuntor** (execução #2 do `disjuntor-real.yml`).

## 4. Em andamento agora
Nada em andamento. Último pipeline completo (commit `b0f1be5`): qualidade, Terraform, publicação das 10 skills, homologação **33/33** e desempenho, todos verdes.

## 5. O que falta, por quem faz
**Você (ninguém mais consegue):**
1. Criar o segredo `ANTHROPIC_API_KEY` no repositório e rodar o workflow `avaliar-modelo.yml` (nota de referência da camada com modelo).
2. Trocar o `SKILLS_READ_TOKEN` e o segredo do OAuth App (ambos foram vistos no chat), rodar o `infra.yml` de novo e ligar o 2FA na conta do GitHub.
3. Testar o login no portal, o cadastro do 2º fator, a passkey do seu navegador e o `odin setup` no Windows e no VS Code.
4. F0 com o Claude Code real e o LiteLLM; F9 (uso real).
5. F10: organização GitHub, projeto `prod`, segundo super-admin, jurídico, pentest, ensaio do corte.

**Eu (Claude), quando houver decisão ou acesso:**
1. Fundir as cópias divergentes de bibliotecas do LWC Developer e do Apex Cover Loop com as canônicas (precisa comparar o comportamento).
2. Repositório `odin-knowledge` (a integração não tem permissão para criar repositórios).

## 6. Segurança e custo hoje
- Custo: estágio E0, orçamento de R$ 30 com alertas de 50% a 300%, disjuntor ensaiado.
- Sem chave de conta de serviço, sem token do GitHub no Google Cloud, segredos só no Secret Manager.
- Dois segredos expostos no chat (aguardando a sua troca): `SKILLS_READ_TOKEN` e o segredo do OAuth App.
