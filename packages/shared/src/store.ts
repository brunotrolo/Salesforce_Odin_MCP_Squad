// Armazenamento de documentos atrás de uma interface (ADR 0020): memória e arquivo no desenvolvimento local,
// Firestore na nuvem. Os serviços nunca falam com um banco específico.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type Doc = Record<string, unknown>;
export interface Store {
  get<T extends Doc = Doc>(colecao: string, id: string): Promise<T | null>;
  set(colecao: string, id: string, doc: Doc): Promise<void>;
  delete(colecao: string, id: string): Promise<void>;
  list<T extends Doc = Doc>(colecao: string, filtro?: (d: T) => boolean): Promise<Array<T & { id: string }>>;
  /** Leitura e gravação atômicas do mesmo documento. `fn` devolve o novo documento, ou null para apagar. */
  update<T extends Doc = Doc>(colecao: string, id: string, fn: (atual: T | null) => T | null): Promise<T | null>;
}

export class MemoryStore implements Store {
  protected dados: Record<string, Record<string, Doc>> = {};
  protected gravar(): void {}
  async get<T extends Doc = Doc>(c: string, id: string): Promise<T | null> { const d = this.dados[c]?.[id]; return d ? (structuredClone(d) as T) : null; }
  async set(c: string, id: string, doc: Doc): Promise<void> { (this.dados[c] ??= {})[id] = structuredClone(doc); this.gravar(); }
  async delete(c: string, id: string): Promise<void> { if (this.dados[c]) { delete this.dados[c][id]; this.gravar(); } }
  async list<T extends Doc = Doc>(c: string, filtro?: (d: T) => boolean): Promise<Array<T & { id: string }>> {
    return Object.entries(this.dados[c] ?? {}).map(([id, d]) => ({ ...(structuredClone(d) as T), id })).filter((d) => !filtro || filtro(d));
  }
  async update<T extends Doc = Doc>(c: string, id: string, fn: (atual: T | null) => T | null): Promise<T | null> {
    const atual = this.dados[c]?.[id];
    const novo = fn(atual ? (structuredClone(atual) as T) : null);
    if (novo === null) { if (this.dados[c]) delete this.dados[c][id]; } else (this.dados[c] ??= {})[id] = structuredClone(novo);
    this.gravar();
    return novo;
  }
}

/** Persistência em um arquivo JSON, com troca atômica. Só para desenvolvimento local (um processo por arquivo). */
export class FileStore extends MemoryStore {
  private caminho: string;
  constructor(caminho: string) {
    super();
    this.caminho = caminho;
    if (existsSync(caminho)) this.dados = JSON.parse(readFileSync(caminho, 'utf8'));
  }
  protected override gravar(): void {
    mkdirSync(dirname(this.caminho), { recursive: true });
    const tmp = `${this.caminho}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.dados), { mode: 0o600 });
    renameSync(tmp, this.caminho);
  }
  /** Relê do disco: usado quando outro processo local (por exemplo, o STS) gravou no mesmo arquivo. */
  recarregar(): void { if (existsSync(this.caminho)) this.dados = JSON.parse(readFileSync(this.caminho, 'utf8')); }
}
