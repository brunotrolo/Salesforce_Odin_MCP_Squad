# Salesforce Odin MCP Squad

Um único servidor MCP para o time inteiro (POs, devs, QA, arquitetos) usar as skills de engenharia no Claude Code, com login pelo GitHub, perfis de acesso, atualização automática, runtime local assinado e base de conhecimento (RAG), governado no Google Cloud.

> **Status:** plano e arquitetura. Nada foi desenvolvido ainda.

| Documento | Conteúdo |
|---|---|
| 📐 [Plano](docs/PLANO.md) | Visão geral, fases de construção, riscos, revisões |
| 🎬 [Apresentação interativa](apresentacao/odin-apresentacao.html) | Visão lúdica para apresentar: ideia, mapa, publicação, pedido de ponta a ponta, segurança, conhecimento, protótipo do portal e roteiro (arquivo completo para baixar e abrir no navegador, inclusive no celular; o index.html é a versão publicada como página) |
| ✅ [Decisões](docs/DECISOES.md) | As 48 decisões que fecham as lacunas (valem sobre o resto) |
| 🧭 [01 Arquitetura de solução](docs/arquitetura/01-arquitetura-de-solucao.md) | Princípios, contexto, contêineres, decisões (ADRs), fluxos, escala, ambientes |
| 🧩 [02 Arquitetura funcional](docs/arquitetura/02-arquitetura-funcional.md) | Atores, capacidades, casos de uso, modelo de acesso, regras, requisitos |
| ⚙️ [03 Arquitetura técnica](docs/arquitetura/03-arquitetura-tecnica.md) | Recursos do Google Cloud, onde fica cada dado, autenticação, orquestrador, integração com o GitHub, segurança, IaC, custos |
| 🔐 [04 Portal e perfilamento](docs/arquitetura/04-portal-e-perfilamento.md) | Portal do usuário e console de administração, papéis, matriz de permissões, fluxos |
| 💰 [05 Custos e FinOps](docs/arquitetura/05-custos-e-finops.md) | Estágios de custo (E0, E1, E2), gatilhos para cada recurso pago, modelo de custo, teto de instâncias e disjuntor |
| 📜 [Contratos](schemas/README.md) | Schemas verificáveis: `odin.yaml`, manifesto assinado, avaliações, auditoria, as 7 ferramentas MCP e a API `/v1` |
| 🗂️ [Registro de decisões (ADRs)](docs/adr/README.md) | Por que cada coisa é como é, depois da linha de base |
| 🖥️ [Portal](docs/portal/README.md) | Área do usuário, guia do MCP (ferramentas, conexão, autenticação, consumo), console de administração, consumo e cotas, ciclo de vida das skills, UX, API e critérios de aceite |
| 🛡️ [Segurança](docs/seguranca/README.md) | Modelo de ameaças, autenticação e MFA, tokens e refresh, autorização, cadeia de suprimentos, máquina do usuário, infraestrutura, LGPD, resposta a incidentes, controles e runbooks |

**Quanto custa:** até US$ 3 por mês na prova de conceito e até US$ 25 por mês com o time (3 serviços e 3 jobs no Cloud Run, todos com escala a zero). Recursos de custo fixo só entram por gatilho medido, e um disjuntor fecha o acesso se o gasto disparar.

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

**Garantias em código:** o hook `guard-docs` bloqueia a edição dos documentos de referência sem um ADR aberto (`node scripts/adr.mjs novo "título"`); o CI roda os testes (Linux e Windows), as verificações de documentação, skills, contratos e conformidade de segurança e de custo (inclusive caracteres Unicode ocultos), e recusa mudança em documento protegido sem ADR. Como contribuir: [CONTRIBUTING.md](CONTRIBUTING.md). Segurança: [SECURITY.md](SECURITY.md). Mudanças: [CHANGELOG.md](CHANGELOG.md).

```bash
npm ci                           # dependências de desenvolvimento (validação dos contratos)
npm test                         # testes dos scripts, do hook e dos contratos
npm run verificar                # documentação + skills + contratos + conformidade
node scripts/sessao.mjs inicio   # resumo para começar uma sessão
node scripts/adr.mjs listar      # decisões registradas
```

