# 01. Arquitetura de solução

> Parte da série de arquitetura do Odin MCP Squad: **01 Solução** · [02 Funcional](02-arquitetura-funcional.md) · [03 Técnica](03-arquitetura-tecnica.md) · [04 Portal e perfilamento](04-portal-e-perfilamento.md) · [05 Custos](05-custos-e-finops.md). Base: [plano](../PLANO.md).
> **Status:** desenho, nada foi desenvolvido. [VERIFICAR] = ponto a confirmar na prova de conceito (fase F0 do plano).

## 1. Propósito

O Odin entrega, a qualquer pessoa autorizada do time (PO, dev, QA, arquiteto), as skills e os agentes de engenharia de software hospedados no GitHub. O ponto de acesso é um único servidor MCP. O Odin cuida de:
- **identidade:** quem é a pessoa, via login com GitHub;
- **autorização:** o que ela pode usar, por perfil, squad e projeto;
- **orquestração:** qual skill atende ao pedido e qual vem depois;
- **distribuição:** versão aprovada, assinada e atualizada sozinha;
- **conhecimento:** RAG funcional, técnico e de regra de negócio, com citação;
- **governança:** auditoria, revogação e administração centralizada no Google Cloud.

O trabalho em si (ler e escrever arquivos, rodar scripts, Playwright, `sf` CLI) continua **na máquina do usuário**, dentro do Claude Code.

## 2. Princípios de arquitetura

| # | Princípio | Consequência |
|---|---|---|
| P1 | **GitHub é a fonte da verdade do conteúdo; o Google Cloud é a fonte da verdade do acesso** | Skills, agentes, regras e conhecimento mudam por pull request. Quem acessa o quê muda no portal, com auditoria |
| P2 | **Negado por padrão** | Sem perfil ou concessão explícita, não há skill, coleção nem pacote |
| P3 | **Segurança em código, não em instrução** | O `odin-guard` (hook assinado) é a fronteira na máquina; o texto entregue ao modelo nunca é a única proteção |
| P4 | **Confiança verificável** | Pacotes assinados (Cloud KMS) e conferidos pelo CLI com a chave pública embutida; quem compromete o servidor não forja pacote |
| P5 | **Credenciais curtas e ligadas ao dispositivo** | Token de acesso de 15 min; renovação exige a chave privada do dispositivo |
| P6 | **Serviços sem estado, dados gerenciados** | Cloud Run escala horizontalmente; Firestore, Cloud SQL e Cloud Storage guardam o estado |
| P7 | **Nada sobrepõe o projeto do dev** | O Odin só escreve em pastas e blocos próprios do usuário (plano, seção 22) |
| P8 | **Fricção mínima** | 3 passos de onboarding, 0 passos de manutenção |
| P9 | **Tudo como código** | Terraform para a infraestrutura, GitOps para o catálogo e o conhecimento, políticas com testes |
| P10 | **Mínimo privilégio e separação de funções** | Uma conta de serviço por componente; quem implanta não assina; quem administra não aprova o próprio acesso |
| P11 | **Custo proporcional ao uso** | Tudo escala a zero; recurso com custo fixo só entra por gatilho medido; teto de instâncias e disjuntor de custo ([05 Custos](05-custos-e-finops.md)) |
| P12 | **Contratos como código** | `odin.yaml`, manifesto, ferramentas MCP e API `/v1` têm schema em `schemas/`, validado no CI |

## 3. Contexto (visão C4, nível 1)

```mermaid
flowchart TB
  subgraph Pessoas
    U["Usuário do squad<br/>PO · Dev · QA · Arquiteto"]
    GS["Gestor de squad"]
    AD["Administradores<br/>(identidade, catálogo, segurança)"]
    CU["Curador de conhecimento"]
    MT["Mantenedor de skills"]
    AU["Auditor"]
  end
  ODIN(["Odin MCP Squad<br/>(Google Cloud)"])
  CC["Claude Code<br/>terminal · VS Code"]
  GH["GitHub<br/>repos de skills, catálogo, conhecimento<br/>login (OAuth), times, Actions"]
  LL["LiteLLM → modelos Claude"]
  SF["Orgs Salesforce<br/>(sandbox)"]

  U -- "pede tarefas" --> CC
  CC -- "MCP + Bearer" --> ODIN
  CC -- "inferência" --> LL
  CC -- "sf CLI / navegador<br/>(na máquina)" --> SF
  U & GS & AD & CU & AU -- "portal (SSO GitHub)" --> ODIN
  MT -- "pull requests" --> GH
  GH -- "Actions via Workload Identity<br/>(publicação)" --> ODIN
  ODIN -- "GitHub App<br/>(times, conteúdo, PRs; varredura de 15 min)" --> GH
```

