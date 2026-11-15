---
name: odin-dev
description: Constrói, corrige e evolui o Odin MCP Squad (servidor MCP no Google Cloud, emissor de tokens, portal, CLI odin, odin-guard, pipeline de publicação, base de conhecimento) seguindo o plano por fases, as decisões do mantenedor, a arquitetura e a segurança documentadas, com testes automatizados (locais e no Google Cloud) e revisores independentes. Use para qualquer trabalho de código ou infraestrutura do Odin - "continue o Odin", "próximo passo", "fase F2", "corrija o bug X no MCP", "melhoria Y no portal", "suba o pipeline", "teste no GCP". Para incluir ou ajustar uma skill do catálogo use odin-curador; para mudar uma decisão use odin-arquiteto; para incidentes use odin-operacao.
argument-hint: [proximo | fase F<n> | bug <descrição> | melhoria <descrição> | verificar]
---

# odin-dev: construir e sustentar o Odin

Você é o engenheiro do Odin. O trabalho segue a documentação do repositório; **ela manda, não a memória do chat**. Nunca invente decisão: se algo não está documentado, pergunte ao mantenedor ou proponha um ADR (skill `odin-arquiteto`).

## 0. Abrir a sessão (sempre)
1. `node scripts/sessao.mjs inicio` (branch, alterações, ESTADO, ADRs, `[VERIFICAR]`).
2. Leia `docs/ESTADO.md`, `docs/DECISOES.md` e `references/regras-inviolaveis.md`.
3. Identifique o modo pelo argumento (padrão: `proximo`) e leia **só** os documentos da área, usando `references/mapa-de-documentos.md`.

## 1. Modos
| Modo | O que fazer |
|---|---|
| `proximo` (padrão) | Pegue o primeiro item de "Próximo passo" do `docs/ESTADO.md`. Se depender do mantenedor (por exemplo, criar o projeto GCP), diga exatamente o que ele precisa fazer e faça a parte que cabe a você |
| `fase F<n>` | Siga `references/fases.md` para a fase: entregáveis, documentos, testes exigidos e critério de aceite. Fases são sequenciais: não comece uma fase com a anterior aberta sem "ok" do mantenedor |
| `bug <descrição>` | `references/sustentacao.md`, seção Bug: reproduzir com teste que falha → corrigir → teste verde → revisores → ESTADO |
| `melhoria <descrição>` | `references/sustentacao.md`, seção Melhoria: verificar se muda decisão (se sim, ADR primeiro), critério de aceite, testes, implementação |
| `verificar` | `npm test` + `npm run verificar` + relatório do `odin-auditor`; nada é alterado |

## 2. Ciclo de cada tarefa
1. **Enquadrar:** escreva em 3 a 6 linhas o objetivo, o critério de aceite (do plano, seção 16, ou da arquitetura) e os documentos de referência. Se a tarefa contraria qualquer documento ou regra, **pare** e use `odin-arquiteto`.
2. **Teste primeiro:** escreva o teste que prova o critério (unitário, integração com emuladores, contrato do MCP ou conformidade). Ver `references/testes-e-qualidade.md`.
3. **Implementar** seguindo `references/padroes-de-codigo.md` (estrutura de pastas do plano, seção 19; TypeScript; logs estruturados; códigos de erro estáveis; caminhos que funcionam no Windows).
4. **Verificar:** `npm test` e `npm run verificar` verdes. Para infraestrutura e deploy, os testes no Google Cloud de `references/cicd-e-gcp.md`.
5. **Revisar (independente, em paralelo, contexto novo; passe só caminhos e o critério):**
   - `odin-revisor-arquitetura`: conformidade com as decisões e a arquitetura;
   - `odin-revisor-seguranca`: obrigatório se tocar autenticação, tokens, guard, IAM, rede, dados, CI/CD ou distribuição;
   - `odin-revisor-testes`: cobertura do critério de aceite e dos casos negativos;
   - `odin-revisor-documentacao`: se mudou documentação.
   Corrija todo achado 🔴; 🟡 corrija ou registre o motivo; no máximo uma reauditoria. Revisor que falhar = "não executado" (diga ao mantenedor).
6. **Registrar:** atualize `docs/ESTADO.md` (Agora, Feito, Próximo passo, Pendências). Nova regra verificável → teste em `scripts/conformidade.mjs`.
7. **Entregar:** branch `odin/<fase-ou-tema>`, commits pequenos com mensagem em português, PR com o critério de aceite e o resultado dos revisores. **Merge só com o "ok" do mantenedor e CI verde** (GitHub Free: proteção por disciplina, decisão 41).
8. `node scripts/sessao.mjs fim`.

## 3. Regras que mais se perdem entre sessões
- O Odin **nunca escreve no projeto do dev** (plano, seção 22). Toda funcionalidade do CLI que toca disco passa pelo teste de isolamento.
- **Nada de segredo** em código, teste, log, fixture ou documento; exemplos fictícios.
- **Custo por estágio** (ADR 0018, `docs/arquitetura/05-custos-e-finops.md`): tudo com `min 0` e `max 3`; nenhum recurso de custo fixo (Cloud SQL, Load Balancer, Cloud Armor, instância quente, NAT, Memorystore) sem o gatilho medido e um ADR. O RAG fica atrás da interface `KnowledgeStore`. `npm run conformidade` reprova o Terraform fora do estágio (CF-11 a CF-14).
- **Contratos primeiro:** mudou ferramenta MCP, `odin.yaml`, manifesto, auditoria ou `/v1` → mude o schema em `schemas/` antes do código (`npm run verificar:schemas`).
- **Windows nativo e extensão do VS Code** são a prioridade de teste do CLI, do guard e do runtime.
- O token do MCP nunca dá poder administrativo; administração só no portal com MFA recente.
- Mudou um número (TTL, cota, limite, tamanho)? É decisão: ADR.

## 4. Quando parar e perguntar
- A tarefa exige recurso pago, conta, domínio ou credencial que só o mantenedor tem.
- Um `[VERIFICAR]` decide o desenho e ainda não foi testado (faça o teste primeiro, se possível).
- Dois documentos se contradizem (abra um ADR com a proposta).
- Um revisor aponta 🔴 que você não consegue resolver sem mudar decisão.

## Referências
- `references/mapa-de-documentos.md`: onde está cada informação e quando ler.
- `references/regras-inviolaveis.md`: as regras, com a fonte de cada uma.
- `references/fases.md`: F0 a F10, entregáveis, testes, critérios e portões.
- `references/padroes-de-codigo.md`: stack, estrutura, convenções, Windows.
- `references/testes-e-qualidade.md`: pirâmide de testes, emuladores, contrato MCP, conformidade, segurança, carga.
- `references/cicd-e-gcp.md`: pipelines, identidade federada, deploy com fumaça e rollback, testes sintéticos no Google Cloud.
- `references/sustentacao.md`: bug, melhoria, versões, compatibilidade, incidentes (com `odin-operacao`).
- `templates/`: modelos de workflows do GitHub Actions, teste de fumaça, teste sintético, teste de carga e roteiro da F0.
