# 0019. Pipeline do ciclo de desenvolvimento com 10 skills

**Status:** Aceito (2026-11-15)
**Data:** 2026-11-15
**Fase:** sustentação (antes da F0); efeito na F6
**Documentos afetados:** docs/PIPELINE.md (novo); docs/DECISOES.md (decisões 49 a 52); docs/PLANO.md §1, §6.2, §10, §12, §16, §20, §22.3, §23.3; docs/portal/10

## Contexto
O mantenedor informou as skills que entram no Odin: às 5 já previstas somam-se Archaeologist, LWC Developer, Apex Callouts Developer, Apex Cover Loop e Deep Debugger (10 repositórios). Pediu a organização delas no ciclo de desenvolvimento e respondeu três perguntas: fechar com 10 repositórios; skills lado a lado, sem hierarquia; ajustar o Callouts Developer de FSC para Service Cloud na migração.

## Decisão
1. As 10 skills ficam em **6 etapas**: entender (Archaeologist), descobrir (Discovery-to-Backlog), especificar (Data Architect, Journey Designer), construir (Journey Developer, LWC Developer, Apex Callouts Developer), verificar (Apex Cover Loop, Test Automator) e sustentar (Deep Debugger). Detalhe em [PIPELINE.md](../PIPELINE.md).
2. **Sem hierarquia:** o roteador escolhe pela intenção; o encadeamento é sugestão de próximo passo; as fronteiras entre skills parecidas viram intenções negativas e casos de avaliação.
3. **11 atalhos** (os 6 anteriores mais `/odin:legado`, `/odin:lwc`, `/odin:callout`, `/odin:cobertura`, `/odin:debug`). Atalho é prompt MCP, não ferramenta: o limite de 7 ferramentas não muda.
4. O Apex Callouts Developer é ajustado para Service Cloud na F6.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Journey Developer como orquestrador das skills de construção | O mantenedor preferiu todas lado a lado; evita acoplamento entre repositórios |
| Pipeline linear obrigatório | Demandas pontuais (cobrir uma classe, investigar um erro) não passam pelas etapas anteriores |
| Uma ferramenta MCP por skill | Estouraria o limite de 7 ferramentas; o roteador já resolve |

## Consequências
- Melhora: ciclo completo coberto, inclusive legado e sustentação; fronteiras explícitas reduzem erro de roteamento.
- Piora ou risco: F6 passa de 2,5 para 4,5 semanas (total de cerca de 18); mais sobreposição entre skills de construção, o que pressiona a meta de 90% de roteamento (R4); mais bibliotecas de terceiros repetidas.
- Testes: conjunto de intenções passa a 20 por skill × 10, com as fronteiras da seção 5 do pipeline como negativas.

## Segurança
Duas skills novas pedem política própria no guard: Archaeologist (somente leitura na org; regra de negócio do cliente não vai ao conhecimento sem curadoria) e Deep Debugger (quick deploy só em sandbox e só com pedido explícito). Sem mudança no modelo de ameaças.

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [ ] Testes de conformidade: não se aplica (sem regra nova verificável em código)
