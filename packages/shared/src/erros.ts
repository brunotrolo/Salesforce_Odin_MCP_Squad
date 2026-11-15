// Erros com código estável (schemas/mcp-tools.json → erro). A mensagem é para a pessoa, em português.
export type CodigoErro = 'sem_acesso' | 'skill_inexistente' | 'versao_indisponivel' | 'limite_excedido' | 'revogado' | 'manutencao' | 'invalido' | 'interno';

const HTTP: Record<CodigoErro, number> = { sem_acesso: 403, skill_inexistente: 404, versao_indisponivel: 404, limite_excedido: 429, revogado: 401, manutencao: 503, invalido: 400, interno: 500 };

export class OdinErro extends Error {
  codigo: CodigoErro;
  tentarEmS?: number;
  constructor(codigo: CodigoErro, mensagem: string, tentarEmS?: number) {
    super(mensagem);
    this.codigo = codigo;
    this.tentarEmS = tentarEmS;
  }
  get http(): number { return HTTP[this.codigo]; }
  corpo(requestId: string) {
    return { codigo: this.codigo, mensagem: this.message, request_id: requestId, ...(this.tentarEmS !== undefined ? { tentar_em_s: this.tentarEmS } : {}) };
  }
}

export const paraOdinErro = (e: unknown): OdinErro => (e instanceof OdinErro ? e : new OdinErro('interno', 'Erro interno. Tente de novo; se persistir, abra um chamado com o request_id.'));
