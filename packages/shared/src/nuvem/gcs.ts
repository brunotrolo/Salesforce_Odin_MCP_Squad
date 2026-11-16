// Armazenamento de pacotes no Cloud Storage (bucket privado, versionado). O acesso é pela conta de serviço do serviço.
import { Storage } from '@google-cloud/storage';
import type { Armazenamento } from '../armazenamento.ts';

export class ArmazenamentoGcs implements Armazenamento {
  private bucket;
  private prefixo: string;
  constructor(bucket: string, prefixo = '', storage = new Storage()) { this.bucket = storage.bucket(bucket); this.prefixo = prefixo; }
  async gravar(caminho: string, dados: Buffer): Promise<void> { await this.bucket.file(`${this.prefixo}${caminho}`).save(dados, { resumable: false }); }
  async ler(caminho: string): Promise<Buffer | null> {
    const f = this.bucket.file(`${this.prefixo}${caminho}`);
    const [existe] = await f.exists(); if (!existe) return null;
    const [dados] = await f.download(); return dados;
  }
}
