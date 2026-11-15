#!/usr/bin/env node
// Avalia o roteador contra catalog/avaliacao-roteamento.yaml. Meta: ≥ 90% com a skill certa no topo.
// Uso: node scripts/avaliar-roteamento.ts [--minimo 0.9] [--detalhe]
import { lerCasosDeRoteamento, lerCatalogo } from '../packages/router/src/catalogo.ts';
import { Roteador } from '../packages/router/src/router.ts';

export function avaliarRoteamento(raiz: string): { acertos: number; total: number; erros: Array<{ pedido: string; esperado: string; obtido: string }> } {
  const { skills } = lerCatalogo(raiz); const casos = lerCasosDeRoteamento(raiz);
  const r = new Roteador(skills); const todas = new Set(skills.map((s) => s.id));
  const erros: Array<{ pedido: string; esperado: string; obtido: string }> = [];
  for (const c of casos) { const x = r.rotear(c.pedido, todas); const obtido = 'nao_sei' in x ? 'nao_sei' : `${x.candidatas[0]!.skill}`; if (obtido !== c.esperado) erros.push({ pedido: c.pedido, esperado: c.esperado, obtido: 'nao_sei' in x ? obtido : `${obtido} (${x.candidatas[0]!.confianca})` }); }
  return { acertos: casos.length - erros.length, total: casos.length, erros };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop()!)) {
  const a = process.argv.slice(2); const minimo = a.includes('--minimo') ? Number(a[a.indexOf('--minimo') + 1]) : 0.9;
  const r = avaliarRoteamento(process.cwd());
  for (const e of r.erros) console.log(`ERROU: "${e.pedido}" → ${e.obtido} (esperado ${e.esperado})`);
  const taxa = r.acertos / r.total;
  console.log(`Roteamento: ${r.acertos}/${r.total} (${Math.round(taxa * 100)}%), meta ${Math.round(minimo * 100)}%`);
  if (taxa < minimo) process.exit(1);
}
