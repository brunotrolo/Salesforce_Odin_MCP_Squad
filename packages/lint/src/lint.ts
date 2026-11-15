// odin lint: o que pode e o que não pode entrar num pacote de skill (plano, seções 8.3 e 22.5; ADR 0017).
// Quem decide é este código, no pipeline e no `odin doctor`; as skills de manutenção só preparam.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import YAML from 'yaml';
import { caracteresOcultos } from '../../../scripts/lib/unicode.mjs';
import { estimarTokens } from '../../shared/src/http.ts';
import { MAX_TOOL_RESPONSE_TOKENS, SKILL_TARGET_TOKENS } from '../../shared/src/limites.ts';
import { casaPadrao } from '../../router/src/router.ts';

export interface OdinYaml {
  id: string; nome: string; dominio: string; dono: string; descricao: string; intencoes: Array<string | { texto: string; negativa?: boolean }>;
  skills: Array<{ path: string }>; agentes?: string[]; regras?: string[]; proximo?: string[]; conhecimento?: string[]; politicas?: string[]; avaliacoes?: string;
  runtime?: { dir: string; node?: string; dependencias?: string; prerequisitos?: string[] };
}
export interface ResultadoLint { erros: string[]; avisos: string[]; odin?: OdinYaml; arquivos: { skills: string[]; agentes: string[]; regras: string[]; referencias: string[]; runtime: string[] } }

const PROIBIDOS = /(^|\/)(CLAUDE\.md|AGENTS\.md|README\.md|settings(\.local)?\.json|\.mcp\.json|\.env[^/]*)$/i;
const SEGREDO = /odin_(rt|pat)_[A-Za-z0-9_-]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{20,})\b/;
const TEXTO = /\.(md|mjs|js|cjs|ts|json|ya?ml|txt|sh|ps1|html|css|cls|xml)$/i;
const raizDoRepo = new URL('../../../', import.meta.url);
const esquema = (nome: string) => JSON.parse(readFileSync(new URL(`schemas/${nome}`, raizDoRepo), 'utf8'));

export function listar(dir: string): string[] {
  const out: string[] = [];
  const andar = (d: string) => { for (const f of readdirSync(d)) { if (f === 'node_modules' || f === '.git') continue; const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else out.push(relative(dir, p).split('\\').join('/')); } };
  if (existsSync(dir)) andar(dir);
  return out.sort();
}

/** Lê e confere um repositório de skill. `odinYaml` permite um contrato fora do repositório (rascunho de migração). */
export function lint(repo: string, o: { odinYaml?: string; idsExistentes?: string[]; rascunho?: boolean } = {}): ResultadoLint {
  const r: ResultadoLint = { erros: [], avisos: [], arquivos: { skills: [], agentes: [], regras: [], referencias: [], runtime: [] } };
  const caminhoYaml = o.odinYaml ?? join(repo, 'odin.yaml');
  if (!existsSync(caminhoYaml)) { r.erros.push('odin.yaml não encontrado'); return r; }
  let odin: OdinYaml;
  try { odin = YAML.parse(readFileSync(caminhoYaml, 'utf8')); } catch (e) { r.erros.push(`odin.yaml inválido: ${(e as Error).message}`); return r; }
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const valida = ajv.compile(esquema('odin.schema.json'));
  if (!valida(odin)) { r.erros.push(...(valida.errors ?? []).slice(0, 5).map((e) => `odin.yaml ${e.instancePath || '/'}: ${e.message}`)); return r; }
  r.odin = odin;
  const todos = listar(repo);
  const expandir = (padroes: string[] = []) => { const s = new Set<string>(); for (const p of padroes) { const m = todos.filter((f) => casaPadrao(p, f)); if (!m.length) r.erros.push(`caminho declarado não existe: ${p}`); m.forEach((f) => s.add(f)); } return [...s].sort(); };

  r.arquivos.skills = expandir(odin.skills.map((s) => s.path));
  r.arquivos.agentes = expandir(odin.agentes);
  r.arquivos.regras = expandir(odin.regras);
  const dirPrincipal = odin.skills[0]!.path.replace(/\/SKILL\.md$/, '');
  r.arquivos.referencias = todos.filter((f) => f.startsWith(`${dirPrincipal}/references/`));
  if (odin.runtime) { r.arquivos.runtime = todos.filter((f) => f.startsWith(`${odin.runtime!.dir.replace(/\/$/, '')}/`)); if (!r.arquivos.runtime.length) r.erros.push(`runtime.dir vazio ou inexistente: ${odin.runtime.dir}`); }

  const entregues = [...r.arquivos.skills, ...r.arquivos.agentes, ...r.arquivos.regras, ...r.arquivos.referencias, ...r.arquivos.runtime];
  for (const f of entregues) {
    // README dentro de references/ é conteúdo da skill; na raiz ou em .claude/ é documentação de quem mantém
    if (PROIBIDOS.test(f) && !(/README\.md$/i.test(f) && /\/references\//.test(f))) r.erros.push(`arquivo proibido no pacote: ${f}`);
    if (!TEXTO.test(f)) continue;
    const t = readFileSync(join(repo, f), 'utf8').replace(/\r\n/g, '\n');
    const oc = caracteresOcultos(t) as Array<{ linha: number; codigo: string }>;
    if (oc.length) r.erros.push(`${f}:${oc[0]!.linha}: caractere Unicode oculto ${oc[0]!.codigo}`);
    if (SEGREDO.test(t)) r.erros.push(`${f}: parece conter um segredo`);
    if (f.endsWith('.md') && !r.arquivos.runtime.includes(f)) {
      const tk = estimarTokens(t);
      if (tk > MAX_TOOL_RESPONSE_TOKENS) r.erros.push(`${f}: ${tk} tokens (teto de ${MAX_TOOL_RESPONSE_TOKENS}); divida em referências`);
      else if (tk > SKILL_TARGET_TOKENS) r.avisos.push(`${f}: ${tk} tokens (alvo de ${SKILL_TARGET_TOKENS})`);
    }
  }
  const principal = r.arquivos.skills.find((f) => f === odin.skills[0]!.path);
  if (principal) {
    const t = readFileSync(join(repo, principal), 'utf8');
    if (!/^---\n(?:[\s\S]*?\n)?name:\s*\S+/.test(t.replace(/\r\n/g, '\n'))) r.erros.push(`${principal}: sem frontmatter com name`);
    if (!t.includes(`odin ensure ${odin.id}`)) (o.rascunho ? r.avisos : r.erros).push(`${principal}: o primeiro passo precisa ser \`odin ensure ${odin.id}\``);
  }
  for (const a of r.arquivos.agentes) if (!/(^|\n)tools:\s*\S/.test(readFileSync(join(repo, a), 'utf8'))) r.erros.push(`${a}: agente sem tools explícitas`);
  if ((o.idsExistentes ?? []).includes(odin.id)) r.erros.push(`colisão de id: ${odin.id} já existe no catálogo`);
  if (odin.avaliacoes) {
    const casos = join(repo, 'evals/casos.yaml');
    if (!existsSync(casos)) r.avisos.push('avaliacoes declarado, mas evals/casos.yaml não existe');
    else { const v = ajv.compile(esquema('eval-casos.schema.json')); if (!v(YAML.parse(readFileSync(casos, 'utf8')))) r.erros.push(`evals/casos.yaml: ${(v.errors ?? [])[0]?.instancePath} ${(v.errors ?? [])[0]?.message}`); }
  } else r.avisos.push('sem avaliações de comportamento (evals/): obrigatório antes de promover para stable');
  return r;
}
