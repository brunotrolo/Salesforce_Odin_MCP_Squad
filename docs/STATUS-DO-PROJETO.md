# Status do projeto: o plano, o que foi feito, o que foi homologado e o que falta

Atualizado em 2026-11-16. Fonte do plano: [PLANO.md](PLANO.md) (seção 16, fases F0 a F10). Resultados medidos: [HOMOLOGACAO.md](HOMOLOGACAO.md). Estado corrente: [ESTADO.md](ESTADO.md).

**Em uma frase:** o núcleo da prova de conceito (fases F1, F3, F4 e a maior parte de F2, F5 e F8) está **construído e homologado no Google Cloud**; falta terminar a adaptação definitiva das skills (F6), o conhecimento (F7), parte da operação (F8) e tudo o que depende de você ou de decisão externa (F0 com o Claude Code real, F9, F10).

## 1. O plano completo (11 fases)
| Fase | O que entrega |
|---|---|
| F0 | Verificações com o Claude Code real (Windows nativo, VS Code, LiteLLM) e ferramentas de manutenção |
| F1 | Projeto Google Cloud, Terraform, identidade federada, orçamento com disjuntor, Cloud Run |
| F2 | Identidade: login, segundo fator, emissor de tokens, dispositivos, revogação, portal |
| F3 | Catálogo, `odin.yaml`, `odin lint`, publicação assinada, canais |
| F4 | Servidor MCP: ferramentas, autorização por perfil e projeto, auditoria |
| F5 | Runtime local: CLI, guard, `odin ensure`, desinstalação |
| F6 | Adaptação das 10 skills (checklist do `odin-curador`, evals) |
| F7 | Conhecimento (RAG) com citação, projetos isolados, curadoria |
| F8 | Operação: carga, partida a frio, ensaio do disjuntor, painéis, runbooks |
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

## 3. O que já foi homologado no Google Cloud (26 verificações, todas verdes)
H01 serviços no ar · H02 descoberta e chaves (JWKS) · H03 rotas sem token recusadas · H04 semente de catálogo e perfis · H05 publicação assinada pelo KMS · H06 publicação adulterada recusada · H07 ativação de dispositivo · H08 MCP (7 ferramentas, atalhos, roteamento, negado fora do perfil) · H09 conhecimento com citação e filtro de injeção · H10 `odin ensure` por URL assinada · H11 integridade no uso · H12 guard · H13 renovação rotativa e reuso · H14 tokens inválidos recusados · H15 modo degradado · H16 disjuntor protegido por identidade · H17 job no Cloud Run · H18 revogação em ~18 s · H19 desinstalação · H21 as 10 skills reais publicadas e conferidas · H22 a H25 portal (admin, convite, pessoa + CLI, propostas) · H26 login com GitHub · H20 limpeza.

Também medidos: desempenho (acima) e o **teste real do disjuntor** (execução #2 do `disjuntor-real.yml`).

## 4. Em andamento agora
Troca do papel **Owner** de `sa-ci-infra` por papéis mínimos (ADR 0025): o Owner já foi removido; falta confirmar que o `infra.yml` e a homologação continuam verdes sem ele e então aceitar o ADR.

## 5. O que falta, por quem faz
**Você (ninguém mais consegue):**
1. Trocar o `SKILLS_READ_TOKEN` e o segredo do OAuth App (ambos foram vistos no chat) e ativar a verificação em duas etapas na sua conta do GitHub.
2. Testar o login no portal e o `odin setup` no Windows e no VS Code.
3. F0 com o Claude Code real e o LiteLLM; F9 (uso real).
4. F10: organização GitHub, projeto `prod`, segundo super-admin, jurídico, pentest, ensaio do corte.

**Eu (Claude), sem depender de você:**
1. Fechar o ADR 0025 e confirmar o pipeline sem Owner.
2. F6: checklist do `odin-curador` nas 10 skills (regras dos `CLAUDE.md`, hooks como políticas, bibliotecas compartilhadas, intenções) e avaliações com modelo, que dependem do seu acesso ao modelo para rodar.
3. F7: `odin-knowledge`, embeddings e medição de recuperação.
4. F8: painéis, alertas, auditoria no BigQuery, runbooks.
5. F5: `update`, `restore-copias`, binário do CLI.
6. F2: TOTP, passkey e códigos de recuperação (ou decisão formal de manter o 2FA do GitHub).

## 6. Segurança e custo hoje
- Custo: estágio E0, orçamento de R$ 30 com alertas de 50% a 300%, disjuntor ensaiado.
- Sem chave de conta de serviço, sem token do GitHub no Google Cloud, segredos só no Secret Manager.
- Dois segredos expostos no chat (aguardando a sua troca): `SKILLS_READ_TOKEN` e o segredo do OAuth App.
