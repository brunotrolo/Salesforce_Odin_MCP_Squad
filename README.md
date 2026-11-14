# Salesforce Odin MCP Squad

Um único servidor MCP para o time inteiro (POs, devs, QA, arquitetos) usar as skills de engenharia no Claude Code, com login pelo GitHub, perfis de acesso, atualização automática, runtime local assinado e base de conhecimento (RAG), governado no Google Cloud.

> **Status:** plano e arquitetura. Nada foi desenvolvido ainda.

| Documento | Conteúdo |
|---|---|
| 📐 [Plano](docs/PLANO.md) | Visão geral, fases de construção, riscos, revisões |
| 🎬 [Apresentação interativa](apresentacao/odin-apresentacao.html) | Visão lúdica para apresentar: ideia, mapa, publicação, pedido de ponta a ponta, segurança, conhecimento, protótipo do portal e roteiro (arquivo completo para baixar e abrir no navegador, inclusive no celular; o index.html é a versão publicada como página) |
| ✅ [Decisões](docs/DECISOES.md) | As 41 decisões do mantenedor que fecham as lacunas (valem sobre o resto) |
| 🧭 [01 Arquitetura de solução](docs/arquitetura/01-arquitetura-de-solucao.md) | Princípios, contexto, contêineres, decisões (ADRs), fluxos, escala, ambientes |
| 🧩 [02 Arquitetura funcional](docs/arquitetura/02-arquitetura-funcional.md) | Atores, capacidades, casos de uso, modelo de acesso, regras, requisitos |
| ⚙️ [03 Arquitetura técnica](docs/arquitetura/03-arquitetura-tecnica.md) | Recursos do Google Cloud, onde fica cada dado, autenticação, orquestrador, integração com o GitHub, segurança, IaC, custos |
| 🔐 [04 Portal e perfilamento](docs/arquitetura/04-portal-e-perfilamento.md) | Portal do usuário e console de administração, papéis, matriz de permissões, fluxos |
| 🖥️ [Portal](docs/portal/README.md) | Área do usuário, guia do MCP (ferramentas, conexão, autenticação, consumo), console de administração, consumo e cotas, ciclo de vida das skills, UX, API e critérios de aceite |
| 🛡️ [Segurança](docs/seguranca/README.md) | Modelo de ameaças, autenticação e MFA, tokens e refresh, autorização, cadeia de suprimentos, máquina do usuário, infraestrutura, LGPD, resposta a incidentes, controles e runbooks |

**Em uma frase:** a pessoa entra com o GitHub, ativa o CLI uma vez e passa a pedir em linguagem natural; o Odin identifica quem é, escolhe a skill que ela pode usar, entrega a versão aprovada mais recente, garante o runtime e os hooks de segurança atualizados na máquina, e responde com conhecimento citado.

Skills cobertas: Discovery-to-Backlog, Journey Designer, Journey Developer, Data Architect e Test Automator.

## Desenvolvimento e sustentação (com o Claude Code)

Abra este repositório no Claude Code e diga, por exemplo, **"continue o Odin"**. As instruções (`CLAUDE.md`), o estado (`docs/ESTADO.md`), as skills e os agentes carregam sozinhos.

| Skill | Para quê |
|---|---|
| `/odin-dev` | Construir por fases (F0 a F10), corrigir bugs, fazer melhorias e verificar, com testes e revisores independentes |
| `/odin-curador` | Incluir ou ajustar uma skill no catálogo do Odin |
| `/odin-arquiteto` | Tirar dúvida de arquitetura ou mudar uma decisão (por ADR) |
| `/odin-operacao` | Incidentes, revogações, rotação de chaves e runbooks |

Agentes independentes (somente leitura): `odin-revisor-arquitetura`, `odin-revisor-seguranca`, `odin-revisor-testes`, `odin-revisor-documentacao` e `odin-auditor`.

**Garantias em código:** o hook `guard-docs` bloqueia a edição dos documentos de referência sem um ADR aberto (`node scripts/adr.mjs novo "título"`); o CI roda os testes (Linux e Windows), as verificações de documentação, skills e conformidade, e recusa mudança em documento protegido sem ADR.

```bash
npm test                         # testes dos scripts e do hook
npm run verificar                # documentação + skills + conformidade
node scripts/sessao.mjs inicio   # resumo para começar uma sessão
node scripts/adr.mjs listar      # decisões registradas
```

