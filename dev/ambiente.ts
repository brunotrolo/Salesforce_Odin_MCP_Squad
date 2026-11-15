// Ambiente local do Odin: emissor de tokens e servidor MCP no mesmo processo, com armazenamento em memória ou arquivo,
// chaves locais, catálogo das skills e pessoas fictícias. Usado por `npm run dev`, `npm run demo` e pelos testes de ponta a ponta.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registrarVersao } from '../apps/jobs/src/publisher.ts';
import { criarMcp } from '../apps/mcp-server/src/servidor.ts';
import { criarSts } from '../apps/sts/src/sts.ts';
import { lerCatalogo } from '../packages/router/src/catalogo.ts';
import { ArmazenamentoLocal, ArmazenamentoMemoria, type Armazenamento } from '../packages/shared/src/armazenamento.ts';
import { coletorMemoria, type EventoAuditoria } from '../packages/shared/src/auditoria.ts';
import { AssinadorLocal } from '../packages/shared/src/chaves.ts';
import { FileStore, MemoryStore, type Store } from '../packages/shared/src/store.ts';
import { publicar } from '../pipeline/publicar.ts';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export interface AmbienteLocal {
  store: Store; armazenamento: Armazenamento; eventos: EventoAuditoria[]; assinadorPacotes: AssinadorLocal;
  sts: string; mcp: string; arquivoChaves: string; aprovar: (codigo: string, userId: string) => Promise<unknown>;
  publicarSkill: (repo: string, versao: string, o?: { odinYaml?: string; promover?: boolean }) => Promise<string[]>;
  mcpApp: ReturnType<typeof criarMcp>; fechar: () => Promise<void>;
}

function assinador(dir: string | undefined, nome: string, kid: string): AssinadorLocal {
  if (!dir) return AssinadorLocal.gerar(kid).assinador;
  const f = join(dir, `${nome}.pem`);
  if (existsSync(f)) return new AssinadorLocal(kid, readFileSync(f, 'utf8'));
  const { assinador: a, pem } = AssinadorLocal.gerar(kid); mkdirSync(dir, { recursive: true }); writeFileSync(f, pem, { mode: 0o600 }); return a;
}
const escutar = (s: Server, porta: number) => new Promise<number>((ok) => s.listen(porta, '127.0.0.1', () => ok((s.address() as AddressInfo).port)));

/** Semeia perfis, squads, projetos, pessoas fictícias e as skills do catálogo (ainda sem versão publicada). */
export async function semear(store: Store): Promise<void> {
  const { skills, perfis } = lerCatalogo(RAIZ);
  for (const [nome, p] of Object.entries(perfis)) await store.set('profiles', nome, { ...p, skills: nome === 'mantenedor' ? [...p.skills, 'odin-ambiente'] : [...p.skills, 'odin-ambiente'] });
  for (const s of skills) if (!(await store.get('catalog_skills', s.id))) await store.set('catalog_skills', s.id, { ...s, canais: {} });
  await store.set('projects', 'projeto-atlas', { nome: 'Projeto Atlas', cliente: 'Cliente Exemplo', classificacao: 'interna' });
  await store.set('projects', 'projeto-boreal', { nome: 'Projeto Boreal', cliente: 'Outro Cliente Exemplo', classificacao: 'interna' });
  await store.set('squads', 'squad-atendimento', { nome: 'Squad Atendimento', projetos: ['projeto-atlas'] });
  await store.set('squads', 'squad-vendas', { nome: 'Squad Vendas', projetos: ['projeto-boreal'] });
  const pessoas: Array<[string, string, string, string, string[]]> = [
    ['usr_dev', 'dev-exemplo', 'Dev Exemplo', 'squad-atendimento', ['dev']], ['usr_po', 'po-exemplo', 'PO Exemplo', 'squad-atendimento', ['po']],
    ['usr_qa', 'qa-exemplo', 'QA Exemplo', 'squad-vendas', ['qa']], ['usr_arq', 'arquiteta-exemplo', 'Arquiteta Exemplo', 'squad-vendas', ['arquiteto']],
    ['usr_mant', 'mantenedor-exemplo', 'Mantenedor Exemplo', 'squad-atendimento', ['mantenedor']],
  ];
  let gh = 1000;
  for (const [id, login, nome, squad, perfis2] of pessoas) {
    if (!(await store.get('users', id))) await store.set('users', id, { githubId: gh++, githubLogin: login, nome, status: 'ativo', policyVersion: 1 });
    await store.set('memberships', `${id}_${squad}`, { userId: id, squadId: squad, perfis: perfis2, origem: 'portal' });
  }
  const kb: Array<[string, string, string, string, string]> = [
    ['TEC-APEX-012', 'Callouts em teste', 'tecnico', 'global', 'Em testes Apex, use HttpCalloutMock e isole o callout num serviço injetável; nunca chame o endpoint real em teste.'],
    ['TEC-APEX-020', 'Triggers', 'tecnico', 'global', 'Uma trigger por objeto, sem lógica: delegue a uma classe handler e trate registros em lote (bulk), sem SOQL ou DML dentro de laço.'],
    ['NEG-ATLAS-003', 'Prazo de resposta', 'negocio', 'projeto-atlas', 'No Projeto Atlas, casos de prioridade alta têm prazo de primeira resposta de 2 horas úteis, contado do registro do caso.'],
    ['NEG-BOREAL-001', 'Aprovação de desconto', 'negocio', 'projeto-boreal', 'No Projeto Boreal, descontos acima de 15% exigem aprovação do gerente regional antes do envio da proposta.'],
  ];
  for (const [documento, secao, colecao, projeto, texto] of kb) await store.set('kb_chunks', documento, { documento, secao, colecao, projeto, texto, versao: '1', vigencia: 'desde 2026-01', sensibilidade: 'interna' });
}

