# 0017. Evals por skill, Unicode oculto, integridade no uso e economia de contexto

**Status:** Aceito (2026-11-15)
**Data:** 2026-11-15
**Fase:** sustentação (antes da F0); efeito nas fases F3, F5, F6 e F7
**Documentos afetados:** docs/PLANO.md §7.2, §8.1, §8.3, §8.4, §10, §11.3, §16, §17, §18, §20, §22.5; docs/seguranca/01 §5; docs/seguranca/05 §2; docs/seguranca/06 §5; docs/seguranca/09 §2 e §4; docs/seguranca/10 §1 e §3; docs/arquitetura/03 §7.4; docs/portal/07

## Contexto
O mantenedor trouxe dois textos sobre como grandes empresas distribuem skills por MCP. A avaliação (sessão de 2026-11-14) mostrou que o desenho do Odin já cobre o essencial: repositório central servido por MCP, carregamento sob demanda, prefixos contra colisão, skill tratada como código com CI e assinatura, regra de negócio fora do texto do modelo. Ficaram quatro lacunas, e o mantenedor escolheu incorporar as quatro:

1. **Comportamento da skill não é avaliado.** Hoje avaliamos se o roteador escolhe a skill certa (≥ 90%) e se o RAG recupera o trecho certo (≥ 80% no top 5), mas não se a skill **faz o trabalho certo**. Uma versão nova pode passar nos testes unitários e piorar o resultado.
2. **Caracteres Unicode invisíveis.** Caracteres de largura zero, controles de direção de texto (ataque "Trojan Source") e caracteres de *tag* (U+E0000 a U+E007F) escondem instruções do revisor humano e chegam inteiros ao modelo. Nem o `odin lint` nem a ingestão do RAG nem o CI deste repositório os recusavam.
3. **Integridade só na instalação.** O CLI confere a assinatura ao instalar, mas um arquivo do runtime alterado depois (por outro processo, por engano ou por malware) seria executado sem aviso até a próxima versão.
4. **Custo de contexto.** O teto de 8.000 tokens por resposta existe, mas não havia diretriz para que o trabalho pesado fosse feito por script, com só o resumo indo para o modelo (ideia do artigo da Anthropic sobre execução de código com MCP).

## Decisão
1. **Avaliações de comportamento por skill.** Cada repositório de skill traz `evals/` (declarado em `odin.yaml` → `avaliacoes`) com no mínimo 10 casos (entrada sobre fixture, resultado esperado verificado por código e, quando preciso, por um juiz independente somente leitura), incluindo casos negativos e de injeção. Duas camadas:
   - **Determinística** (scripts da skill sobre fixtures, sem modelo): roda no `publish.yml` e **bloqueia a publicação** em `beta` se falhar.
   - **Com modelo** (a skill executada pelo Claude Code em modo não interativo sobre as fixtures): roda na máquina do mantenedor com `odin dev eval <skill>` (sem chave de modelo no CI), 3 repetições por caso, e gera `evals/resultado.json` ligado ao SHA. O PR de promoção `beta` → `stable` só passa se o relatório for do SHA promovido, a nota não cair mais de 5 pontos em relação à versão `stable` atual e nenhum caso marcado `critico` falhar.
2. **Unicode oculto é recusado** em todo texto que chega ao modelo ou à revisão: `odin lint` (todos os arquivos de texto do pacote), ingestão do RAG, instruções do servidor e, já agora, as verificações deste repositório (`verificar:docs` e `verificar:skills`). Proibidos: U+200B–U+200F, U+202A–U+202E, U+2060–U+2064, U+2066–U+2069, U+FEFF fora do início do arquivo, U+00AD, U+180E, U+E0000–U+E007F e U+E0100–U+E01EF. Seletores de variação comuns de emoji (U+FE00–U+FE0F) continuam permitidos.
3. **Integridade no uso.** Na primeira chamada de cada skill em cada sessão, o `odin ensure` recalcula o SHA-256 dos arquivos do runtime instalado e compara com o manifesto assinado já guardado no cache. Divergência → reinstala do pacote assinado (cópia local ou download), registra telemetria e gera a detecção **DT-19** (SEV2). Sem pacote íntegro disponível, a skill não roda (fail-closed). Nas chamadas seguintes da mesma sessão, basta conferir o hash do manifesto (barato).
4. **Economia de contexto como regra das skills.** Trabalho pesado (logs, varredura de metadados, relatórios, comparação de arquivos grandes) é feito por script local, que grava o detalhe em arquivo e devolve ao modelo só o resumo (alvo: até 40 linhas). Alvo de cerca de **5.000 tokens** por `SKILL.md` e por referência; o teto de **8.000** continua sendo o limite que reprova no `odin lint`. Entre 5.000 e 8.000, o lint avisa.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Avaliações com modelo dentro do CI | Exigiria guardar uma chave de modelo no GitHub (Free, sem segredo de ambiente com aprovação) e o LiteLLM é da empresa; o mantenedor roda localmente e o CI confere o relatório |
| Juiz de modelo como única nota | Não determinístico; a nota principal é por código, o juiz só cobre o que o código não consegue julgar |
| Remover silenciosamente os caracteres invisíveis | Esconderia a tentativa de ataque; recusar com linha e código do caractere obriga a revisão |
| Conferir o hash do runtime em toda chamada | Custo desnecessário em projetos grandes; uma vez por sessão por skill cobre a janela de risco com custo baixo |
| Execução de código no servidor (sandbox remoto) | Código arbitrário rodando no Google Cloud, com custo e risco que a PoC não justifica; as skills já executam localmente |

## Consequências
- Melhora: regressão de comportamento é pega antes do `stable`; texto adulterado com Unicode invisível não passa; runtime alterado na máquina é detectado e corrigido; skills mais baratas em contexto.
- Piora ou risco: escrever casos de avaliação aumenta o esforço da F6 (cerca de +0,5 semana); avaliação com modelo depende da máquina do mantenedor (agrava R15) e é não determinística (novo risco **R19**, mitigado com 3 repetições, mediana e tolerância de 5 pontos).
- Testes e aceite: `verificar:docs` e `verificar:skills` recusam Unicode oculto (implementado e testado neste ADR); F3 exige o bloqueio por avaliação determinística e Unicode; F5 exige o teste de runtime adulterado; F6 exige `evals/` em cada uma das 5 skills; novos controles CT-25 a CT-27; detecção DT-19.

## Segurança
- Modelo de ameaças: IA-01 (injeção) ganha a defesa contra Unicode oculto; IA-04 (cadeia de prompts e skills) ganha avaliação de comportamento e integridade no uso.
- Controles novos: **CT-25** (Unicode oculto recusado), **CT-26** (integridade do runtime no uso), **CT-27** (promoção bloqueada por avaliação).
- Detecção nova: **DT-19** (runtime instalado diverge do manifesto assinado).

## Atualizações feitas
- [x] Documentos afetados atualizados
- [x] docs/PLANO.md seção 20 (linha na tabela de revisões)
- [x] docs/ESTADO.md
- [x] Verificação automática: `scripts/lib/unicode.mjs` usado por `verificar-docs.mjs` e `verificar-skills.mjs`, com testes
