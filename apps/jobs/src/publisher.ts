// Job odin-publisher (ADR 0018): registra uma versão no catálogo SÓ depois de conferir a assinatura do manifesto
// e os hashes dos pacotes. Poder executar o job não basta para publicar (CT-29).
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { Armazenamento } from '../../../packages/shared/src/armazenamento.ts';
import { auditar, novoRequestId, type Coletor } from '../../../packages/shared/src/auditoria.ts';
import { canonico, sha256hex, verificarAssinatura, type ChavePublica } from '../../../packages/shared/src/chaves.ts';
import type { Store } from '../../../packages/shared/src/store.ts';

export class PublicacaoRecusada extends Error {}
export interface DepsPublisher { store: Store; armazenamento: Armazenamento; chavesDePacote: ChavePublica[]; coletor: Coletor; agora?: () => number }

const ajv = new Ajv2020({ strict: false }); (addFormats as unknown as (a: unknown) => void)(ajv);
const validarManifesto = ajv.compile(JSON.parse(readFileSync(new URL('../../../schemas/manifesto.schema.json', import.meta.url), 'utf8')));

export async function conferirManifesto(manifesto: Record<string, any>, assinaturaB64: string, chaves: ChavePublica[]): Promise<void> {
  if (!validarManifesto(manifesto)) throw new PublicacaoRecusada(`manifesto fora do contrato: ${ajv.errorsText(validarManifesto.errors)}`);
  const chave = chaves.find((c) => c.kid === manifesto.kid);
  if (!chave || !verificarAssinatura(chave.jwk, Buffer.from(canonico(manifesto)), Buffer.from(assinaturaB64, 'base64'))) throw new PublicacaoRecusada('assinatura do manifesto inválida');
}

export async function registrarVersao(d: DepsPublisher, skill: string, versao: string, meta?: Record<string, unknown>): Promise<void> {
  const rid = novoRequestId(); const base = `pacotes/${skill}/${versao}`;
  const recusar = (motivo: string): never => { auditar(d.coletor, 'odin-publisher', { ator: 'sa:publisher', acao: 'catalogo.versao_publicada', resultado: 'negado', motivo: 'invalido', request_id: rid, skill, versao, alvo: motivo.slice(0, 200) }); throw new PublicacaoRecusada(motivo); };
  const [mj, sig, pc, pr] = await Promise.all(['manifesto.json', 'manifesto.sig', 'conteudo.odinpkg', 'runtime.odinpkg'].map((f) => d.armazenamento.ler(`${base}/${f}`)));
  if (!mj || !sig || !pc || !pr) return recusar('pacote incompleto no armazenamento');
  const manifesto = JSON.parse(mj.toString('utf8')) as Record<string, any>;
  try { await conferirManifesto(manifesto, sig.toString('utf8'), d.chavesDePacote); } catch (e) { return recusar((e as Error).message); }
  if (manifesto.skill !== skill || manifesto.versao !== versao) return recusar('manifesto de outra skill ou versão');
  if (sha256hex(pc) !== manifesto.pacotes.conteudo.sha256 || sha256hex(pr) !== manifesto.pacotes.runtime.sha256) return recusar('hash do pacote diferente do manifesto');
  const agora = (d.agora ?? Date.now)();
  await d.store.set('catalog_versions', `${skill}@${versao}`, { skill, versao, manifesto, assinatura: sig.toString('utf8'), publicadoEm: agora });
  const antes = await d.store.get('catalog_skills', skill);
  await d.store.update('catalog_skills', skill, (s) => ({ ...(s ?? {}), ...(meta ?? {}), id: undefined, canais: { ...((s?.canais as object) ?? {}), [manifesto.canal]: versao } }));
  await d.store.set('catalog_events', `${agora}-${skill}`, { tipo: antes?.canais ? 'versao_publicada' : 'skill_incorporada', skill, versao, canal: manifesto.canal, sha: manifesto.fonte.sha, em: agora });
  auditar(d.coletor, 'odin-publisher', { ator: 'sa:publisher', acao: 'catalogo.versao_publicada', resultado: 'ok', request_id: rid, skill, versao });
}

/** Promoção beta → stable: aponta o canal stable para uma versão já registrada (o portão de avaliação fica no CI do catálogo). */
export async function promover(d: DepsPublisher, skill: string, versao: string): Promise<void> {
  if (!(await d.store.get('catalog_versions', `${skill}@${versao}`))) throw new PublicacaoRecusada('versão não registrada');
  await d.store.update('catalog_skills', skill, (s) => (s ? { ...s, canais: { ...((s.canais as object) ?? {}), stable: versao } } : null));
  const agora = (d.agora ?? Date.now)();
  await d.store.set('catalog_events', `${agora}-${skill}-p`, { tipo: 'versao_promovida', skill, versao, em: agora });
}