**Fora do Odin, de propósito:** a inferência dos modelos (continua no LiteLLM), o acesso às orgs Salesforce (continua na máquina, com as credenciais do dev) e o código dos projetos (nunca sai da máquina para o Odin).

## 4. Contêineres (visão C4, nível 2)

```mermaid
flowchart LR
  subgraph Maquina["Máquina do usuário"]
    CC["Claude Code"]
    CLI["odin CLI<br/>(device login, token, ensure, doctor)"]
    GRD["odin-guard<br/>(hook PreToolUse)"]
    RT["~/.odin<br/>runtime · políticas · ODIN.md"]
  end

  subgraph Servicos["Serviços (Cloud Run, escala a zero)"]
    MCP["odin-mcp<br/>MCP Streamable HTTP + API /v1<br/>(orquestrador)"]
    STS["odin-sts<br/>emissor de tokens<br/>device flow · JWKS"]
    POR["odin-portal<br/>UI + BFF admin"]
  end

  subgraph Jobs["Jobs (Cloud Run, uma imagem)"]
    PUB["odin-publisher<br/>confere assinatura e registra"]
    IDX["odin-indexer<br/>ingestão do RAG"]
    JOB["odin-jobs<br/>rotinas a cada 15 min"]
  end

  subgraph Dados["Dados e segurança"]
    FS[("Firestore<br/>identidade · acesso · catálogo<br/>RAG e roteamento")]
    SQL[("Cloud SQL Postgres + pgvector<br/>só com conhecimento confidencial")]
    GCS[("Cloud Storage<br/>pacotes assinados")]
    BQ[("BigQuery<br/>auditoria · métricas")]
    KMS["Cloud KMS<br/>assinatura · JWT"]
    SM["Secret Manager"]
    IDP["Identity Platform<br/>(provedor GitHub)"]
    VX["Vertex AI<br/>embeddings"]
  end

  subgraph Custo["Teto de custo"]
    TICK["odin-tick<br/>(Scheduler)"]
    DJ["orçamento → odin-disjuntor"]
  end

  GH["GitHub"]

  CC -->|MCP + Bearer| MCP
  CLI -->|device flow, token| STS
  CLI -->|/v1| MCP
  CLI -->|URL assinada| GCS
  MCP --> FS & GCS & VX
  MCP -.-> SQL
  STS --> FS & KMS
  POR --> FS & IDP & BQ
  POR -.->|aprova ativação via Firestore| FS
  GH -->|Actions + identidade federada: assina e envia| GCS & KMS
  GH -->|Actions executa| PUB
  PUB --> FS & GCS & VX
  TICK --> JOB
  JOB --> FS & GH
  JOB -->|se o conhecimento mudou| IDX
  IDX --> FS & VX & GH
  IDX -.-> SQL
  DJ -.->|300% do orçamento: fecha o ingress| MCP & STS & POR
  MCP & STS & POR & PUB & IDX & JOB -.->|logs| BQ
```

Em E0 e E1 não há borda dedicada: os serviços usam os endereços `run.app`. Load Balancer, Cloud Armor e `odin-webhooks` só entram no estágio E2, por gatilho ([05 Custos](05-custos-e-finops.md)).

