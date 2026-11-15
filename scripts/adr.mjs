#!/usr/bin/env node
// Registro de decisões de arquitetura (ADR) do Odin.
// Uso:
//   node scripts/adr.mjs novo "Título da decisão"   cria docs/adr/NNNN-titulo.md (Proposto) e abre o marcador
//   node scripts/adr.mjs abrir <n>                   reabre o marcador para um ADR Proposto ou Aceito
//   node scripts/adr.mjs aceitar <n> | rejeitar <n> | substituir <n> <por>
//   node scripts/adr.mjs fechar                      remove o marcador (fim da mudança)
//   node scripts/adr.mjs listar | status
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listarAdrs, adrAtivo, MARCADOR } from './lib/protegidos.mjs';

export const PRIMEIRO_NUMERO = 16; // ADR-01 a ADR-15 vivem em docs/arquitetura/01-arquitetura-de-solucao.md

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const hoje = () => new Date().toISOString().slice(0, 10);

export function proximoNumero(raiz) {
  const n = listarAdrs(raiz).map((a) => Number(a.numero));
  return String(Math.max(PRIMEIRO_NUMERO - 1, ...n) + 1).padStart(4, '0');
}

export function gravarMarcador(raiz, numero) {
  mkdirSync(join(raiz, dirname(MARCADOR)), { recursive: true });
  writeFileSync(join(raiz, MARCADOR), JSON.stringify({ adr: numero, aberto_em: new Date().toISOString() }, null, 2));
}

export function novo(raiz, titulo) {
  if (!titulo || titulo.length < 5) throw new Error('informe um título com pelo menos 5 caracteres');
  const numero = proximoNumero(raiz);
  const modelo = readFileSync(join(raiz, 'docs/adr/0000-modelo.md'), 'utf8').replace(/\r\n/g, '\n');
  const texto = modelo
    .replace(/^#\s+.*$/m, `# ${numero}. ${titulo}`)
    .replace(/^\*\*Status:\*\*.*$/m, '**Status:** Proposto')
    .replace(/^\*\*Data:\*\*.*$/m, `**Data:** ${hoje()}`);
  const arquivo = `docs/adr/${numero}-${slug(titulo)}.md`;
  writeFileSync(join(raiz, arquivo), texto);
  gravarMarcador(raiz, numero);
  return { numero, arquivo };
}

function mudarStatus(raiz, n, status, extra = '') {
  const adr = listarAdrs(raiz).find((a) => a.numero === String(n).padStart(4, '0'));
  if (!adr) throw new Error(`ADR ${n} não encontrado`);
  const p = join(raiz, adr.arquivo);
  const t = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^\*\*Status:\*\*.*$/m, `**Status:** ${status}${extra}`);
  writeFileSync(p, t);
  return adr.arquivo;
}

function main() {
  const raiz = process.cwd();
  const [cmd, ...args] = process.argv.slice(2);
  try {
    switch (cmd) {
      case 'novo': { const r = novo(raiz, args.join(' ').trim()); console.log(`ADR ${r.numero} criado: ${r.arquivo}\nMarcador aberto: documentos protegidos liberados por 12 h. Preencha o ADR, atualize os documentos e rode "node scripts/adr.mjs fechar".`); break; }
      case 'abrir': { const a = listarAdrs(raiz).find((x) => x.numero === String(args[0]).padStart(4, '0')); if (!a) throw new Error(`ADR ${args[0]} não encontrado`); if (!/^(Proposto|Aceito)$/i.test(a.status)) throw new Error(`ADR ${a.numero} está ${a.status}`); gravarMarcador(raiz, a.numero); console.log(`Marcador aberto para o ADR ${a.numero}.`); break; }
      case 'aceitar': console.log(`Aceito: ${mudarStatus(raiz, args[0], 'Aceito', ` (${hoje()})`)}`); break;
      case 'rejeitar': console.log(`Rejeitado: ${mudarStatus(raiz, args[0], 'Rejeitado', ` (${hoje()})`)}`); break;
      case 'substituir': console.log(`Substituído: ${mudarStatus(raiz, args[0], 'Substituído', ` pelo ADR ${String(args[1]).padStart(4, '0')} (${hoje()})`)}`); break;
      case 'fechar': if (existsSync(join(raiz, MARCADOR))) rmSync(join(raiz, MARCADOR)); console.log('Marcador fechado: documentos protegidos voltam a exigir ADR.'); break;
      case 'status': { const s = adrAtivo(raiz); console.log(s.ok ? `ADR ativo: ${s.adr.numero} (${s.adr.status}) ${s.adr.titulo}` : `Nenhum ADR ativo: ${s.motivo}`); break; }
      case 'listar': default: {
        const l = listarAdrs(raiz).filter((a) => a.numero !== '0000');
        if (!l.length) console.log('Nenhum ADR além do modelo. ADR-01 a ADR-15: docs/arquitetura/01-arquitetura-de-solucao.md; decisões 1 a 41: docs/DECISOES.md');
        for (const a of l) console.log(`${a.numero}  ${a.status.padEnd(11)} ${a.titulo}`);
      }
    }
  } catch (e) { console.error(`Erro: ${e.message}`); process.exit(1); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
