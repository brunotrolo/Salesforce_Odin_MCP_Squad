#!/usr/bin/env node
// Abertura e fechamento de sessão de trabalho no Odin (continuidade entre chats).
// Uso: node scripts/sessao.mjs inicio | fim
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listarAdrs, adrAtivo } from './lib/protegidos.mjs';

const git = (raiz, args) => { try { return execFileSync('git', args, { cwd: raiz, encoding: 'utf8' }).trim(); } catch { return ''; } };

export function secaoEstado(raiz, titulo) {
  const p = join(raiz, 'docs/ESTADO.md');
  if (!existsSync(p)) return null;
  const t = readFileSync(p, 'utf8');
  const i = t.indexOf(`## ${titulo}`);
  if (i < 0) return null;
  const resto = t.slice(i + titulo.length + 3);
  const j = resto.search(/\n## /);
  return (j < 0 ? resto : resto.slice(0, j)).trim();
}

export function contarVerificar(raiz) {
  let n = 0;
  const andar = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (f.endsWith('.md')) n += (readFileSync(p, 'utf8').match(/\[VERIFICAR/g) || []).length; } };
  if (existsSync(join(raiz, 'docs'))) andar(join(raiz, 'docs'));
  return n;
}

function inicio(raiz) {
  console.log('== Odin: início de sessão ==');
  console.log(`Branch: ${git(raiz, ['branch', '--show-current']) || '?'}`);
  const st = git(raiz, ['status', '--short']);
  console.log(`Alterações locais: ${st ? '\n' + st : 'nenhuma'}`);
  console.log(`Últimos commits:\n${git(raiz, ['log', '--oneline', '-5'])}`);
  for (const s of ['Agora', 'Próximo passo', 'Pendências']) { const t = secaoEstado(raiz, s); if (t) console.log(`\n-- ${s} (docs/ESTADO.md) --\n${t}`); }
  const ativo = adrAtivo(raiz);
  console.log(`\nADR ativo: ${ativo.ok ? `${ativo.adr.numero} ${ativo.adr.titulo}` : 'nenhum'}`);
  const propostos = listarAdrs(raiz).filter((a) => /Proposto/i.test(a.status));
  if (propostos.length) console.log(`ADRs propostos (decidir): ${propostos.map((a) => a.numero).join(', ')}`);
  console.log(`Pontos [VERIFICAR] na documentação: ${contarVerificar(raiz)}`);
  console.log('\nLeia antes de agir: CLAUDE.md → docs/ESTADO.md → docs/DECISOES.md → o documento da área da tarefa.');
}

function fim(raiz) {
  const st = git(raiz, ['status', '--porcelain']).split('\n').filter(Boolean).map((l) => l.slice(3));
  const codigo = st.filter((f) => !f.startsWith('docs/') && !f.endsWith('.md'));
  const estadoMudou = st.includes('docs/ESTADO.md');
  console.log('== Odin: fim de sessão ==');
  if (st.length && !estadoMudou) console.log('ATENÇÃO: há alterações e o docs/ESTADO.md não foi atualizado (Agora, Feito, Próximo passo).');
  if (codigo.length) console.log(`Código alterado (${codigo.length}): rode npm test, npm run verificar e os revisores antes do commit.`);
  const ativo = adrAtivo(raiz);
  if (ativo.ok) console.log(`ADR ${ativo.adr.numero} ainda aberto: aceite/rejeite e rode "node scripts/adr.mjs fechar".`);
  if (!st.length) console.log('Nada pendente no diretório de trabalho.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  if (cmd === 'fim') fim(process.cwd()); else inicio(process.cwd());
}
