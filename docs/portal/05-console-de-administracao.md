# 05. Console de administração

> [Índice do portal](README.md) · Todas as telas exigem MFA com menos de 15 min; papéis administrativos exigem passkey ([segurança 02](../seguranca/02-autenticacao-e-mfa.md)).

> **Situação (2026-11-16, ADR 0023):** versão interina no ar em `/admin`, com entrada pelo segredo de administração (sessão de 2 h, CSRF em todo formulário). Telas disponíveis: painel, pessoas (criar, suspender, reativar, convite), dispositivos (revogar), skills e versões, propostas de conhecimento (aprovar/rejeitar) e revogação global. Passkey, MFA e papéis administrativos separados ficam para o login com GitHub.

## 1. Quem vê o quê no menu

| Menu | super-admin | admin-identidade | admin-catalogo | gestor-squad | curador | auditor |
|---|---|---|---|---|---|---|
| Painel | ✅ | ✅ | ✅ | ✅ (do squad) | ✅ (da coleção) | ✅ |
| Pessoas | ✅ | ✅ | 👁 | 🔸 | — | 👁 |
| Squads | ✅ | ✅ | 👁 | 🔸 | — | 👁 |
| Projetos | ✅ | ✅ | 👁 | 👁 (os seus) | 👁 | 👁 |
| Perfis | ✅ | 👁 | ✅ | 👁 | — | 👁 |
| Solicitações | ✅ | ✅ | ✅ (skills) | 🔸 | 🔸 (coleções) | 👁 |
| Catálogo e histórico | ✅ | 👁 | ✅ | 👁 | 👁 | 👁 |
| Consumo e cotas | ✅ | 👁 | ✅ | 🔸 (consumo do squad) | — | 👁 |
| Conhecimento | ✅ | — | — | — | 🔸 | 👁 (metadados) |
| Segurança | ✅ | ✅ (sem a global) | — | — | — | 👁 |
| Auditoria | ✅ | 🔸 | 🔸 | 🔸 | 🔸 | ✅ |
| Saúde | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Configurações | ✅ (quatro olhos) | — | — | — | — | 👁 |

## 2. Painel (`/admin`)
Cartões conforme o papel:
- **Pessoas:** ativas, convites pendentes, suspensas no mês; dispositivos ativos; tokens pessoais ativos (com destaque para os que vencem em 7 dias).
- **Consumo:** requisições hoje e no mês, top 5 pessoas, skills e ferramentas, taxa de erro, cotas acima de 80%.
- **Catálogo:** skills ativas, versões publicadas nos últimos 7 dias, versões em `beta` aguardando promoção, depreciações próximas.
- **Pendências:** solicitações, aprovações a quatro olhos, propostas de conhecimento, revisão trimestral de acessos.
- **Segurança:** alertas abertos por severidade, último uso da conta de emergência.

## 3. Pessoas (`/admin/pessoas`)
**Lista:** busca por nome ou login do GitHub; filtros por squad, perfil, papel administrativo, status (ativa, convidada, suspensa, saiu), último acesso, "sem MFA forte" e "com token pessoal".

**Ficha da pessoa** (abrir gera auditoria):
| Aba | Conteúdo | Ações |
|---|---|---|
| Resumo | Login e id do GitHub, nome, status, criado em, último acesso, fatores de MFA (tipos, sem segredos) | Suspender, reativar (motivo) |
| Acesso | Pertenças (squad × perfis × origem portal ou GitHub), concessões com prazo, **direitos efetivos** calculados (skills e coleções por projeto) | Alterar perfis numa pertença, remover do squad, encerrar concessão |
| Dispositivos | Lista com sistema, versão do CLI, último uso, IP, local | **Revogar** um ou todos (motivo) |
| Tokens pessoais | Prefixo, criado, expira, último uso, IP do último uso | **Revogar** |
| Consumo | Requisições 30 dias por dia, skill e ferramenta; erros; cota | Ajustar cota individual (admin-catalogo) |
| Papéis administrativos | Papéis e escopos | Pedir inclusão ou remoção (quatro olhos) |
| Linha do tempo | Auditoria da pessoa (logins, ativações, mudanças de acesso, chamadas resumidas) | Exportar |

**Ações em massa** (admin-identidade): revogar dispositivos de várias pessoas, suspender pessoas de um squad, sempre com motivo e confirmação digitada.

## 4. Squads (`/admin/squads`) e Projetos (`/admin/projetos`)
- **Squad:** nome, projetos atendidos, **perfis permitidos**, gestores, time do GitHub mapeado (quando houver organização), membros (com perfis e origem), consumo do squad.
  - Ações: criar, editar, incluir membro (por login do GitHub, resolvido para o id), remover membro, mudar perfis de um membro, mapear time do GitHub.
- **Projeto:** nome, cliente, classificação (interna, confidencial), squads que atendem, coleções de conhecimento do projeto.
  - Ações: criar, editar, arquivar, **expurgar** (runbook RB-11, quatro olhos).

