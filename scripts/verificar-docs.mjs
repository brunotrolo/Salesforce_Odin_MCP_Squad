#!/usr/bin/env node
// Verifica a integridade da documentação do Odin.
// Uso: node scripts/verificar-docs.mjs [--base <ref-git>] [--raiz <dir>]
//  - links relativos para .md existem
//  - referências "(seção X)" sem link apontam para seção existente no mesmo documento
//  - blocos de código fechados; linhas de tabela terminam com "|"
//  - termos de decisões já descartadas (scripts/termos-proibidos.json) não reaparecem
//  - com --base: mudança em documento protegido exige mudança em docs/adr/ no mesmo conjunto
//  - nenhum caractere Unicode oculto (ADR 0017) fora de .claude/ (lá, quem confere é verificar-skills)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ehProtegido } from './lib/protegidos.mjs';
import { caracteresOcultos, varrerOcultos } from './lib/unicode.mjs';

function listarMd(raiz) {
  const out = [];
  const andar = (d) => {
    for (const f of readdirSync(d)) {
      if (['.git', 'node_modules', '.odin-dev', 'fixtures'].includes(f)) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) andar(p);
      else if (f.endsWith('.md')) out.push(p);
    }
  };
  andar(raiz);
  return out;
}

export function verificar(raiz, { base = null } = {}) {
  const erros = [];
  const avisos = [];
  const termosPath = join(raiz, 'scripts/termos-proibidos.json');
  const termos = existsSync(termosPath) ? JSON.parse(readFileSync(termosPath, 'utf8')) : [];
  const arquivos = listarMd(raiz);

  for (const abs of arquivos) {
    const rel = relative(raiz, abs).split('\\').join('/');
    const t = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    const linhas = t.split('\n');
    if (!rel.startsWith('.claude/')) for (const a of caracteresOcultos(t)) erros.push(`${rel}:${a.linha}:${a.coluna}: caractere Unicode oculto ${a.codigo} (${a.nome})`);
    // links
    for (const m of t.matchAll(/\]\(([^)#\s]+\.md)(#[^)]*)?\)/g)) {
      if (/^https?:/.test(m[1])) continue;
      const alvo = normalize(join(dirname(abs), m[1]));
      if (!existsSync(alvo)) erros.push(`${rel}: link quebrado → ${m[1]}`);
    }
    // blocos de código
    if ((t.match(/^```/gm) || []).length % 2) erros.push(`${rel}: bloco de código sem fechamento`);
    // tabelas e referências
    const secoes = new Set([...t.matchAll(/^#{2,4} (\d+(?:\.\d+)*)\.? /gm)].map((m) => m[1]));
    let emCodigo = false;
    linhas.forEach((l, i) => {
      if (l.startsWith('```')) emCodigo = !emCodigo;
      if (emCodigo) return;
      if (l.startsWith('|') && !l.trimEnd().endsWith('|')) erros.push(`${rel}:${i + 1}: linha de tabela sem "|" final`);
      if (!l.includes('](')) for (const r of l.matchAll(/\(seção (\d+(?:\.\d+)*)\)/g)) if (!secoes.has(r[1])) erros.push(`${rel}:${i + 1}: referência à seção ${r[1]}, que não existe neste documento`);
      // termos proibidos (ignora tabelas de histórico de revisão e o próprio arquivo de termos)
      const historico = /^\| \d+ \|/.test(l) || rel.startsWith('docs/adr/');
      if (!historico) for (const tp of termos) if (l.includes(tp.termo) && !(tp.permitido_em || []).includes(rel)) erros.push(`${rel}:${i + 1}: termo descartado "${tp.termo}" (${tp.motivo})`);
    });
  }

  // código, workflows e apresentação (os .md já foram vistos acima)
  erros.push(...varrerOcultos(raiz, ['scripts', 'tests', '.github', 'apresentacao', 'package.json'], { extensoes: new Set(['.mjs', '.js', '.json', '.yml', '.yaml', '.html']) }));

  if (base) {
    let alterados = [];
    try {
      alterados = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: raiz, encoding: 'utf8' }).split('\n').filter(Boolean);
    } catch (e) { avisos.push(`não foi possível comparar com ${base}: ${e.message.split('\n')[0]}`); }
    const prot = alterados.filter(ehProtegido);
    const comAdr = alterados.some((f) => /^docs\/adr\/\d{4}-.+\.md$/.test(f) && !f.startsWith('docs/adr/0000'));
    if (prot.length && !comAdr) erros.push(`documentos protegidos alterados sem ADR em docs/adr/: ${prot.join(', ')}`);
  }
  return { erros, avisos, total: arquivos.length };
}

function main() {
  const a = process.argv.slice(2);
  const raiz = a.includes('--raiz') ? a[a.indexOf('--raiz') + 1] : process.cwd();
  const base = a.includes('--base') ? a[a.indexOf('--base') + 1] : null;
  const r = verificar(raiz, { base });
  r.avisos.forEach((x) => console.log(`AVISO: ${x}`));
  if (r.erros.length) { r.erros.forEach((x) => console.log(`ERRO: ${x}`)); console.log(`\n${r.erros.length} erro(s) em ${r.total} documentos.`); process.exit(1); }
  console.log(`Documentação íntegra: ${r.total} documentos verificados.`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
