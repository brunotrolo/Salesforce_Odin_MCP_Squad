#!/usr/bin/env node
// odin CLI. Comandos: setup, login, token, ensure, doctor, guard, status, logout, uninstall.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executarGuard } from '../../guard/src/guard.ts';
import { caminhos, gravarConfig, lerConfig, lerJsonArquivo, VERSAO_CLI, type Config } from './ambiente.ts';
import { CofreArquivo } from './cofre.ts';
import { ativar, cabecalhos } from './credenciais.ts';
import { divergencias, ensure } from './ensure.ts';
import { atualizarCli } from './atualizar.ts';
import { arquivarCopias, copiasNoProjeto, removerCopias, restaurarCopias } from './copias.ts';
import { conferirInstalacao, desinstalar, instalar } from './instalacao.ts';

const AJUDA = `odin ${VERSAO_CLI}
  odin setup --servidor <endereço> [--chaves <arquivo>]   ativa este dispositivo e conecta o Claude Code
  odin login                                              ativa de novo (credencial vencida ou revogada)
  odin ensure <skill>                                     verifica, instala e libera uma skill (usado pelas skills)
  odin doctor                                             confere a instalação e aponta o que corrigir
  odin doctor --limpar-copias [--sim]                     arquiva e remove as cópias antigas de skills deste projeto
  odin restore-copias                                     devolve as cópias arquivadas deste projeto (por 30 dias)
  odin update                                             atualiza o CLI e as skills instaladas
  odin status                                             quem sou, minhas skills e versões instaladas
  odin token                                              cabeçalhos para o Claude Code (uso interno)
  odin logout | odin uninstall                            sai deste dispositivo | remove o Odin desta máquina`;

async function descobrir(servidor: string, arquivoChaves?: string): Promise<Config> {
  const r = await fetch(`${servidor.replace(/\/$/, '')}/.well-known/odin-configuration`);
  if (!r.ok) throw new Error(`Não encontrei o Odin em ${servidor} (${r.status}).`);
  const d = (await r.json()) as Record<string, any>;
  const embutidas = lerJsonArquivo<Config['chavesDePacote']>(fileURLToPath(new URL('../chaves-de-pacote.json', import.meta.url)));
  const chaves = embutidas ?? (arquivoChaves || process.env.ODIN_CHAVES_DE_PACOTE ? lerJsonArquivo<Config['chavesDePacote']>(arquivoChaves ?? process.env.ODIN_CHAVES_DE_PACOTE!) : null);
  if (!chaves?.length) throw new Error('Este CLI não tem a chave pública dos pacotes. Em desenvolvimento, informe --chaves <arquivo>.');
  return { emissor: d.emissor, sts: d.sts, mcp: d.mcp, portal: d.portal, audiencias: d.audiencias, chavesDePacote: chaves };
}