## 5. Perfis (`/admin/perfis`)
**Matriz** editável: linhas = perfis de uso; colunas = skills (com o canal permitido: `stable` ou `stable + beta`) e coleções (nível `ler`, `propor` ou `curar`).
- Mostra, antes de salvar, **quem será afetado**: "esta mudança altera o acesso de 14 pessoas em 3 squads", com a lista.
- Salvar gera uma nova **versão da política** (incrementa o `policyVersion` dos afetados) e o evento `perfil_alterado` no histórico do catálogo ([07](07-ciclo-de-vida-das-skills.md)).
- Histórico da matriz: quem mudou, quando, antes e depois, com opção de restaurar uma versão anterior (que é uma nova mudança).

## 6. Solicitações (`/admin/solicitacoes`)
Fila com: pessoa, o que pediu, projeto, motivo, prazo, há quanto tempo está pendente. **Aprovar** (com a opção de reduzir o prazo) ou **Recusar** (motivo obrigatório). O botão não aparece para o próprio solicitante. Aprovações a quatro olhos (papéis administrativos, configurações) aparecem numa aba separada.

## 7. Catálogo (`/admin/catalogo`)
- **Lista de skills:** nome, domínio, dono, estado (`ativa`, `beta`, `depreciada`, `retirada`), versão em `stable` e em `beta`, data da última mudança, pessoas com acesso, uso em 30 dias.
- **Ficha da skill**, com abas:
  - **Visão geral:** descrição, intenções de exemplo, pré-requisitos, perfis que dão acesso, coleções usadas;
  - **Versões:** por canal, com SHA, data, assinatura (`kid`), links do PR e do pipeline;
  - **Histórico:** linha do tempo completa ([07](07-ciclo-de-vida-das-skills.md));
  - **Comparar:** diferenças entre duas versões;
  - **Uso:** pessoas, squads, requisições por versão, erros antes e depois de cada mudança;
  - **Ações:** **Abrir PR de promoção**, **Abrir PR de rollback**, **Abrir PR de depreciação ou retirada**. O portal monta o PR no repositório Odin pelo GitHub App e mostra o link; a mudança só acontece no merge (GitOps).
- **Versões proibidas:** lista assinada (só leitura no portal; inclusão por runbook RB-09).

## 8. Consumo e cotas (`/admin/consumo`)
Ver [06](06-consumo-cotas-e-metricas.md) para as definições. Telas:
- **Visão geral:** requisições por período; por ferramenta; por skill; por squad; taxa de erro e de `negado`; latência p95.
- **Ranking:** pessoas, squads e skills por consumo, com variação em relação ao período anterior e marca de anomalia.
- **Detalhe:** filtro por pessoa, squad, skill, ferramenta, resultado e período; tabela das chamadas (sem conteúdo).
- **Cotas** (`/admin/consumo/cotas`): padrão por perfil; exceções por squad e por pessoa, com prazo; histórico de mudanças.
- **Exportar:** CSV (com limite de linhas e auditoria).

## 9. Conhecimento (`/admin/conhecimento`)
Fila por coleção e projeto (o curador só vê a sua): proposta, origem (skill ou pessoa), fonte, itens parecidos já existentes. **Aprovar** (o portal abre o PR no `odin-knowledge` pelo GitHub App), **Pedir ajuste** ou **Recusar** (motivo). Também mostra as **lacunas**: buscas sem resultado, agrupadas por tema.

## 10. Segurança (`/admin/seguranca`)
- **Alertas** (detecções DT-01 a DT-19 de [segurança 09](../seguranca/09-deteccao-e-resposta.md)): severidade, pessoa, quando, estado (aberto, em análise, resolvido) e ações sugeridas (revogar, suspender).
- **Sessões e dispositivos ativos:** busca e revogação.
- **Tokens pessoais:** todos os ativos, com destaque para os sem uso recente ou com IP novo.
- **Revogação em massa:** por squad, por projeto ou por versão do CLI.
- **Revogação global** (super-admin): passkey, motivo, confirmação digitada e segunda aprovação (ou modo emergência com alerta).

## 11. Auditoria (`/admin/auditoria`)
Busca por pessoa, ação, alvo, resultado e período; detalhe com antes e depois; exportação. Cada papel vê o seu recorte (o auditor vê tudo).

## 12. Saúde (`/admin/saude`)
Disponibilidade e latência por serviço (com a partida a frio separada), erros, versões do CLI e dos runtimes em uso (deriva), guard inativo por máquina, acerto do roteamento, lacunas de conhecimento.

**Cartão de custo** (ADR 0018): estágio atual (E0, E1 ou E2), gasto do mês contra a meta do estágio, estado do disjuntor (armado ou acionado) e os gatilhos medidos para o próximo estágio (partida a frio, picos de recusa por IP, recuperação do RAG). O valor vem da exportação de faturamento para o BigQuery; sem ela, o cartão mostra só a meta e o link para o console de faturamento.

## 13. Configurações (`/admin/configuracoes`)
Validades (sessão, token, dispositivo), limites e cotas padrão, provedores de login, regras de MFA, mensagem de manutenção. Toda mudança é um pedido a quatro olhos.
