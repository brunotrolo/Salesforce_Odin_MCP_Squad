# 0022. Publicação das skills reais na nuvem sem GitHub App

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F6 (adiantada), sustentação
**Documentos afetados:** docs/ESTADO.md; docs/HOMOLOGACAO.md; docs/MIGRACAO-SKILLS.md; CHANGELOG.md

## Contexto
O mantenedor pediu o GitHub App e a publicação das 10 skills reais na nuvem. Um GitHub App só se cria com confirmação humana no navegador, e 9 dos 10 repositórios das skills são públicos; só o Data Architect é privado. O Google Cloud não precisa de token do GitHub: quem lê os repositórios é o GitHub Actions.

## Decisão
1. O workflow `publicar-skills.yml` clona os repositórios públicos das skills lado a lado, roda `odin lint` em modo rascunho, empacota, assina com a chave do KMS (`bundle-signing`) e envia ao Cloud Storage; o publisher confere a assinatura e os hashes antes de registrar e promover (canal `beta`, versão `0.1.0-rascunho`).
2. O Data Architect (privado) entra no mesmo workflow quando existir o segredo `SKILLS_READ_TOKEN` (token fine-grained somente leitura de conteúdo daquele repositório). Sem ele, a skill fica de fora e o relatório diz isso.
3. O GitHub App continua previsto para a F6 completa (leitura de todos os repositórios sem segredo pessoal), mas não bloqueia a nuvem.
4. Para as skills passarem no lint, as referências acima de 8.000 tokens foram divididas e o caractere Unicode oculto removido nos próprios repositórios (Callouts e Data Architect).
5. A homologação ganha H21: confere assinatura do KMS, hashes dos pacotes e o passo `odin ensure` de cada skill real publicada.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Esperar o GitHub App | Exige ação humana no navegador; atrasaria tudo sem ganho de segurança para repositórios públicos |
| Copiar as skills para o repositório do Odin | Duplica a fonte da verdade e vazaria o Data Architect (privado) num repositório público |
| Token pessoal amplo | Mais permissão que o necessário; o token fine-grained de um só repositório basta |

## Consequências
- Melhora: 9 skills reais na nuvem, assinadas e conferidas, sem segredo novo.
- Piora ou risco: versões em rascunho no canal `beta` (só o perfil mantenedor as recebe); o Data Architect depende de um segredo criado pelo mantenedor; evals por skill seguem pendentes para chegar ao `stable`.
- Testes e aceite: `publicar-skills.yml` publica as skills que passam no lint; H21 verde.

## Segurança
Nenhuma credencial do GitHub vai ao Google Cloud; o clone dos repositórios públicos não usa token; o segredo opcional é só leitura de um repositório e só existe no GitHub. A assinatura continua sendo do KMS e conferida pelo publisher.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade: não aplicável (sem regra verificável nova)