| Contêiner | Papel | Exposição |
|---|---|---|
| `odin-mcp` | **Orquestrador.** Valida o token, resolve os direitos, roteia o pedido para a skill, entrega skill, referências e agentes, busca conhecimento e audita. Também serve a API REST `/v1` usada pelo CLI | Pública (`run.app`), toda rota com token |
| `odin-sts` | Emissor de tokens: device flow (RFC 8628), credencial de dispositivo, token de acesso (JWT), revogação, chaves públicas (JWKS) | Pública (`run.app`) |
| `odin-portal` | Interface para usuários e administradores, com backend (BFF) para a API administrativa | Pública (`run.app`) |
| `odin-publisher` | Job executado pelo pipeline: **confere a assinatura do manifesto** e só então registra a versão no catálogo e o índice de roteamento | Sem porta; execução por IAM, só pela conta de assinatura do CI |
| `odin-indexer` | Job de ingestão do conhecimento (divisão, máscara de PII, embeddings) | Sem porta; executado pelo `odin-jobs` ou pelo portal |
| `odin-jobs` | Job de rotinas, a cada 15 min: sincronizar times do GitHub, expirar concessões, detectar mudança no conhecimento, teste sintético, agregados, exportações, relatório do auditor | Sem porta; executado pelo `odin-tick` |
| `odin-disjuntor` | Função que fecha o ingress dos serviços quando o gasto chega a 300% do orçamento | Sem porta; acionada pelo aviso de orçamento |

## 5. Decisões de arquitetura (ADRs resumidos)

| ADR | Decisão | Alternativas consideradas | Motivo |
|---|---|---|---|
| ADR-01 | **Login com GitHub** (SSO), via Identity Platform | Google ou Microsoft como provedor principal; contas próprias | O time já tem GitHub; dá para ligar acesso a times do GitHub; o Identity Platform permite acrescentar Google ou Microsoft sem mudar o resto |
| ADR-02 | Identidade pelo **id numérico do GitHub**, não pelo login | Login (`@usuario`) ou e-mail | O login pode ser renomeado e o e-mail pode ser privado; o id numérico é estável |
| ADR-03 | **Device flow próprio** (RFC 8628) com página de ativação no portal, e credencial de dispositivo **ligada a uma chave do dispositivo** | Device flow do próprio GitHub; token copiado do portal | Um só fluxo, independente do provedor; a credencial roubada não serve sem a chave privada que fica no cofre do sistema |
| ADR-04 | Token de acesso **Bearer JWT de 15 min** entregue ao Claude Code pelo `headersHelper` | Token de longa duração; OAuth nativo do MCP | O `headersHelper` é renovado sozinho (confirmado na documentação); OAuth do MCP fica como evolução (ADR-12) |
| ADR-05 | **Direitos resolvidos no servidor** a cada chamada (cache de 30 s), não gravados no token | Perfis dentro do JWT | Mudança de acesso no portal vale em até 30 s, sem esperar o token expirar |
| ADR-06 | **MCP sem estado** (Streamable HTTP, resposta JSON, sem fluxo SSE permanente) no Cloud Run | Sessões com afinidade; fluxo SSE aberto | Escala horizontal e **a zero**; reinício de instância não derruba ninguém; fluxo aberto manteria a instância cobrada (ADR 0018) |
| ADR-07 | **Firestore** para identidade, acesso, catálogo e, enquanto não houver conhecimento confidencial, também RAG e roteamento; **Cloud SQL Postgres + pgvector** quando houver (atualizado pelo ADR 0018) | Cloud SQL desde o início; AlloyDB; banco vetorial dedicado | Firestore é sem servidor e cabe na faixa gratuita; Postgres dá busca híbrida e segurança em nível de linha para separar clientes, e só se paga quando esse isolamento é necessário |
| ADR-08 | **GitHub Actions + Workload Identity Federation** para publicar | Cloud Build com conexão GitHub; chave de conta de serviço | Sem chave guardada; condições por repositório e branch; o pipeline fica junto do código |
| ADR-09 | **GitHub App** para o Google Cloud ler o GitHub (times, conteúdo, PRs) | Token pessoal de alguém | Permissões mínimas por recurso, token de instalação de 1 h, não depende de uma pessoa |
| ADR-10 | Pacotes **assinados no Cloud KMS** (ECDSA P-256), chave pública **embutida no CLI** | Só checksum; assinatura com chave em arquivo | A chave nunca sai do KMS; o CI só tem permissão de assinar |
| ADR-11 | **Catálogo por GitOps** (o que existe e em que versão) e **acesso pelo portal** (quem usa) | Tudo no portal; tudo no Git | Conteúdo exige revisão de código; acesso exige agilidade e trilha de aprovação |
| ADR-12 | **OAuth 2.1 do MCP como evolução**: o `odin-sts` já nasce com metadados OAuth (RFC 8414) e JWKS | Implementar desde o início | O Claude Code suporta OAuth em servidores HTTP (confirmado); fica para depois da F0, porque o CLI continua necessário para o runtime |
| ADR-13 | **Borda por estágio** (atualizado pelo ADR 0018): `run.app` em E0 e E1; Load Balancer + Cloud Armor só em E2, por gatilho | Borda única desde a liberação ao time | Toda rota útil exige token e valida entrada; o custo fixo da borda não se justifica para o time atual; teto de instâncias e disjuntor limitam o abuso |
| ADR-14 | **Região `southamerica-east1`** para dados e serviços | `us-central1` | Residência de dados no Brasil (LGPD) e latência; [VERIFICAR] disponibilidade de cada serviço na região |
| ADR-15 | **Segundo fator próprio do Odin** (TOTP obrigatório; passkey para administradores), além do GitHub | Confiar só no 2FA do GitHub | Conta do GitHub tomada não basta; a conta pessoal da prova de conceito não permite exigir 2FA |

