# 0023. Portal interino de administração e de pessoa no serviço do emissor

**Status:** Aceito (2026-11-16)
**Data:** 2026-11-16
**Fase:** F4 (adiantada em versão interina)
**Documentos afetados:** docs/portal/03-area-do-usuario.md; docs/portal/05-console-de-administracao.md; docs/ESTADO.md; docs/HOMOLOGACAO.md; CHANGELOG.md

## Contexto
O mantenedor exigiu a página de administração e a página de pessoa no Google Cloud, homologadas, antes de qualquer teste dele. O plano prevê o portal com login do GitHub e segundo fator, mas isso depende de um OAuth App do GitHub, que só se cria com confirmação humana no navegador. Até lá a ativação usava só a página provisória `/ativar`.

## Decisão
1. O portal passa a existir já, no mesmo serviço Cloud Run do emissor de tokens (`odin-sts`), em `apps/portal`, sem novo serviço, nova conta de serviço nem custo adicional (estágio E0).
2. **Administração** (`/admin`): entrada pelo segredo de administração do Secret Manager (`odin-ativacao-admin`), com limite de tentativas, sessão de 2 horas e CSRF em todo formulário. Funções: painel, pessoas (criar, suspender, reativar, gerar convite), dispositivos (revogar), skills e versões do catálogo, propostas de conhecimento (aprovar vira trecho do RAG, rejeitar) e revogação global.
3. **Pessoa** (`/conta`): entrada por convite de uso único (72 horas) criado pelo administrador; a pessoa ativa o próprio dispositivo digitando o código do `odin setup`, vê suas skills e perfis e revoga os próprios dispositivos.
4. Cookie de sessão assinado (HMAC derivado do segredo de pimenta), `HttpOnly`, `Secure`, `SameSite=Strict`; cabeçalho `Content-Security-Policy` restritivo; toda saída HTML escapada; auditoria de cada ação (`portal.*`, `admin.*`) sem segredo nem texto de pedido.
5. Quando houver o OAuth App do GitHub, o login passa a ser GitHub + segundo fator, trocando só a entrada; as páginas e os dados continuam.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Esperar o OAuth App do GitHub | Bloqueia o portal por uma ação humana; a versão interina entrega as mesmas telas |
| Serviço Cloud Run separado para o portal | Mais um serviço, mais conta de serviço e mais risco de custo, sem ganho no E0 |
| Login da pessoa por senha | Guardar senhas é risco novo; convite de uso único não guarda nada reutilizável |

## Consequências
- Melhora: administração e autoatendimento da pessoa funcionam e estão homologados; o `/ativar` por segredo deixa de ser o único caminho.
- Piora ou risco: o administrador entra por um segredo compartilhado (um único administrador) até o login com GitHub e segundo fator; a pessoa que perde o convite precisa de outro. Mitigação: limite de tentativas, sessão curta, auditoria e rotação do segredo.
- Testes e aceite: testes locais (portal.test.ts) e homologação H22 a H25 na nuvem.

## Segurança
Sem segredo no repositório; o segredo de administração só existe no Secret Manager e na sessão do GitHub Actions mascarada. O convite é guardado como hash (HMAC) e some após o uso. CSRF por token de sessão, `SameSite=Strict`, CSP `default-src 'none'`, sem JavaScript no cliente. Risco aceito: um único segredo de administração no E0.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Testes de conformidade: não aplicável (sem regra verificável nova)
