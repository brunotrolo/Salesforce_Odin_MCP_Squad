// Store sobre o Firestore (modo nativo). Documentos de controle do Odin: identidade, acesso, catálogo, RAG da PoC.
// `list` lê a coleção e filtra na aplicação: no volume do E0 e E1 (dezenas de documentos por coleção) isso cabe na faixa gratuita;
// coleções grandes ganham índice e consulta própria quando houver medição (arquitetura 05).
import { Firestore } from '@google-cloud/firestore';
import type { Doc, Store } from '../store.ts';

const ID = /^[A-Za-z0-9_.@#-]{1,200}$/;
const idSeguro = (id: string): string => (ID.test(id) ? id : encodeURIComponent(id).replace(/%/g, '~').slice(0, 200));

export class FirestoreStore implements Store {
  private db: Firestore;
  private prefixo: string;
  /** `prefixo` isola execuções de teste dentro do mesmo banco (por exemplo, `homolog-123_`); vazio em produção. */
  constructor(projectId: string, prefixo = '', db?: Firestore) { this.db = db ?? new Firestore({ projectId, ignoreUndefinedProperties: true }); this.prefixo = prefixo; }
  private col(c: string) { return this.db.collection(`${this.prefixo}${c}`); }
  async get<T extends Doc = Doc>(c: string, id: string): Promise<T | null> { const s = await this.col(c).doc(idSeguro(id)).get(); return s.exists ? (s.data() as T) : null; }
  async set(c: string, id: string, doc: Doc): Promise<void> { await this.col(c).doc(idSeguro(id)).set(doc); }
  async delete(c: string, id: string): Promise<void> { await this.col(c).doc(idSeguro(id)).delete(); }
  async list<T extends Doc = Doc>(c: string, filtro?: (d: T) => boolean): Promise<Array<T & { id: string }>> {
    const s = await this.col(c).get();
    return s.docs.map((d) => ({ ...(d.data() as T), id: d.id })).filter((d) => !filtro || filtro(d));
  }
  async update<T extends Doc = Doc>(c: string, id: string, fn: (atual: T | null) => T | null): Promise<T | null> {
    const ref = this.col(c).doc(idSeguro(id));
    return this.db.runTransaction(async (t) => {
      const s = await t.get(ref); const novo = fn(s.exists ? (s.data() as T) : null);
      if (novo === null) { if (s.exists) t.delete(ref); } else t.set(ref, novo);
      return novo;
    });
  }
  /** Só para testes: apaga todas as coleções com o prefixo informado. */
  async limparPrefixo(colecoes: string[]): Promise<void> { for (const c of colecoes) for (const d of (await this.col(c).get()).docs) await d.ref.delete(); }
}
