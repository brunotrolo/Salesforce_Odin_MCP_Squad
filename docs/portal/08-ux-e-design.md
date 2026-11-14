# 08. UX e design

> [Índice do portal](README.md)

## 1. Princípios
1. **Pouco portal, muito Claude Code:** o consumidor vem raramente. Cada visita tem de resolver em menos de 1 minuto (conectar, ver o que pode usar, pedir acesso, revogar algo).
2. **Dizer o porquê:** todo acesso mostra a origem ("perfil `dev` no squad Atendimento"); toda recusa mostra o caminho ("peça ao gestor X").
3. **Ações perigosas são lentas de propósito:** revogação em massa e global pedem motivo, confirmação digitada e, quando couber, segunda aprovação.
4. **Mostrar o efeito:** depois de mudar um acesso, o indicador "aplicado" confirma quando a mudança entrou em vigor (≤ 30 s).
5. **Nada de jargão para o consumidor:** "dispositivo", "token pessoal" e "cota" são explicados em uma linha na própria tela.

## 2. Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│ ODIN   [busca global]                     [saúde ●] [notificações] [conta ▾] │
├───────────────┬──────────────────────────────────────────────────────┤
│ Início        │  Título da página                      [ação principal] │
│ Conectar      │  Descrição curta de uma linha                          │
│ Guia do MCP   │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ Minhas skills │ │ cartão       │ │ cartão       │ │ cartão       │     │
│ Meu consumo   │ └──────────────┘ └──────────────┘ └──────────────┘     │
│ Novidades     │  Tabela / gráfico / formulário                         │
│ Solicitar     │                                                        │
│ Conhecimento  │                                                        │
│ Conta         │                                                        │
│ ───────────── │                                                        │
│ Administração │  (só com papel administrativo; abre submenu)           │
└───────────────┴──────────────────────────────────────────────────────┘
```
- **Área do usuário** e **console** têm a mesma moldura; o console tem um selo "Administração" no topo e cor de destaque diferente, para a pessoa saber que está num lugar com poder.
- **Telas pequenas:** a barra lateral vira menu recolhido; tabelas viram listas de cartões; ações em massa não ficam disponíveis no celular.

## 3. Componentes padrão
| Componente | Uso |
|---|---|
| Cartão de indicador | Número grande + variação + texto curto |
| Tabela com filtros | Busca, filtros salvos na URL, paginação, exportação quando permitido |
| Ficha com abas | Pessoa, squad, skill |
| Linha do tempo | Histórico de skill, auditoria de pessoa, novidades |
| Comparação lado a lado | Versões de skill, antes e depois de uma mudança administrativa |
| Diálogo de confirmação forte | Motivo obrigatório + digitar o nome do alvo (por exemplo, "REVOGAR") |
| Faixa de aviso | Manutenção, cota, alerta de segurança |
| Indicador "aplicado" | Pendente → aplicado (com horário) |
| Bloco de comando | Comando com botão copiar e aviso do sistema operacional |
| Selo de estado | `ativa`, `beta`, `depreciada`, `retirada`, `proibida`; `ativa`, `suspensa`, `convidada` |

## 4. Gráficos
- Barras para séries diárias e comparações; linhas só para tendência de longo prazo; sem gráfico de pizza.
- Cores com contraste suficiente nos temas claro e escuro, e **padrões ou rótulos** além da cor (não depender só de cor).
- Todo gráfico tem a **tabela equivalente** acessível (botão "ver como tabela").

## 5. Estados de tela
| Estado | Comportamento |
|---|---|
| Carregando | Esqueleto do conteúdo, nunca tela em branco |
| Vazio | Explicação + próxima ação ("Você ainda não tem dispositivos. **Conectar**") |
| Erro | Mensagem simples + código de referência (`request_id`) para o suporte + "tentar de novo" |
| Sem permissão | "Você não tem acesso a esta área." (sem revelar o que existe lá) |
| MFA vencido para a ação | Diálogo pedindo o fator, voltando à ação depois |
| Manutenção | Faixa; ações de escrita desabilitadas com explicação |

## 6. Textos (microcopy)
- Verbos claros nos botões: **Revogar dispositivo**, **Aprovar por 30 dias**, **Abrir PR de rollback**.
- Confirmações dizem o efeito: "Isso desconecta o Claude Code de *notebook-trabalho* em até 30 segundos."
- Erros dizem o que fazer: "Código expirado. Rode `odin setup` de novo para gerar outro."
- Datas no formato `DD/MM/AAAA HH:mm` (horário de Brasília), com o relativo ao lado ("há 3 h").

## 7. Notificações
| Evento | Para quem | Canal |
|---|---|---|
| Dispositivo novo ativado | A pessoa | Portal + e-mail |
| Login de local novo | A pessoa | Portal + e-mail |
| Solicitação aprovada ou recusada | Quem pediu | Portal + e-mail |
| Solicitação nova para aprovar | Aprovadores do escopo | Portal + e-mail (resumo diário opcional) |
| Concessão ou token perto de vencer (7 dias) | A pessoa | Portal |
| Skill nova, versão nova, depreciação, retirada | Quem tem acesso ou usou | Portal (Novidades) |
| Alerta SEV1/SEV2 | Administradores de segurança | Portal + e-mail + canal de mensagens |
| Pedido a quatro olhos | Aprovadores elegíveis | Portal + e-mail |

## 8. Acessibilidade (WCAG 2.1 AA)
Navegação completa por teclado, foco visível, ordem lógica, rótulos em todos os campos, contraste mínimo de 4,5:1, textos alternativos, tabelas com cabeçalhos corretos, anúncios para leitores de tela em mudanças dinâmicas (por exemplo, "aplicado"), sem tempo limite curto em formulários (a sessão avisa antes de expirar).

## 9. Idioma
Português do Brasil como padrão. Textos em arquivos de tradução desde o início, para permitir inglês depois sem mudar telas.
