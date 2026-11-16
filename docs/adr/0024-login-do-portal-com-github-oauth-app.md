# 0024. Login do portal com GitHub (OAuth App)

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F4
**Documentos afetados:** docs/portal/03-area-do-usuario.md; docs/portal/05-console-de-administracao.md; docs/MANUAL-DO-PORTAL.md; docs/HOMOLOGACAO.md; docs/ESTADO.md

## Contexto
O portal interino (ADR 0023) entra por segredo de administração e por convite. O plano prevê o login com GitHub. O mantenedor criou o OAuth App `Odin` e guardou o segredo do app como segredo do repositório (`MCP_OAUTH_CLIENT_SECRET`).

## Decisão
1. O portal ganha o botão **Entrar com GitHub** (`/auth/github/login` e `/auth/github/callback`), com escopo mínimo `read:user`, parâmetro `state` aleatório guardado em cookie assinado (`HttpOnly`, `Secure`, `SameSite=Lax`, 10 minutos) e conferido na volta.
2. A conta GitHub é ligada a uma pessoa do Odin **pelo id numérico do GitHub** (e, na primeira entrada, pelo login que o administrador cadastrou, que então passa a valer pelo id). Conta não cadastrada, suspensa ou inexistente é recusada. Quem tem o perfil `mantenedor` entra como administrador; os demais, como pessoa.
3. O segredo do OAuth App nasce no GitHub como segredo do repositório, é copiado pelo `infra.yml` para o Secret Manager (`odin-oauth-client-secret`, mascarado no log, só a conta do emissor lê) e nunca passa pelo Terraform nem pelo repositório. O Client ID é público e vai como variável do serviço.
3a. O cookie de sessão continua `SameSite=Strict`; por isso o retorno do GitHub responde 200 com atualização automática para a página interna, em vez de um redirecionamento 303.
4. O segredo de administração e os convites **continuam** como acesso de emergência e de entrada de pessoas novas.
5. Segundo fator: é o do próprio GitHub. O OAuth não informa ao Odin se a conta tem verificação em duas etapas; por isso a exigência de 2FA nas contas dos administradores é regra operacional (organização ou revisão manual), não verificada pelo código.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| GitHub App em vez de OAuth App | Mais complexo para o que se precisa agora (só identidade); fica para a leitura dos repositórios na F6 |
| Ligar por login e não por id | O login pode ser trocado e reaproveitado por outra pessoa; o id é permanente |
| Guardar o segredo do OAuth no Terraform | Iria para o estado do Terraform; o Secret Manager é o lugar certo |

## Consequências
- Melhora: entrada com a identidade do GitHub, sem segredo compartilhado no dia a dia; administradores identificados individualmente na auditoria.
- Piora ou risco: dependência do GitHub para entrar (o segredo de emergência cobre); 2FA não verificado pelo Odin (R operacional); o segredo do OAuth foi visto no chat de trabalho e deve ser rotacionado ao fim da homologação.
- Testes e aceite: testes locais do fluxo com GitHub simulado e H26 na nuvem (redirecionamento ao OAuth App certo, estado protegido, credenciais aceitas pelo GitHub).

## Segurança
Escopo `read:user`; estado assinado contra CSRF de login; segredo só no Secret Manager; auditoria `portal.github_login` com ator por id, sem token nem segredo; sessão de 2 h para administrador e 8 h para pessoa; limite de tentativas por IP.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade: não aplicável (sem regra verificável nova)
