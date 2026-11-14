# Intenções de roteamento

O roteador do Odin compara o pedido da pessoa com as `intencoes` e a `descricao` de cada skill permitida (plano, seção 10). Boas intenções são o que mais pesa no acerto.

## Como escrever as 20 frases
- Frases **reais**, como alguém do time pediria, em português do dia a dia: "testa a tela de busca de cliente na sandbox", "quero o caderno de teste da capacidade 001".
- Varie: verbos diferentes, com e sem o nome da skill, com o artefato ("a partir da spec 001"), curtas e longas, com erro de digitação comum.
- Cubra as subskills e os modos (`--rapido`, `--explorar`).
- Inclua 3 a 5 **negativas** (pedidos parecidos que **não** são desta skill), marcadas `negativa: true`; elas testam que o roteador não chuta.
- Nada de nome de cliente, org ou pessoa real.

## Avaliação
- O pipeline roda o conjunto de todas as skills: a skill correta deve ficar no topo em **≥ 90%** das frases positivas, e as negativas não podem cair nela.
- Abaixo da meta: ajuste as intenções ou a descrição (nova versão da skill), nunca o limiar sem ADR.

## Formato no `odin.yaml`
```yaml
intencoes:
  - "testa a capacidade 001 na sandbox"
  - "roda o QA de tela da busca de cliente"
  - texto: "criar a classe de teste Apex do serviço"
    negativa: true      # é do Journey Developer
```
