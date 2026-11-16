// Pipeline de publicação (plano, seção 8.3): lint → reescreve caminhos → empacota → manifesto → assina → envia.
// O registro no catálogo é do job odin-publisher, que confere a assinatura (apps/jobs/src/publisher.ts).
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Armazenamento } from '../packages/shared/src/armazenamento.ts';
import { canonico, sha256hex, type Assinador } from '../packages/shared/src/chaves.ts';
import { empacotar, hashesDosArquivos, type Arquivos } from '../packages/shared/src/pacote.ts';
import { lint, type OdinYaml, type ResultadoLint } from '../packages/lint/src/lint.ts';
import { arquivosDaLib, conferirUso, LIBS_PADRAO, reescreverComLibs, type Lib } from '../packages/lint/src/libs.ts';

/** Muda quando o formato do manifesto muda: força republicar as skills mesmo sem mudança no repositório. */
export const REV_PUBLICADOR = '2';

export interface OpcoesPublicacao {
  repo: string; versao: string; canal: 'beta' | 'stable'; fonte: { repo: string; sha: string }; pipeline?: { run: string; sha: string };
  assinador: Assinador; armazenamento: Armazenamento; bucket?: string; odinYaml?: string; idsExistentes?: string[]; libsDir?: string; agora?: Date; runtimeMinCli?: string;
  /** Migração em rascunho: o contrato fica fora do repositório da skill e o passo `odin ensure` é inserido no empacotamento. */
  rascunho?: boolean;
}
export interface Publicado { manifesto: Record<string, unknown>; assinatura: string; odin: OdinYaml; avisos: string[] }
export class LintReprovado extends Error { resultado: ResultadoLint; constructor(r: ResultadoLint) { super(`odin lint reprovou:\n- ${r.erros.join('\n- ')}`); this.resultado = r; } }

export async function publicar(o: OpcoesPublicacao): Promise<Publicado> {
  const libsDir = o.libsDir ?? LIBS_PADRAO;
  const r = lint(o.repo, { odinYaml: o.odinYaml, idsExistentes: o.idsExistentes, rascunho: o.rascunho, libsDir });
  if (r.erros.length || !r.odin) throw new LintReprovado(r);
  const odin = r.odin; const dirPrincipal = odin.skills[0]!.path.replace(/\/SKILL\.md$/, '');
  const dirRuntime = odin.runtime?.dir.replace(/\/$/, '');
  // Contrato de caminhos (plano 8.5): os scripts deixam de viver em .claude/ do projeto.
  const libs: Lib[] = (odin.usa ?? []).map((ref) => conferirUso(libsDir, ref).lib!).filter(Boolean);   const reescrever = (b: Buffer, f: string): Buffer => {
    if (!/\.(md|json|ya?ml)$/.test(f)) return b;
    let t = b.toString('utf8'); if (dirRuntime) t = t.replaceAll(dirRuntime, '{{ODIN_RUNTIME}}/scripts'); t = reescreverComLibs(t, libs);
    return Buffer.from(t);
  };
  const ler = (f: string) => reescrever(readFileSync(join(o.repo, f)), f);

  const conteudo: Arquivos = {};
  for (const f of r.arquivos.skills) conteudo[f === odin.skills[0]!.path ? 'SKILL.md' : `skills/${basename(f.replace(/\/SKILL\.md$/, ''))}/SKILL.md`] = ler(f);
  if (o.rascunho && !conteudo['SKILL.md']!.toString('utf8').includes(`odin ensure ${odin.id}`)) {
    const md = conteudo['SKILL.md']!.toString('utf8'); const fim = md.startsWith('---') ? md.indexOf('\n---', 3) + 4 : 0;
    conteudo['SKILL.md'] = Buffer.from(`${md.slice(0, fim)}\n\n> **Primeiro passo (Odin):** rode \`odin ensure ${odin.id}\` e só continue se a resposta tiver \`"ok": true\`.\n${md.slice(fim)}`);
  }
  for (const f of r.arquivos.referencias) conteudo[f.slice(dirPrincipal.length + 1)] = ler(f);
  for (const f of r.arquivos.regras) conteudo[`regras/${basename(f)}`] = ler(f);
  const runtime: Arquivos = {};
  for (const f of r.arquivos.runtime) runtime[`scripts/${f.slice(dirRuntime!.length + 1)}`] = readFileSync(join(o.repo, f));
  for (const f of r.arquivos.agentes) runtime[`agentes/odin-${odin.id}-${basename(f)}`] = ler(f);
  for (const lib of libs) for (const [k, v] of Object.entries(arquivosDaLib(lib))) runtime[`libs/${lib.id}/${k}`] = v; // biblioteca de terceiros (ADR 0028): dentro do runtime assinado
  for (const [k, v] of Object.entries(conteudo)) runtime[`conteudo/${k}`] = v; // cópia local para o modo degradado (decisão 14)

  const pc = empacotar(conteudo), pr = empacotar(runtime);
  const base = `pacotes/${odin.id}/${o.versao}`; const bucket = o.bucket ?? 'odin-bundles-local';
  const manifesto = {
    schema: 'odin.bundle/1', skill: odin.id, versao: o.versao, canal: o.canal, fonte: o.fonte,
    pipeline: { ...(o.pipeline ?? { run: 'https://localhost/execucao-local', sha: o.fonte.sha }), rev: REV_PUBLICADOR },
    pacotes: { conteudo: { uri: `gs://${bucket}/${base}/conteudo.odinpkg`, sha256: sha256hex(pc) }, runtime: { uri: `gs://${bucket}/${base}/runtime.odinpkg`, sha256: sha256hex(pr) } },
    arquivos: { ...hashesDosArquivos(conteudo, 'conteudo'), ...hashesDosArquivos(runtime, 'runtime') },
    entrega: { copias: [...new Set([...odin.skills.map((s) => s.path.replace(/\/SKILL\.md$/, '')), ...r.arquivos.agentes, ...r.arquivos.regras])], prerequisitos: odin.runtime?.prerequisitos ?? [], agentes: Object.keys(runtime).filter((k) => k.startsWith('agentes/')).map((k) => k.slice(8)), colecoes: odin.conhecimento ?? [], politicas: odin.politicas ?? [], libs: libs.map((l) => ({ id: l.id, versao: l.versao, licenca: l.licenca })), ...(odin.runtime?.node ? { node: odin.runtime.node } : {}) },
    runtime_min_cli: o.runtimeMinCli ?? '0.1.0', emitido_em: (o.agora ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'), kid: o.assinador.kid,
  };
  const assinatura = Buffer.from(await o.assinador.assinar(Buffer.from(canonico(manifesto)))).toString('base64');
  await o.armazenamento.gravar(`${base}/conteudo.odinpkg`, pc);
  await o.armazenamento.gravar(`${base}/runtime.odinpkg`, pr);
  await o.armazenamento.gravar(`${base}/manifesto.json`, Buffer.from(JSON.stringify(manifesto, null, 2)));
  await o.armazenamento.gravar(`${base}/manifesto.sig`, Buffer.from(assinatura));
  return { manifesto, assinatura, odin, avisos: r.avisos };
}
