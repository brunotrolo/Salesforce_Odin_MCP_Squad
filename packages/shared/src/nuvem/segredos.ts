// Leitura de segredos do Secret Manager pela API REST, com a credencial padrão da conta de serviço (sem biblioteca extra).
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
export async function lerSegredo(projectId: string, nome: string, versao = 'latest'): Promise<string> {
  const c = await auth.getClient();
  const r = await c.request<{ payload?: { data?: string } }>({ url: `https://secretmanager.googleapis.com/v1/projects/${projectId}/secrets/${nome}/versions/${versao}:access` });
  const dado = r.data.payload?.data; if (!dado) throw new Error(`segredo ${nome} vazio`);
  return Buffer.from(dado, 'base64').toString('utf8');
}