## 6. Fluxos de ponta a ponta

### 6.1 Onboarding (uma vez)
1. A pessoa é convidada no portal (pelo login do GitHub) ou entra automaticamente por pertencer a um time do GitHub mapeado para um squad.
2. Instala o CLI com um comando copiado do portal.
3. `odin setup` → abre `https://odin.<dominio>/ativar` com o código preenchido → login com GitHub e segundo fator do Odin → confere o código e os dados do dispositivo e aprova → o CLI recebe a credencial ligada à chave do dispositivo, registra o MCP no Claude Code e instala o guard, o `ODIN.md` e o runtime das skills a que ela tem direito.

### 6.2 Pedido de trabalho (todo dia)
1. "Quero criar a classe de teste do `CaseRouter`" → o Claude Code (guiado pelas instruções do servidor Odin) chama `odin_rotear`.
2. `odin-mcp` valida o token, carrega os direitos da pessoa e devolve a skill certa entre as permitidas.
3. `odin_carregar_skill` entrega o texto da versão aprovada; a skill roda `odin ensure`, que confere o runtime e o guard.
4. A skill consulta o conhecimento (`odin_conhecimento_buscar`) com o filtro do projeto da pessoa.
5. O trabalho acontece na máquina; cada chamada ao Odin é auditada.

### 6.3 Publicação de uma skill
1. Mantenedor abre um PR no repositório da skill → merge → tag.
2. PR no catálogo (`catalog/skills.yaml`) trocando o SHA → merge.
3. GitHub Actions (identidade federada) valida, testa, roda o `odin lint`, empacota, **assina no KMS**, envia ao Cloud Storage e executa o job `odin-publisher`.
4. O publisher **confere a assinatura**, registra a versão no canal `beta` e atualiza o índice de roteamento.
5. Promoção a `stable` por um novo PR. Usuários não fazem nada.

### 6.4 Mudança de acesso
- **Pelo portal:** o gestor do squad adiciona uma pessoa → aprovação (quando a regra exigir) → vale em até 30 s.
- **Pelo GitHub:** a pessoa sai do time do GitHub → a varredura de 15 min detecta → o Odin remove a pertença ao squad, revoga os dispositivos se ela não tiver outro vínculo, e audita. Para efeito imediato, o administrador revoga no portal.

## 7. Visões transversais

### 7.1 Segurança (resumo; detalhe na arquitetura técnica, seção 8)
- **Identidade:** login com GitHub (2FA exigido pela organização do GitHub) **mais o segundo fator do Odin** (TOTP ou passkey; passkey para administradores), sessão no portal com cookie seguro e reautenticação para ações administrativas. Detalhe na pasta [`docs/seguranca/`](../seguranca/README.md).
- **Acesso:** perfis de uso × papéis administrativos separados; squads e projetos como recorte; concessões com validade; aprovação a quatro olhos para papéis administrativos.
- **Credenciais:** token de 15 min; credencial de dispositivo rotativa e ligada a chave; revogação em até 30 s; token pessoal só como exceção.
- **Cadeia de suprimentos:** pacotes e dependências assinados, com a assinatura conferida no registro e na máquina; imagens com varredura (Binary Authorization em E2); Dependabot.
- **Dados:** campos sensíveis cifrados por envelope no KMS; RAG separado por projeto (na aplicação; no banco quando houver conhecimento confidencial); CMEK em E2; auditoria sem conteúdo dos pedidos por padrão.
- **Borda:** TLS gerenciado, limites no serviço, teto de instâncias, disjuntor de custo e cabeçalhos de segurança no portal; Cloud Armor em E2.