export async function subirLocal(o: { dir?: string; portaSts?: number; portaMcp?: number; agora?: () => number } = {}): Promise<AmbienteLocal> {
  const store: Store = o.dir ? new FileStore(join(o.dir, 'dados.json')) : new MemoryStore();
  const armazenamento: Armazenamento = o.dir ? new ArmazenamentoLocal(join(o.dir, 'pacotes')) : new ArmazenamentoMemoria();
  const jwt = assinador(o.dir, 'jwt-signing', 'jwt-local-a'); const pacotes = assinador(o.dir, 'bundle-signing', 'bundle-2026-a');
  const { coletor, eventos } = coletorMemoria();
  await semear(store);
  const srvSts = createServer(); const srvMcp = createServer();
  const pSts = await escutar(srvSts, o.portaSts ?? 0); const pMcp = await escutar(srvMcp, o.portaMcp ?? 0);
  const sts = `http://127.0.0.1:${pSts}`; const mcpBase = `http://127.0.0.1:${pMcp}`;
  const descoberta = { emissor: sts, mcp: `${mcpBase}/mcp`, sts, portal: sts, audiencias: [mcpBase], cli_min: '0.1.0', estagio: 'e0' };
  const stsApp = criarSts({ store, assinador: jwt, coletor, emissor: sts, audiencias: [mcpBase], portalUrl: sts, pimenta: 'pimenta-local-de-desenvolvimento', loginDev: true, descoberta, agora: o.agora });
  const mcpApp = criarMcp({ store, armazenamento, coletor, chavesDoEmissor: async () => [jwt.publica()], emissor: sts, audiencias: [mcpBase], urlPublica: mcpBase, segredoUrl: 'segredo-local-de-url', agora: o.agora });
  srvSts.on('request', (q, r) => { void stsApp.handler(q, r); }); srvMcp.on('request', (q, r) => { void mcpApp.handler(q, r); });
  await mcpApp.registrarFerramentas();
  const arquivoChaves = join(o.dir ?? RAIZ, o.dir ? 'chaves-de-pacote.json' : `.odin-dev/chaves-${process.pid}-${pMcp}.json`);
  mkdirSync(join(arquivoChaves, '..'), { recursive: true }); writeFileSync(arquivoChaves, JSON.stringify([pacotes.publica()]));
  const deps = { store, armazenamento, chavesDePacote: [pacotes.publica()], coletor, agora: o.agora };
  return {
    store, armazenamento, eventos, assinadorPacotes: pacotes, sts, mcp: `${mcpBase}/mcp`, arquivoChaves, mcpApp,
    aprovar: (codigo, userId) => stsApp.aprovarDispositivo(codigo, userId),
    async publicarSkill(repo, versao, op = {}) {
      const p = await publicar({ repo, versao, canal: 'beta', fonte: { repo: `dono-exemplo/${repo.split(/[\\/]/).filter(Boolean).pop()}`, sha: '0'.repeat(40) }, assinador: pacotes, armazenamento, odinYaml: op.odinYaml });
      const meta = { nome: p.odin.nome, dominio: p.odin.dominio, descricao: p.odin.descricao, etapa: 0, estado: 'beta', proximo: p.odin.proximo ?? [], intencoes: p.odin.intencoes.map((i) => (typeof i === 'string' ? { texto: i } : i)) };
      const existente = await store.get('catalog_skills', p.odin.id);
      await registrarVersao(deps, p.odin.id, versao, existente ? undefined : meta);
      if (op.promover !== false) { const { promover } = await import('../apps/jobs/src/publisher.ts'); await promover(deps, p.odin.id, versao); }
      mcpApp.esquecerCatalogo();
      return p.avisos;
    },
    fechar: () => new Promise<void>((ok) => { srvSts.close(() => srvMcp.close(() => ok())); srvSts.closeAllConnections(); srvMcp.closeAllConnections(); }),
  };
}
