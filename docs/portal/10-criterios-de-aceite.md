# 10. Critérios de aceite e testes do portal

> [Índice do portal](README.md) · Os critérios de segurança completos estão em [segurança 10](../seguranca/10-controles-e-testes.md).

## 1. Área do usuário
| # | Critério | Como testar |
|---|---|---|
| AC-U01 | Pessoa não convidada e fora de time mapeado não entra | E2E com conta GitHub de teste sem convite |
| AC-U02 | Primeiro acesso obriga cadastrar o segundo fator e mostra os códigos de recuperação uma vez | E2E |
| AC-U03 | "Conectar" mostra o comando certo por sistema e muda para "Conectado" depois do `odin setup` | E2E com o CLI |
| AC-U04 | `/ativar` exige MFA < 5 min, mostra nome, sistema, IP e local do dispositivo, e o código expira em 10 min | E2E com relógio controlado |
| AC-U05 | "Não fui eu" invalida o pedido e gera alerta | E2E |
| AC-U06 | Guia → Ferramentas mostra exatamente as ferramentas da versão do servidor em produção | Comparar `mcp_tools` com a lista do servidor |
| AC-U07 | Minhas skills mostra só as skills dos direitos efetivos, com o motivo do acesso | Testes com perfis diferentes |
| AC-U08 | Meu consumo bate com a auditoria (tolerância do atraso de 15 min) | Gerar chamadas conhecidas e comparar |
| AC-U09 | Barra da cota é atualizada em tempo real e avisa em 80% | E2E |
| AC-U10 | Novidades mostra versão promovida, depreciação e retirada só para quem tem acesso ou usou | Testes com perfis |
| AC-U11 | Revogar um dispositivo faz o próximo token falhar e o MCP recusar em ≤ 30 s | E2E com o CLI |
| AC-U12 | Token pessoal só é criado com MFA < 5 min e é exibido uma vez | E2E |
| AC-U13 | Exportar os próprios dados traz identidade, dispositivos, consumo e solicitações | E2E |

## 2. Console de administração
| # | Critério | Como testar |
|---|---|---|
| AC-A01 | Console exige MFA < 15 min e passkey para papéis administrativos | E2E |
| AC-A02 | Menu e rotas respeitam a matriz de papéis; rota digitada sem papel retorna `sem_permissao` | Testes de API por papel |
| AC-A03 | Gestor de squad não vê nem altera pessoas, consumo ou solicitações de outro squad | Testes de API |
| AC-A04 | Gestor só atribui perfis permitidos ao squad | Testes de API |
| AC-A05 | Ninguém aprova o próprio pedido; papéis administrativos e configurações ficam pendentes até a segunda aprovação | Testes de API |
| AC-A06 | A matriz de perfis mostra quem será afetado antes de salvar, e o "aplicado" aparece em ≤ 30 s | E2E |
| AC-A07 | Suspender uma pessoa revoga dispositivos, tokens e sessão, e encerra pertenças | E2E |
| AC-A08 | Histórico da skill mostra entrada, cada versão, promoções, rollbacks, mudanças de acesso, depreciação e retirada, com PR, pipeline e autor | Publicar versões de teste e conferir |
| AC-A09 | Comparar versões mostra arquivos e linhas alterados e a diferença do `SKILL.md` | Duas versões de teste |
| AC-A10 | Os botões de PR (promover, rollback, depreciar, retirar) abrem um PR correto no repositório Odin, e nada muda antes do merge | E2E com repositório de teste |
| AC-A11 | Consumo: visão, ranking e detalhe batem com a auditoria; filtros por pessoa, squad, skill, ferramenta e período funcionam | Dados sintéticos |
| AC-A12 | Anomalias marcadas conforme as regras de [06](06-consumo-cotas-e-metricas.md), seção 4.4 | Dados sintéticos com picos |
| AC-A13 | Cotas: precedência pessoa > squad > perfil; bloqueio em 100% com mensagem e hora de renovação; `negado` por acesso não consome cota | Testes de API e E2E |
| AC-A14 | Toda ação do console grava auditoria com antes e depois; abrir a ficha ou o consumo de outra pessoa também grava | Conferir eventos |
| AC-A15 | Revogação global exige passkey, motivo, confirmação digitada e segunda aprovação (ou modo emergência com alerta) | E2E |
| AC-A16 | Exportações respeitam o limite de linhas e ficam auditadas | Testes |
| AC-A17 | Curador aprova uma proposta e o PR é aberto no `odin-knowledge` | E2E com repositório de teste |

## 3. Não funcionais
| # | Critério | Meta |
|---|---|---|
| AC-N01 | Tempo de carregamento das páginas do usuário | p95 < 1,5 s |
| AC-N02 | Tempo das telas de consumo (agregados) | p95 < 3 s |
| AC-N03 | Acessibilidade | WCAG 2.1 AA (auditoria automática + teste manual com teclado e leitor de tela) |
| AC-N04 | Cabeçalhos de segurança | CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` presentes (teste automatizado) |
| AC-N05 | DAST sem achado alto ou crítico | OWASP ZAP no ambiente de teste |
| AC-N06 | Funciona nos navegadores atuais | Chrome, Edge, Firefox e Safari (duas últimas versões) |
| AC-N07 | Responsivo | Telas do usuário utilizáveis no celular |

## 4. Massa de teste
Conjunto sintético com 3 squads, 2 projetos, 12 pessoas (uma por combinação relevante de perfil e papel), 10 skills com histórico (incorporação, 3 versões, um rollback, uma depreciação, uma retirada) e 30 dias de consumo gerado (incluindo picos e `negado`). Sem dados reais de pessoas.
