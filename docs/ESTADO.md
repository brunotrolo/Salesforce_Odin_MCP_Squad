# Estado do projeto

> Atualizado a cada sessão (skill `odin-dev`, passo final). Uma sessão nova começa por aqui.
> **Última atualização:** 2026-11-14

## Agora
- **Fase:** pré-F0, fechando o **Portão 1** ([plano, seção 23.1](PLANO.md)).
- Documentação completa e alinhada: plano, decisões (41), arquitetura (solução, funcional, técnica), segurança (12 documentos), portal (11 documentos), apresentação interativa.
- Skill de desenvolvimento e sustentação criada (ADR 0016): `odin-dev`, `odin-curador`, `odin-arquiteto`, `odin-operacao`, revisores e auditor, hook de documentos protegidos, verificações e CI de documentação.
- Ainda **não há código** do Odin (servidor, portal, CLI, guard).

## Feito (resumo, mais recente primeiro)
- 2026-11-14 · ADR 0016: skills, agentes, hook, scripts de verificação, testes e CI. O CI no Windows pegou leitura de CRLF: scripts normalizam e `.gitattributes` fixa LF.
- 2026-11-14 · Apresentação interativa (`apresentacao/`).
- 2026-11-14 · Rodadas 13 a 15: decisões do mantenedor integradas; GitHub Free (decisão 41).

## Próximo passo
1. **Mantenedor:** criar o projeto `odin-poc` no Google Cloud (decisão 1).
2. **Claude (`/odin-dev`):** escrever `docs/F0-ROTEIRO.md` (prioridade Windows nativo e extensão do VS Code) e o servidor MCP de teste da F0.
3. Depois da F0: ADR com o resultado de cada `[VERIFICAR]`, ajuste dos documentos e início da F1.

## Pendências
- Entregáveis das decisões: `docs/F0-ROTEIRO.md`, `docs/MIGRACAO-SKILLS.md`, `schemas/`, `prototipo/` (o protótipo inicial está na apresentação).
- Portão 2 (antes do time): organização GitHub, domínio + Load Balancer + Cloud Armor, Cloud SQL, segundo super-admin, jurídico, e-mail, pentest, ensaio do corte.
- Pontos `[VERIFICAR]`: ver `node scripts/sessao.mjs inicio`.

## Riscos ativos mais relevantes
R11 (busca de ferramentas via LiteLLM), R15 (pessoa única), R16 (corte único), R17 (sem jurídico), R18 (GitHub Free). Detalhe no [plano, seção 18](PLANO.md).
