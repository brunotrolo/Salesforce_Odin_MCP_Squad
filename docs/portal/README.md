# Portal Odin

> O portal `odin.<dominio>` é onde as pessoas **entram, conectam e entendem** o MCP Odin, e onde os administradores **governam** acessos, perfis, catálogo de skills, consumo e segurança.
> Complementa a [arquitetura](../arquitetura/01-arquitetura-de-solucao.md) e a [segurança](../seguranca/README.md). **Para o portal, vale esta pasta.**
> **Status:** desenho, nada foi desenvolvido.

## Documentos

| # | Documento | Conteúdo |
|---|---|---|
| 01 | [Arquitetura de solução do portal](01-arquitetura-de-solucao.md) | Contexto, componentes, fontes de dados, tecnologia, segurança, mapa do site |
| 02 | [Arquitetura funcional do portal](02-arquitetura-funcional.md) | Personas, jornadas, capacidades, casos de uso, regras de negócio |
| 03 | [Área do usuário](03-area-do-usuario.md) | Cada página de quem consome o MCP: o que mostra, o que permite, estados e mensagens |
| 04 | [Guia do MCP para o usuário](04-guia-do-mcp.md) | O que é o MCP Odin, ferramentas, como conectar no Claude Code, autenticação, consumo, problemas comuns |
| 05 | [Console de administração](05-console-de-administracao.md) | Pessoas, squads, projetos, perfis, solicitações, revogação, conhecimento, segurança, auditoria, configurações |
| 06 | [Consumo, cotas e métricas](06-consumo-cotas-e-metricas.md) | O que é medido, como, onde, com que atraso; cotas por perfil; painéis do administrador e do usuário |
| 07 | [Ciclo de vida das skills no catálogo](07-ciclo-de-vida-das-skills.md) | Quando uma skill entrou, foi atualizada, promovida, voltada, depreciada ou retirada; histórico e avisos |
| 08 | [UX e design](08-ux-e-design.md) | Navegação, layout, componentes, estados, acessibilidade, textos, notificações |
| 09 | [Contratos de dados e API do portal](09-contratos-e-api.md) | Cada tela → endpoint → permissão → fonte de dados |
| 10 | [Critérios de aceite e testes](10-criterios-de-aceite.md) | O que precisa funcionar para o portal ser entregue |

## O portal em uma tela

| Para quem | O que encontra |
|---|---|
| **Quem consome o MCP** (PO, dev, QA, arquiteto) | Entrar com GitHub + MFA · conectar o Claude Code em 3 passos · ver as **ferramentas do MCP** e as **skills** que pode usar · ver o **próprio consumo** · gerenciar dispositivos e tokens · pedir acesso · acompanhar o que mudou nas skills |
| **Gestor de squad** | Tudo acima + membros do squad, perfis, aprovações e consumo do squad |
| **Administradores** | Pessoas, squads, projetos, **perfis**, **revogação**, **consumo de requisições** por pessoa, squad, skill e ferramenta, **cotas**, **histórico do catálogo** (entrada, atualização, alteração, retirada), conhecimento, segurança, auditoria e configurações |
| **Auditor** | Leitura de tudo, auditoria e exportação |
