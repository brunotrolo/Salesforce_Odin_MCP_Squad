// Cofre de credenciais. Nesta versão: arquivo com permissão 0600 em ~/.odin/cache (alternativa prevista na arquitetura 03, 9.1).
// O cofre do sistema (Windows Credential Manager, Keychain, libsecret) entra atrás desta mesma interface.
import { join } from 'node:path';
import { caminhos, gravarAtomico, lerJsonArquivo } from './ambiente.ts';

export interface Cofre { ler(chave: string): string | null; gravar(chave: string, valor: string): void; apagar(chave: string): void }
export class CofreArquivo implements Cofre {
  private arquivo = join(caminhos().cache, 'cofre.json');
  private todos(): Record<string, string> { return lerJsonArquivo<Record<string, string>>(this.arquivo) ?? {}; }
  ler(chave: string): string | null { return this.todos()[chave] ?? null; }
  gravar(chave: string, valor: string): void { gravarAtomico(this.arquivo, JSON.stringify({ ...this.todos(), [chave]: valor })); }
  apagar(chave: string): void { const t = this.todos(); delete t[chave]; gravarAtomico(this.arquivo, JSON.stringify(t)); }
}
