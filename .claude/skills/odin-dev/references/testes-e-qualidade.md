# Testes e qualidade

## Pirâmide
| Nível | O que cobre | Onde roda | Quando |
|---|---|---|---|
| **Unitário** | Funções puras: validação de JWT, avaliação de política, roteamento, lint, assinatura | CI (Linux) e local | Todo PR |
| **Contrato MCP** | Cada ferramenta: entrada válida e inválida, saída, tamanho ≤ 8.000 tokens, códigos de erro, autorização | CI com emuladores | Todo PR |
| **Integração local** | Serviços contra os **emuladores** (Firestore, Pub/Sub, Identity Platform via Firebase Local Emulator Suite) | CI e local | Todo PR |
| **Conformidade** | Regras invioláveis verificáveis (`scripts/conformidade.mjs`) | CI | Todo PR |
| **Segurança** | SAST (CodeQL), segredos (gitleaks), dependências (OSV), IaC (Checkov/tfsec), testes de autorização e de tokens | CI | Todo PR; DAST semanal |
| **Matriz do CLI e do guard** | Windows nativo (PowerShell e `cmd`), macOS e Linux | CI (`windows-latest`, `macos-latest`, `ubuntu-latest`) | Todo PR que toca `packages/cli` ou `packages/guard` |
| **Fumaça pós-deploy (GCP)** | Saúde dos serviços, MCP `initialize` + `tools/list` + `odin_rotear` com conta de teste, JWKS, portal `/entrar` | GitHub Actions logo após o deploy | Todo deploy; falha → rollback automático |
| **Sintético agendado (GCP)** | Fluxo de ponta a ponta com identidade de teste: token, roteamento, carregar skill, buscar conhecimento, auditoria registrada | Cloud Run Job + Cloud Scheduler (a cada 15 min) | Contínuo a partir da F4 |
| **Carga (GCP)** | 50 usuários simultâneos (decisão 33), SLOs do MCP e do STS | k6 a partir do CI, sob demanda | F8 e antes de liberar versões grandes |
| **Ponta a ponta do portal** | Playwright nos critérios AC-U e AC-A | CI contra emuladores; depois contra a PoC | Todo PR do portal |
| **Ponta a ponta do produto** | Uma tarefa real de cada skill pelo Odin | Máquina do mantenedor (Windows + VS Code) | F6 e F9 |

## Regras
- **Teste antes do código** para todo critério de aceite e todo bug (o teste que falha reproduz o bug).
- **Casos negativos obrigatórios** em segurança: sem token, token expirado, `alg` trocado, `aud` errado, perfil sem acesso, outro projeto, cota esgotada, refresh reutilizado.
- **Dados fictícios** sempre (`squad-atendimento`, `exemplo.com.br`); nenhuma credencial real em teste. Contas de teste do GitHub e da PoC só por variáveis do CI.
- **Relógio controlado** para TTLs, revogação e expirações.
- **Sem testes instáveis:** teste que falha de forma intermitente é corrigido ou removido com issue; nunca "rodar de novo até passar".
- **Cobertura** como sinal, não meta: todo critério de aceite tem pelo menos um teste nomeado com o id do critério (`CT-05`, `AC-U11`).

## Identidades de teste no Google Cloud
- Conta de teste dedicada (`teste-sintetico`) com perfil `dev` no squad e projeto de teste `projeto-sintetico`; nunca administrativa.
- A credencial do teste sintético fica no Secret Manager, com acesso só da conta de serviço do job, e é rotacionada mensalmente.
- Eventos de auditoria dos testes têm `ator` marcado (`sintetico`) e são filtrados dos painéis de consumo.

## Avaliações (não determinísticas)
- **Roteamento:** conjunto de 20 intenções por skill (gerado na migração, revisado pelo mantenedor); meta ≥ 90% no topo; falha bloqueia a publicação (smoke de roteamento do pipeline).
- **RAG:** perguntas com resposta esperada por coleção; meta ≥ 80% no top 5 (decisão 19); falha bloqueia o PR de conhecimento.
