// Armazenamento de objetos (pacotes assinados) atrás de uma interface: pasta local no desenvolvimento, Cloud Storage na nuvem.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

export interface Armazenamento { gravar(caminho: string, dados: Buffer): Promise<void>; ler(caminho: string): Promise<Buffer | null> }

export class ArmazenamentoLocal implements Armazenamento {
  private raiz: string;
  constructor(raiz: string) { this.raiz = resolve(raiz); }
  private abs(c: string): string { const p = resolve(join(this.raiz, c)); if (p !== this.raiz && !p.startsWith(this.raiz + sep)) throw new Error('caminho fora do armazenamento'); return p; }
  async gravar(c: string, dados: Buffer): Promise<void> { const p = this.abs(c); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, dados); }
  async ler(c: string): Promise<Buffer | null> { const p = this.abs(c); return existsSync(p) ? readFileSync(p) : null; }
}
export class ArmazenamentoMemoria implements Armazenamento {
  private m = new Map<string, Buffer>();
  async gravar(c: string, d: Buffer): Promise<void> { this.m.set(c, Buffer.from(d)); }
  async ler(c: string): Promise<Buffer | null> { return this.m.get(c) ?? null; }
}