### 7.2 Escalabilidade
| Dimensão | Como escala | Primeiro limite esperado |
|---|---|---|
| Usuários (20 → centenas) | Cloud Run sem estado, de 0 a N instâncias; Firestore sem servidor | Nenhum relevante até milhares |
| Skills (5 → dezenas) | Catálogo e roteamento com filtro por perfil e domínio antes da similaridade | Precisão do roteamento: entra a reordenação por modelo se as métricas caírem |
| Conhecimento (centenas → milhões de trechos) | Firestore vetorial até dezenas de milhares de trechos; pgvector com índice HNSW; Cloud SQL maior ou réplicas de leitura; AlloyDB se preciso | Memória do índice vetorial |
| Times e domínios | Multidomínio (`dominio` no `odin.yaml`), squads e projetos | Governança: delegar curadoria por coleção |
| Ambientes | Um projeto GCP por ambiente, mesmo Terraform, com o estágio de custo como variável | Organização GCP necessária para políticas centrais (seção 8) |
| Custo | Estágios E0 → E1 → E2, cada recurso pago por gatilho medido | Cloud SQL é o primeiro custo fixo |

### 7.3 Disponibilidade e continuidade
- Meta: 99,5% em horário comercial, sem plantão (decisão 32), com escala a zero. Instância quente só por gatilho medido, e só no `odin-mcp`.
- Se o Odin estiver fora, as skills já usadas continuam funcionando pela **cópia local assinada por até 7 dias** (decisão 14; arquitetura técnica 4.3.2). Skills novas e conhecimento ficam indisponíveis até a volta.
- Backups: Firestore com exportação diária (e recuperação a um ponto no tempo a partir do E1); Cloud Storage versionado; RAG reconstruível do Git. Metas: RTO de 4 h; RPO na [arquitetura técnica, seção 12](03-arquitetura-tecnica.md).

## 8. Ambientes e evolução

| Ambiente | Projeto GCP | Estágio | Quem usa | Diferenças |
|---|---|---|---|---|
| `poc` | Projeto pessoal do mantenedor | **E0** | Mantenedor + 2 usuários de teste | Custo perto de zero (decisão 7): escala a zero, `run.app`, RAG no Firestore, notificações só no portal, desenvolvimento com emuladores locais |
| `prod` | Projeto da empresa (idealmente numa organização GCP) | **E1** | Time | A **mesma topologia** do E0, com o Portão 2 cumprido. Cloud SQL mínimo quando entrar conhecimento confidencial |
| `prod` | Idem | **E2** (por gatilho) | Vários times ou exigência contratual | Domínio próprio com Load Balancer e Cloud Armor, instância quente, alta disponibilidade, HSM, CMEK, Binary Authorization, VPC Service Controls |

Não há ambiente de teste permanente na nuvem: os testes rodam com emuladores e contêineres no CI, e o `poc` segue como ambiente de ensaio depois que o `prod` existir.

**Limite do projeto pessoal:** sem uma organização GCP não há políticas de organização nem VPC Service Controls. O desenho funciona sem eles, mas a produção deve ficar numa organização.

**Limite da conta GitHub pessoal:** times do GitHub só existem em organizações. Na prova de conceito o acesso é dado por convite no portal (pelo login do GitHub). A sincronização por times entra quando houver uma organização GitHub.

## 9. Rastreabilidade com o plano

| Tema do plano | Onde está detalhado |
|---|---|
| Identidade e tokens (plano, seção 5) | Técnica, seção 5; Portal, seções 3 e 4 |
| Perfis, projetos e skills (plano, seção 6) | Funcional, seções 4 e 5; Portal, seção 5 |
| Runtime, guard, agentes (plano, seção 7) | Técnica, seção 9 |
| Catálogo e publicação (plano, seção 8) | Técnica, seção 7 |
| Cadeia de distribuição (plano, seção 9) | Técnica, seção 8 |
| Superfície MCP (plano, seção 10) | Técnica, seção 6 |
| RAG (plano, seção 11) | Técnica, seção 4.3; Funcional, seção 6 |
| Isolamento (plano, seção 22) | Técnica, seção 9.3 |
| Infraestrutura e custo (plano, seção 14) | [05 Custos e FinOps](05-custos-e-finops.md) |
