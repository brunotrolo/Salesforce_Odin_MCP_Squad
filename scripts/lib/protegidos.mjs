// Documentos de referência protegidos: mudar qualquer um exige um ADR aberto (docs/adr).
// Fonte única usada pelo hook (.claude/hooks/guard-docs.mjs) e pela verificação do CI (scripts/verificar-docs.mjs).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export const PROTEGIDOS = [
  'docs/DECISOES.md',
  'docs/PLANO.md',
  'docs/arquitetura/',
  'docs/seguranca/',
  'docs/portal/',
];

export const MARCADOR = '.odin-dev/adr-ativo.json';
export const VALIDADE_MARCADOR_H = 12;

const norm = (p) => p.split(sep).join('/');

/** Caminho relativo à raiz do repositório, ou null se estiver fora dele. */
export function relativoAoRepo(raiz, caminho) {
  const abs = resolve(raiz, caminho);
  const rel = norm(relative(raiz, abs));
  if (!rel || rel.startsWith('..') || rel.startsWith('/')) return null;
  return rel;
}

export function ehProtegido(rel) {
  if (!rel) return false;
  return PROTEGIDOS.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
}

/** Lista os ADRs: [{ numero, arquivo, titulo, status }] */
export function listarAdrs(raiz) {
  const dir = join(raiz, 'docs/adr');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-.+\.md$/.test(f))
    .sort()
    .map((f) => {
      const t = readFileSync(join(dir, f), 'utf8');
      const titulo = (t.match(/^#\s+(.+)$/m) || [, f])[1].trim();
      const status = ((t.match(/^\*\*Status:\*\*\s*(\w+)/mi) || t.match(/^Status:\s*(\w+)/mi) || [, 'Desconhecido'])[1]).trim();
      return { numero: f.slice(0, 4), arquivo: `docs/adr/${f}`, titulo, status };
    });
}

/** Retorna { ok, motivo, adr } sobre o marcador de ADR ativo. */
export function adrAtivo(raiz, agora = Date.now()) {
  const m = join(raiz, MARCADOR);
  if (!existsSync(m)) return { ok: false, motivo: 'nenhum ADR aberto' };
  let dados;
  try { dados = JSON.parse(readFileSync(m, 'utf8')); } catch { return { ok: false, motivo: 'marcador de ADR ilegível' }; }
  const aberto = Date.parse(dados.aberto_em || '');
  if (!Number.isFinite(aberto) || agora - aberto > VALIDADE_MARCADOR_H * 3600_000) return { ok: false, motivo: `marcador de ADR vencido (validade ${VALIDADE_MARCADOR_H} h)` };
  const adr = listarAdrs(raiz).find((a) => a.numero === String(dados.adr).padStart(4, '0'));
  if (!adr) return { ok: false, motivo: `ADR ${dados.adr} não encontrado em docs/adr` };
  if (!/^(Proposto|Aceito)$/i.test(adr.status)) return { ok: false, motivo: `ADR ${adr.numero} está "${adr.status}" (precisa estar Proposto ou Aceito)` };
  return { ok: true, adr };
}

export function mtime(p) { try { return statSync(p).mtimeMs; } catch { return 0; } }
