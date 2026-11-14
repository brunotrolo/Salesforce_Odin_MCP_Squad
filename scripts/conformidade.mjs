#!/usr/bin/env node
// Testes de conformidade: o código respeita as regras invioláveis da arquitetura e da segurança?
// Cada regra só se aplica quando os arquivos dela existem; senão aparece como "não aplicável".
// Uso: node scripts/conformidade.mjs [--raiz <dir>] [--json]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORAR = ['.git', 'node_modules', '.odin-dev', 'dist', 'build', 'coverage', 'fixtures'];
function arquivos(raiz, dir, filtro) {
  const out = [];
  const base = join(raiz, dir);
  if (!existsSync(base)) return out;
  const andar = (d) => { for (const f of readdirSync(d)) { if (IGNORAR.includes(f)) continue; const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (filtro(p)) out.push(p); } };
  andar(base);
  return out;
}
const ler = (p) => readFileSync(p, 'utf8');

export const REGRAS = [
  {
    id: 'CF-01', nome: 'Nenhuma chave de conta de serviço no Terraform', fonte: 'segurança 07; CT-17',
    alvo: (r) => arquivos(r, 'infra', (p) => p.endsWith('.tf')),
    checar: (fs) => fs.filter((p) => /resource\s+"google_service_account_key"/.test(ler(p))),
  },
  {
    id: 'CF-02', nome: 'Cloud SQL sem IP público', fonte: 'segurança 07; CT-18',
    alvo: (r) => arquivos(r, 'infra', (p) => p.endsWith('.tf')).filter((p) => /google_sql_database_instance/.test(ler(p))),
    checar: (fs) => fs.filter((p) => !/ipv4_enabled\s*=\s*false/.test(ler(p))),
  },
  {
    id: 'CF-03', nome: 'Nenhum bucket ou serviço aberto a allUsers / allAuthenticatedUsers', fonte: 'segurança 07; CT-19',
    alvo: (r) => arquivos(r, 'infra', (p) => p.endsWith('.tf')),
    checar: (fs) => fs.filter((p) => /"all(Authenticated)?Users"/.test(ler(p)) && !/odin:permitir-publico/.test(ler(p))),
  },
  {
    id: 'CF-04', nome: 'Identidade federada do CI exige o mantenedor (actor_id) e a main', fonte: 'decisão 41; arquitetura 03, 7.1',
    alvo: (r) => arquivos(r, 'infra', (p) => p.endsWith('.tf')).filter((p) => /google_iam_workload_identity_pool_provider/.test(ler(p))),
    checar: (fs) => fs.filter((p) => !/actor_id/.test(ler(p)) || !/refs\/heads\/main/.test(ler(p))),
  },
  {
    id: 'CF-05', nome: 'Token de acesso com no máximo 15 minutos', fonte: 'segurança 03; CT-05',
    alvo: (r) => arquivos(r, 'apps', (p) => /\.(ts|mjs|js)$/.test(p)).filter((p) => /ACCESS_TOKEN_TTL_SECONDS/.test(ler(p))),
    checar: (fs) => fs.filter((p) => { const m = ler(p).match(/ACCESS_TOKEN_TTL_SECONDS\s*[=:]\s*(\d+)/); return !m || Number(m[1]) > 900; }),
  },
  {
    id: 'CF-06', nome: 'Servidor MCP com no máximo 7 ferramentas', fonte: 'plano 10; risco R11',
    alvo: (r) => { const d = join(r, 'apps/mcp-server/src/tools'); return existsSync(d) ? [d] : []; },
    checar: (fs) => fs.filter((d) => readdirSync(d).filter((f) => /\.(ts|mjs|js)$/.test(f) && !/^index\.|\.test\./.test(f)).length > 7),
  },
  {
    id: 'CF-07', nome: 'Algoritmo de JWT fixo em ES256 (nunca none/HS*)', fonte: 'segurança 03, 2.2',
    alvo: (r) => arquivos(r, 'apps', (p) => /\.(ts|mjs|js)$/.test(p)).filter((p) => /algorithms\s*:/.test(ler(p))),
    checar: (fs) => fs.filter((p) => /algorithms\s*:\s*\[[^\]]*(none|HS\d{3})/i.test(ler(p))),
  },
  {
    id: 'CF-08', nome: 'Nenhum token Odin ou chave privada versionada', fonte: 'segurança 05; CT-22',
    alvo: (r) => arquivos(r, '.', (p) => /\.(ts|mjs|js|json|ya?ml|tf|md|env|txt)$/.test(p) && !p.includes('termos-proibidos')),
    checar: (fs) => fs.filter((p) => /odin_(rt|pat)_[A-Za-z0-9]{24,}|-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(ler(p))),
  },
  {
    id: 'CF-09', nome: 'O CLI nunca escreve em .claude/ do projeto do dev', fonte: 'plano 22.1',
    alvo: (r) => arquivos(r, 'packages/cli', (p) => /\.(ts|mjs|js)$/.test(p) && !/\.test\./.test(p)),
    checar: (fs) => fs.filter((p) => /(process\.cwd\(\)|projectDir|projetoDir)[^;\n]{0,80}['"`]\.claude\//.test(ler(p)) && /(writeFile|mkdir|rm|copyFile|rename)/.test(ler(p))),
  },
  {
    id: 'CF-10', nome: 'Ações de terceiros nos workflows fixadas por SHA completo', fonte: 'segurança 05; CT-13',
    alvo: (r) => arquivos(r, '.github/workflows', (p) => /\.ya?ml$/.test(p)),
    checar: (fs) => fs.filter((p) => ler(p).split('\n').some((l) => { const m = l.match(/uses:\s*([^@\s]+)@(\S+)/); return m && !m[1].startsWith('./') && !/^[0-9a-f]{40}$/.test(m[2]); })),
  },
];

export function avaliar(raiz) {
  return REGRAS.map((r) => {
    const alvo = r.alvo(raiz);
    if (!alvo.length) return { id: r.id, nome: r.nome, fonte: r.fonte, resultado: 'não aplicável', violacoes: [] };
    const v = r.checar(alvo).map((p) => relative(raiz, p));
    return { id: r.id, nome: r.nome, fonte: r.fonte, resultado: v.length ? 'violação' : 'ok', violacoes: v };
  });
}

function main() {
  const a = process.argv.slice(2);
  const raiz = a.includes('--raiz') ? a[a.indexOf('--raiz') + 1] : process.cwd();
  const res = avaliar(raiz);
  if (a.includes('--json')) console.log(JSON.stringify(res, null, 2));
  else for (const r of res) console.log(`${r.resultado === 'ok' ? '✓' : r.resultado === 'violação' ? '✗' : '·'} ${r.id} ${r.nome} — ${r.resultado}${r.violacoes.length ? ': ' + r.violacoes.join(', ') : ''}`);
  if (res.some((r) => r.resultado === 'violação')) process.exit(1);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
