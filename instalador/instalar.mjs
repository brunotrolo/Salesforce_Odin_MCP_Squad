#!/usr/bin/env node
// Instalador do Odin (Windows, macOS e Linux). Requer Node 22 ou mais novo.
// Uso: node instalar.mjs --servidor https://<endereço do portal> --chaves <chaves-publicas.json>
// O arquivo de chaves públicas (publicadas junto deste instalador) fixa em quem confiar: o CLI só é instalado se a assinatura bater.
import { spawnSync } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const servidor = arg('--servidor'), arquivoChaves = arg('--chaves');
if (!servidor || !arquivoChaves) { console.error('Uso: node instalar.mjs --servidor <endereço do portal> --chaves <chaves-publicas.json>'); process.exit(2); }
if (Number(process.versions.node.split('.')[0]) < 22) { console.error(`Precisa do Node 22 ou mais novo (este é o ${process.versions.node}).`); process.exit(1); }
const canonico = (v) => (Array.isArray(v) ? `[${v.map(canonico).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}` : JSON.stringify(v));
const origem = new URL((await (await fetch(`${servidor.replace(/\/$/, '')}/.well-known/odin-configuration`)).json()).mcp).origin;
const { manifesto: m, assinatura, url } = await (await fetch(`${origem}/v1/cli`)).json();
const chave = JSON.parse(readFileSync(arquivoChaves, 'utf8')).find((c) => c.kid === m.kid);
const dsa = { dsaEncoding: 'ieee-p1363' };
if (!chave || !verify('sha256', Buffer.from(canonico(m)), { key: createPublicKey({ key: chave.jwk, format: 'jwk' }), ...dsa }, Buffer.from(assinatura, 'base64'))) { console.error('A assinatura do CLI não confere com a chave fixada. Nada foi instalado.'); process.exit(1); }
const dados = Buffer.from(await (await fetch(url)).arrayBuffer());
if (createHash('sha256').update(dados).digest('hex') !== m.pacote.sha256) { console.error('O pacote do CLI não bate com o manifesto assinado. Nada foi instalado.'); process.exit(1); }
const arquivos = JSON.parse(gunzipSync(dados).toString('utf8')).arquivos;
const odin = process.env.ODIN_HOME ?? join(homedir(), '.odin'); const dir = join(odin, 'cli', m.versao);
for (const [rel, b64] of Object.entries(arquivos)) { if (rel.startsWith('/') || rel.includes('..')) throw new Error(`caminho inválido: ${rel}`); const f = join(dir, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, Buffer.from(b64, 'base64')); }
const entrada = join(dir, 'packages', 'cli', 'src', 'odin.ts'); mkdirSync(join(odin, 'bin'), { recursive: true });
writeFileSync(join(odin, 'cli', 'current.json'), JSON.stringify({ versao: m.versao, dir }));
writeFileSync(join(odin, 'bin', 'odin'), `#!/bin/sh\nexec node "${entrada}" "$@"\n`, { mode: 0o755 }); try { chmodSync(join(odin, 'bin', 'odin'), 0o755); } catch { /* Windows */ }
writeFileSync(join(odin, 'bin', 'odin.cmd'), `@echo off\r\nnode "${entrada}" %*\r\n`);
console.log(`Odin CLI ${m.versao} instalado em ${dir}. Adicione ${join(odin, 'bin')} ao PATH. Agora ativando este dispositivo...`);
const r = spawnSync(process.execPath, [entrada, 'setup', '--servidor', servidor], { stdio: 'inherit' }); process.exit(r.status ?? 1);
void existsSync;
