# Consultas prontas (BigQuery, `odin_audit.eventos`)

Esquema em `docs/arquitetura/03-arquitetura-tecnica.md` §4.4. Use sempre filtro de data (tabela particionada) e `maximum_bytes_billed`.

```sql
-- Tudo de uma pessoa nas últimas 24 h
SELECT ts, servico, acao, alvo, resultado, motivo, ip, dispositivo
FROM `odin-poc.odin_audit.eventos`
WHERE DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) AND ator = @pessoa
ORDER BY ts DESC;

-- DT-01: reuso de refresh token
SELECT ts, ator, dispositivo, ip FROM `odin-poc.odin_audit.eventos`
WHERE DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND acao = 'sts.refresh.reuso';

-- DT-09: ativação aprovada com IP diferente do pedido
SELECT ts, ator, alvo, motivo FROM `odin-poc.odin_audit.eventos`
WHERE DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND acao = 'sts.ativacao.aprovada' AND motivo LIKE '%ip_divergente%';

-- DT-12: pessoas com muitos "negado" hoje
SELECT ator, COUNTIF(resultado = 'negado') AS negados, COUNT(*) AS total
FROM `odin-poc.odin_audit.eventos` WHERE DATE(ts) = CURRENT_DATE()
GROUP BY ator HAVING negados > 20 AND negados / total > 0.2 ORDER BY negados DESC;

-- Uso de uma versão de skill (antes de retirar ou depois de rollback)
SELECT versao, COUNT(*) AS chamadas, COUNT(DISTINCT ator) AS pessoas
FROM `odin-poc.odin_audit.eventos`
WHERE DATE(ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND skill = @skill
GROUP BY versao ORDER BY chamadas DESC;

-- Ações administrativas (antes e depois) de um período
SELECT ts, ator, acao, alvo, antes, depois FROM `odin-poc.odin_audit.eventos`
WHERE DATE(ts) BETWEEN @de AND @ate AND acao LIKE 'admin.%' ORDER BY ts;
```
