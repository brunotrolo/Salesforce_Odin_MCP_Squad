// Embeddings densos pela Vertex AI (modelo text-embedding-005). Sem biblioteca extra: REST com o token da conta de serviço.
import { GoogleAuth } from 'google-auth-library';

export type Tarefa = 'documento' | 'consulta';
export interface EmbedderDenso { incorporar(textos: string[], tarefa: Tarefa): Promise<number[][]> }

export class EmbedderVertex implements EmbedderDenso {
  private auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  private projeto: string; private regiao: string; private modelo: string; private dimensoes: number; private http: typeof fetch;
  constructor(projeto: string, regiao = 'us-central1', modelo = 'text-embedding-005', dimensoes = 256, http: typeof fetch = fetch) { this.projeto = projeto; this.regiao = regiao; this.modelo = modelo; this.dimensoes = dimensoes; this.http = http; }
  async incorporar(textos: string[], tarefa: Tarefa): Promise<number[][]> {
    const saida: number[][] = [];
    for (let i = 0; i < textos.length; i += 20) saida.push(...(await this.lote(textos.slice(i, i + 20), tarefa)));
    return saida;
  }
  private async lote(textos: string[], tarefa: Tarefa): Promise<number[][]> {
    const token = await this.auth.getAccessToken();
    const url = `https://${this.regiao}-aiplatform.googleapis.com/v1/projects/${this.projeto}/locations/${this.regiao}/publishers/google/models/${this.modelo}:predict`;
    for (let tentativa = 0; ; tentativa++) {
      const r = await this.http(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ instances: textos.map((t) => ({ content: t.slice(0, 8000), task_type: tarefa === 'consulta' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT' })), parameters: { outputDimensionality: this.dimensoes } }) });
      if (r.ok) { const j = (await r.json()) as { predictions?: Array<{ embeddings?: { values?: number[] } }> }; const v = (j.predictions ?? []).map((p) => p.embeddings?.values ?? []); if (v.length !== textos.length || v.some((x) => !x.length)) throw new Error('A Vertex AI devolveu embeddings incompletos.'); return v.map(normalizar); }
      if ((r.status === 429 || r.status >= 500) && tentativa < 2) { await new Promise((ok) => setTimeout(ok, 800 * (tentativa + 1))); continue; }
      throw new Error(`Vertex AI recusou os embeddings (${r.status}): ${(await r.text()).slice(0, 200)}`);
    }
  }
}
export function normalizar(v: number[]): number[] { const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1; return v.map((x) => x / n); }
export const cosseno = (a: number[], b: number[]): number => { let s = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i]! * b[i]!; return s; };