export async function principal(argv: string[], sair: (m: string) => void = console.log): Promise<number> {
  const [cmd, ...args] = argv; const opcao = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  try {
    switch (cmd) {
      case 'setup': {
        const servidor = opcao('--servidor'); if (!servidor) throw new Error('Informe --servidor <endereço do portal do Odin>.');
        const cfg = await descobrir(servidor, opcao('--chaves')); gravarConfig(cfg);
        await ativar(cfg, sair); instalar(lerConfig());
        sair('Pronto. Dispositivo ativado e Claude Code conectado ao Odin. Abra uma sessão nova do Claude Code e peça o que precisa.');
        return 0;
      }
      case 'login': { await ativar(lerConfig(), sair); instalar(lerConfig()); sair('Dispositivo ativado de novo.'); return 0; }
      case 'token': { process.stdout.write(JSON.stringify(await cabecalhos())); return 0; }
      case 'guard': {
        const entrada = await new Promise<string>((ok) => { let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (c) => { s += c; }); process.stdin.on('end', () => ok(s)); });
        const r = executarGuard(entrada); if (r.mensagem) process.stderr.write(`${r.mensagem}\n`); return r.codigo;
      }
      case 'ensure': { const r = await ensure(args[0] ?? '', { exigirGuard: process.env.ODIN_SEM_GUARD !== '1' || !!process.env.CLAUDE_SESSION_ID }); process.stdout.write(`${JSON.stringify(r)}\n`); return r.ok ? 0 : 1; }
      case 'status': {
        const h = await cabecalhos(); const me = (await (await fetch(`${new URL(lerConfig().mcp).origin}/v1/me`, { headers: h })).json()) as Record<string, any>;
        const inst = lerJsonArquivo<Record<string, { versao: string }>>(join(caminhos().cache, 'instalados.json')) ?? {};
        sair(`Pessoa: ${me.id} · perfis: ${(me.perfis ?? []).join(', ') || 'nenhum'} · projetos: ${(me.projetos ?? []).join(', ') || 'nenhum'}`);
        for (const s of me.skills ?? []) sair(`  ${s.id.padEnd(24)} canal ${s.canal}${inst[s.id] ? ` · instalada ${inst[s.id]!.versao}` : ''}`);
        return 0;
      }
      case 'doctor': {
        if (args.includes('--limpar-copias')) {
          const c0 = caminhos(); const inst0 = lerJsonArquivo<Record<string, { versao: string }>>(join(c0.cache, 'instalados.json')) ?? {}; const declaradas: string[] = [];
          for (const [s, v] of Object.entries(inst0)) { const mf = lerJsonArquivo<{ entrega?: { copias?: string[] } }>(join(c0.runtime, s, v.versao, 'manifesto.json')); declaradas.push(...(mf?.entrega?.copias ?? [])); }
          const achadas = copiasNoProjeto(process.cwd(), declaradas); if (!achadas.length) { sair('Nenhuma cópia antiga de skills neste projeto.'); return 0; }
          achadas.forEach((a) => sair(`  ${a}`)); if (!args.includes('--sim')) { sair(`${achadas.length} arquivo(s) de cópias antigas. Rode de novo com --sim para arquivar e remover (dá para devolver com odin restore-copias por 30 dias).`); return 1; }
          const a = arquivarCopias(process.cwd(), achadas); removerCopias(process.cwd(), achadas); sair(`Arquivei ${a.n} arquivo(s) em ${a.pacote} e removi as cópias do projeto. Para devolver: odin restore-copias.`); return 0;
        }
        const c = caminhos(); const problemas = [...conferirInstalacao()];
        try { const r = await fetch(`${new URL(lerConfig().mcp).origin}/v1/me`, { headers: await cabecalhos() }); if (!r.ok) problemas.push(`o servidor recusou o acesso (${r.status})`); } catch (e) { problemas.push((e as Error).message); }
        for (const skill of existsSync(c.runtime) ? readdirSync(c.runtime) : []) {
          const inst = (lerJsonArquivo<Record<string, { versao: string }>>(join(c.cache, 'instalados.json')) ?? {})[skill]; if (!inst) continue;
          const dir = join(c.runtime, skill, inst.versao);
          if (existsSync(join(dir, 'manifesto.json')) && divergencias(dir, JSON.parse(readFileSync(join(dir, 'manifesto.json'), 'utf8'))).length) problemas.push(`o runtime da skill ${skill} foi alterado depois da instalação (será reinstalado no próximo uso)`);
        }
        for (const pasta of ['agents', 'skills']) { const d = join(process.cwd(), '.claude', pasta); if (existsSync(d)) for (const f of readdirSync(d)) if (f.startsWith('odin')) problemas.push(`este projeto tem "${pasta}/${f}" com nome do Odin, que pode sombrear o oficial`); }
        if (!problemas.length) { sair('Tudo certo: dispositivo ativo, guard instalado, Claude Code conectado.'); return 0; }
        problemas.forEach((p) => sair(`✗ ${p}`)); sair('Para reinstalar o que é do Odin: odin login'); return 1;
      }
      case 'update': {
        const r = await atualizarCli(); sair(r.mensagem);
        const inst = lerJsonArquivo<Record<string, { versao: string }>>(join(caminhos().cache, 'instalados.json')) ?? {};
        for (const skill of Object.keys(inst)) { const e = await ensure(skill, { exigirGuard: false }); sair(e.ok ? `  ${skill}: ${e.versao}${e.instalado ? ' (atualizada)' : ''}` : `  ${skill}: ${e.mensagem}`); }
        return 0;
      }
      case 'restore-copias': { const r = restaurarCopias(process.cwd()); sair(`Cópias devolvidas: ${r.restaurados} arquivo(s)${r.pulados ? `; ${r.pulados} já existiam e não foram alterados` : ''}.`); return 0; }
      case 'logout': { const k = new CofreArquivo(); ['refresh', 'acesso', 'chave-dispositivo'].forEach((x) => k.apagar(x)); sair('Você saiu deste dispositivo. Para revogar no servidor, use o portal.'); return 0; }
      case 'uninstall': { desinstalar(); sair('Odin removido desta máquina. Os arquivos do Claude Code voltaram ao que eram.'); return 0; }
      case '--version': case 'version': sair(VERSAO_CLI); return 0;
      default: sair(AJUDA); return cmd ? 1 : 0;
    }
  } catch (e) { process.stderr.write(`Erro: ${(e as Error).message}\n`); return 1; }
}

if (process.argv[1] && /odin\.(ts|mjs|js)$/.test(process.argv[1])) principal(process.argv.slice(2)).then((c) => { process.exitCode = c; });
