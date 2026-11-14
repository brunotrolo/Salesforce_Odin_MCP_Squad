# Salesforce Odin MCP Squad

Um único servidor MCP para o time inteiro (POs, devs, QA, arquitetos) usar as skills de engenharia no Claude Code, com login pelo GitHub, perfis de acesso, atualização automática, runtime local assinado e base de conhecimento (RAG), governado no Google Cloud.

> **Status:** plano e arquitetura. Nada foi desenvolvido ainda.

| Documento | Conteúdo |
|---|---|
| 📐 [Plano](docs/PLANO.md) | Visão geral, fases de construção, riscos, revisões |
| 🧭 [01 Arquitetura de solução](docs/arquitetura/01-arquitetura-de-solucao.md) | Princípios, contexto, contêineres, decisões (ADRs), fluxos, escala, ambientes |
| 🧩 [02 Arquitetura funcional](docs/arquitetura/02-arquitetura-funcional.md) | Atores, capacidades, casos de uso, modelo de acesso, regras, requisitos |
| ⚙️ [03 Arquitetura técnica](docs/arquitetura/03-arquitetura-tecnica.md) | Recursos do Google Cloud, onde fica cada dado, autenticação, orquestrador, integração com o GitHub, segurança, IaC, custos |
| 🔐 [04 Portal e perfilamento](docs/arquitetura/04-portal-e-perfilamento.md) | Portal do usuário e console de administração, papéis, matriz de permissões, fluxos |
| 🛡️ [Segurança](docs/seguranca/README.md) | Modelo de ameaças, autenticação e MFA, tokens e refresh, autorização, cadeia de suprimentos, máquina do usuário, infraestrutura, LGPD, resposta a incidentes, controles e runbooks |

**Em uma frase:** a pessoa entra com o GitHub, ativa o CLI uma vez e passa a pedir em linguagem natural; o Odin identifica quem é, escolhe a skill que ela pode usar, entrega a versão aprovada mais recente, garante o runtime e os hooks de segurança atualizados na máquina, e responde com conhecimento citado.

Skills cobertas: Discovery-to-Backlog, Journey Designer, Journey Developer, Data Architect e Test Automator.
