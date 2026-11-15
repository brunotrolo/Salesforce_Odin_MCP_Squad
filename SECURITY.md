# Política de segurança

O Odin distribui código que roda com acesso total nas máquinas do time. Falha de segurança aqui tem prioridade sobre qualquer outra tarefa.

## Como relatar
- **Não abra issue pública nem comente em PR.** Use o relato privado de vulnerabilidade do GitHub neste repositório (aba *Security* → *Report a vulnerability*) ou fale diretamente com o mantenedor.
- Diga o que encontrou, como reproduzir e o impacto que você vê. Não inclua segredo, token nem dado de cliente no relato.
- Achou um token `odin_rt_` ou `odin_pat_` exposto? Avise na hora: ele é revogado antes de qualquer investigação.

## O que esperar
| Severidade | Exemplo | Primeira resposta | Contenção |
|---|---|---|---|
| SEV1 | Chave de assinatura, pacote adulterado, conta de emergência | No mesmo dia útil | Imediata, por runbook |
| SEV2 | Credencial de dispositivo, vazamento entre projetos, runtime divergente | 1 dia útil | Até 1 dia útil |
| SEV3 | Configuração fraca sem exploração conhecida | 3 dias úteis | Planejada |

Severidades, detecções e runbooks: [docs/seguranca/09](docs/seguranca/09-deteccao-e-resposta.md) e [docs/seguranca/11](docs/seguranca/11-runbooks.md). O serviço opera em horário comercial, sem plantão (decisão 32).

## Escopo
Servidor MCP, emissor de tokens, portal, CLI, guard, pipeline de publicação, pacotes de skills e este repositório. Modelo de ameaças em [docs/seguranca/01](docs/seguranca/01-modelo-de-ameacas.md).

## Regras para quem contribui
- Nenhum segredo, dado de cliente, alias de org ou nome real em código, skill, teste ou documento (o CI varre).
- Nenhum caractere Unicode oculto (o CI recusa).
- Mudança em segurança começa por um ADR (`node scripts/adr.mjs novo "título"`).
