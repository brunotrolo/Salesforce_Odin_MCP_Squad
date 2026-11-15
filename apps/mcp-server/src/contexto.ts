// Tipos e dependências compartilhados pelo servidor MCP e pelas ferramentas.
import type { Armazenamento } from '../../../packages/shared/src/armazenamento.ts';
import type { Coletor } from '../../../packages/shared/src/auditoria.ts';
import type { ChavePublica } from '../../../packages/shared/src/chaves.ts';
import type { Store } from '../../../packages/shared/src/store.ts';
import type { Roteador } from '../../../packages/router/src/router.ts';
import type { SkillDoCatalogo } from '../../../packages/router/src/catalogo.ts';
import type { Conhecimento } from './conhecimento.ts';

export interface ConfigMcp {
  store: Store; armazenamento: Armazenamento; coletor: Coletor;
  /** Chaves públicas do emissor (JWKS). Função para permitir cache e rotação. */
  chavesDoEmissor: () => Promise<ChavePublica[]>;
  emissor: string; audiencias: string[]; urlPublica: string; segredoUrl: string;
  agora?: () => number; limitePorMinuto?: number; versaoServidor?: string;
}
export interface SkillPublicada extends SkillDoCatalogo { canais: { beta?: string; stable?: string }; [k: string]: unknown }
export interface Direitos {
  userId: string; status: 'ativo' | 'suspenso'; policyVersion: number;
  perfis: string[]; squads: string[]; projetos: string[];
  /** skill → canal que a pessoa recebe */
  skills: Map<string, 'beta' | 'stable'>;
  colecoes: Record<string, 'ler' | 'propor' | 'curar'>;
}
export interface Chamada {
  requestId: string; direitos: Direitos; dispositivo: string; ip: string;
  /** Pasta do runtime na máquina (cabeçalho X-Odin-Runtime), já validada. */
  runtime?: string;
  sessao?: string;
}
export interface Servicos { cfg: ConfigMcp; catalogo: () => Promise<{ skills: SkillPublicada[]; roteador: Roteador }>; conhecimento: Conhecimento; conteudo: (skill: string, versao: string) => Promise<Record<string, Buffer>> }
export type Ferramenta = (args: Record<string, unknown>, c: Chamada, s: Servicos) => Promise<{ estruturado: Record<string, unknown>; texto?: string; skill?: string; versao?: string }>;
