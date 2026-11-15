#!/usr/bin/env node
// `npm run dev`: sobe o Odin inteiro na sua máquina (emissor de tokens + servidor MCP), com dados em .odin-dev/local.
import { join } from 'node:path';
import { RAIZ, subirLocal } from './ambiente.ts';
import { avaliar } from '../scripts/prontidao-skills.ts';

const dir = join(RAIZ, '.odin-dev', 'local');
const amb = await subirLocal({ dir, portaSts: Number(process.env.ODIN_PORTA_STS ?? 8787), portaMcp: Number(process.env.ODIN_PORTA_MCP ?? 8788) });
const avisos = await amb.publicarSkill(join(RAIZ, 'skills/odin-ambiente'), '1.0.0');
// Skills reais em rascunho: se os repositórios estiverem clonados ao lado deste (ou em ODIN_REPOS), publica as que passam no lint.
const reais: string[] = []; const bloqueadas: string[] = [];
for (const x of avaliar(RAIZ, process.env.ODIN_REPOS ?? join(RAIZ, '..'))) {
  if (!x.r || !x.repo) continue;
  if (x.r.erros.length) { bloqueadas.push(x.skill.id); continue; }
  try { await amb.publicarSkill(x.repo, '0.1.0-rascunho', { odinYaml: x.yaml, rascunho: true }); reais.push(x.skill.id); } catch { bloqueadas.push(x.skill.id); }
}
console.log(`Odin local no ar (Ctrl+C para parar). Dados em .odin-dev/local.

  Ativação (desenvolvimento): ${amb.sts}/ativar
  Servidor MCP:               ${amb.mcp}
  Skill publicada:            odin-ambiente 1.0.0${avisos.length ? `  (avisos do lint: ${avisos.length})` : ''}
  Skills reais (rascunho):    ${reais.length ? reais.join(', ') : 'nenhuma (clone os repositórios das skills ao lado deste)'}${bloqueadas.length ? `\n  Bloqueadas no lint:         ${bloqueadas.join(', ')} (veja docs/MIGRACAO-SKILLS.md)` : ''}
  Pessoas fictícias:          Dev Exemplo, PO Exemplo, QA Exemplo, Arquiteta Exemplo, Mantenedor Exemplo

Para conectar o Claude Code desta máquina (em outro terminal):
  npm run odin -- setup --servidor ${amb.sts} --chaves ${join('.odin-dev', 'local', 'chaves-de-pacote.json')}
Depois abra uma sessão nova do Claude Code e peça, por exemplo: "minha máquina está pronta para as skills?"
Para desfazer: npm run odin -- uninstall
`);
setInterval(() => { for (const e of amb.eventos.splice(0)) console.log(`${e.ts.slice(11, 19)} ${e.resultado.padEnd(6)} ${e.acao.padEnd(28)} ${e.ator}${e.skill ? ` · ${e.skill}${e.versao ? `@${e.versao}` : ''}` : ''}${e.motivo ? ` · ${e.motivo}` : ''}`); }, 500);
process.on('SIGINT', () => { void amb.fechar().then(() => process.exit(0)); });
