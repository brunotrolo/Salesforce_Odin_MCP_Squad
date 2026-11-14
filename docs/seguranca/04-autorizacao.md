# 04. Autorização e controle de acesso

> [Índice da segurança](README.md) · Modelo funcional completo em [02 Funcional](../arquitetura/02-arquitetura-funcional.md) e [04 Portal](../arquitetura/04-portal-e-perfilamento.md)

## 1. Modelo
**RBAC com atributos (ABAC):** papéis e perfis dizem *o quê*; squad, projeto, coleção, canal e validade dizem *onde* e *até quando*. **Tudo é negado por padrão.**

- **Plano de uso** (MCP e CLI): perfis de uso (`po`, `dev`, `qa`, `arquiteto`, `mantenedor`) vindos das pertenças a squads e de concessões com prazo, recortados pelos projetos dos squads.
- **Plano administrativo** (só portal): papéis (`super-admin`, `admin-identidade`, `admin-catalogo`, `gestor-squad`, `curador`, `auditor`), com escopo quando aplicável.
- **Os planos não se misturam:** nenhum token do plano de uso executa ação administrativa (02, seção 3.4).

## 2. Avaliação de política (cada chamada)
```
decidir(pessoa, acao, alvo):
  se pessoa.status != ativo                         → NEGAR (revogado)
  se dispositivo ou família revogados               → NEGAR (revogado)
  direitos = cache_30s(pessoa.id, pessoa.policyVersion):
               união(perfis das pertenças ativas) ∪ concessões válidas
               recortado pelos projetos dos squads da pessoa
  se acao é de skill:   alvo.skill ∈ direitos.skills e canal permitido      → PERMITIR
  se acao é de conhecimento: (colecao, projeto) ∈ direitos.colecoes com nível suficiente → PERMITIR
                             (e o banco repete o filtro por segurança em nível de linha)
  caso contrário                                     → NEGAR (sem_acesso)
  sempre: auditar(decisão, motivo)
```
- **Duas barreiras no conhecimento:** a aplicação filtra e o banco filtra de novo (política de linha com os projetos e as coleções da pessoa). Um erro na aplicação não vaza dados de outro cliente.
- **Política versionada:** toda mudança administrativa incrementa o `policyVersion` das pessoas afetadas, o que invalida o cache delas na hora.

## 3. Princípios aplicados

| Princípio | Como |
|---|---|
| Mínimo privilégio | Perfis enxutos; concessões com prazo; gestor de squad limitado aos perfis do squad |
| Separação de funções | Quem pede não aprova; quem implanta não assina pacotes; quem administra identidade não administra catálogo |
| Quatro olhos | Papéis administrativos, configurações globais, zerar o MFA de alguém e uso não emergencial da revogação global exigem uma segunda pessoa |
| Prazo | Concessões e tokens pessoais com validade obrigatória (≤ 90 dias); papéis administrativos revisados a cada 90 dias |
| Revisão periódica | A cada trimestre, os gestores confirmam os membros dos seus squads e os administradores confirmam os papéis; o que não for confirmado expira |
| Segurança por padrão | Pessoa nova sem squad não usa nada; skill nova sem perfil não aparece para ninguém |

## 4. Acesso de emergência (break-glass)
- **Duas contas** de super-admin, de pessoas diferentes, com **passkey obrigatória** (de preferência chave física guardada em local seguro).
- Uso em modo emergência exige motivo, gera **alerta imediato** a todos os administradores e fica destacado na auditoria. Cada uso é revisado em até 48 h.
- Recuperação se o Identity Platform estiver indisponível: conta de emergência no **Google Cloud** (IAM) do projeto, com MFA, capaz de ler e editar o Firestore diretamente. É procedimento de runbook (11), auditado pelos logs administrativos do Google Cloud.

## 5. Autorização entre serviços (Google Cloud)
- Uma conta de serviço por componente, com papéis mínimos (tabela completa em [07](07-infraestrutura-gcp.md)).
- `odin-publisher` e os jobs só aceitam chamadas autenticadas por IAM (`run.invoker` concedido só a quem precisa).
- Firestore: regras de segurança negam qualquer acesso de cliente; só contas de serviço.
- Cloud SQL: usuário do MCP sem permissão de escrita e **sem** `BYPASSRLS`.

## 6. Testes de autorização obrigatórios (CI)
1. Pessoa sem perfil não roteia, não carrega skill e não busca conhecimento.
2. Pessoa do projeto A não recupera nenhum trecho do projeto B (no nível do banco).
3. Gestor do squad X não lista, inclui nem remove pessoas do squad Y.
4. Ninguém aprova o próprio pedido (API recusa, mesmo chamada direta).
5. Pedido de papel administrativo fica pendente até a segunda aprovação.
6. Token do MCP é recusado em qualquer rota `/admin`.
7. Mudança de perfil vale em ≤ 30 s (teste com o relógio controlado).
8. Concessão vencida deixa de valer.
