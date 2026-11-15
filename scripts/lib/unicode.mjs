// Caracteres Unicode ocultos (ADR 0017, CT-25): escondem texto do revisor humano e chegam inteiros ao modelo.
// Usado por scripts/verificar-docs.mjs e scripts/verificar-skills.mjs; base do `odin lint` e da ingestão do RAG.
// Os caracteres aparecem aqui só como escapes: o próprio arquivo passa na verificação.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export const FAIXAS = [
  [0x00ad, 0x00ad, 'hífen suave'],
  [0x180e, 0x180e, 'separador de vogal mongol'],
  [0x200b, 0x200f, 'largura zero / marca de direção'],
  [0x202a, 0x202e, 'controle de direção (Trojan Source)'],
  [0x2060, 0x2064, 'junção de palavra / operador invisível'],
  [0x2066, 0x2069, 'isolamento de direção (Trojan Source)'],
  [0xfeff, 0xfeff, 'BOM fora do início do arquivo'],
  [0xe0000, 0xe007f, 'caractere de tag'],
  [0xe0100, 0xe01ef, 'seletor de variação suplementar'],
];

const nomeDe = (cp) => (FAIXAS.find(([a, b]) => cp >= a && cp <= b) || [])[2];

/** Lista os caracteres ocultos: [{ linha, coluna, codigo: 'U+200B', nome }]. Aceita BOM só no início. */
export function caracteresOcultos(texto) {
  const achados = [];
  let linha = 1, coluna = 0, i = 0;
  for (const ch of texto) {
    const cp = ch.codePointAt(0);
    if (ch === '\n') { linha++; coluna = 0; i++; continue; }
    coluna++;
    const nome = nomeDe(cp);
    if (nome && !(cp === 0xfeff && i === 0)) achados.push({ linha, coluna, codigo: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'), nome });
    i++;
  }
  return achados;
}

const TEXTO = new Set(['.md', '.mjs', '.js', '.ts', '.json', '.yml', '.yaml', '.html', '.tmpl', '.txt', '.tf', '.sh', '.ps1', '']);
const IGNORAR = new Set(['.git', 'node_modules', '.odin-dev']);

/** Varre arquivos de texto em `caminhos` (relativos à raiz) e devolve mensagens de erro. */
export function varrerOcultos(raiz, caminhos, { extensoes = TEXTO } = {}) {
  const erros = [];
  const ver = (abs) => {
    const rel = relative(raiz, abs).split('\\').join('/');
    for (const a of caracteresOcultos(readFileSync(abs, 'utf8').replace(/\r\n/g, '\n'))) erros.push(`${rel}:${a.linha}:${a.coluna}: caractere Unicode oculto ${a.codigo} (${a.nome})`);
  };
  const andar = (abs) => {
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) if (!IGNORAR.has(f)) andar(join(abs, f)); }
    else if (extensoes.has(extname(abs).toLowerCase())) ver(abs);
  };
  for (const c of caminhos) andar(join(raiz, c));
  return erros;
}
