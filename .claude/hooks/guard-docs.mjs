#!/usr/bin/env node
// Hook PreToolUse: protege os documentos de referência do Odin.
// Editar docs/DECISOES.md, docs/PLANO.md, docs/arquitetura/**, docs/seguranca/** ou docs/portal/**
// só é permitido com um ADR aberto (node scripts/adr.mjs novo "título" | abrir <n>).
// Fail-closed: entrada ilegível ou erro interno bloqueiam (código de saída 2).
import { ehProtegido, relativoAoRepo, adrAtivo, PROTEGIDOS } from '../../scripts/lib/protegidos.mjs';

const ESCRITA_BASH = /(>>?|\btee\b|\bsed\s+-i|\bperl\s+-i|\bmv\b|\brm\b|\bcp\b|\btruncate\b|\bpython3?\b|\bnode\b\s+-e|git\s+(checkout|restore)\s+--|Set-Content|Out-File|Remove-Item|Move-Item|Copy-Item)/;

function negar(msg) {
  process.stderr.write(`[odin-guard-docs] ${msg}\n`);
  process.exit(2);
}

let bruto = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (bruto += c));
process.stdin.on('end', () => {
  try {
    let ev;
    try { ev = JSON.parse(bruto || '{}'); } catch { negar('entrada do hook ilegível (bloqueado por segurança)'); }
    const raiz = process.env.CLAUDE_PROJECT_DIR || ev.cwd || process.cwd();
    const ferramenta = ev.tool_name || '';
    const entrada = ev.tool_input || {};
    let alvos = [];

    if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(ferramenta)) {
      const p = entrada.file_path || entrada.notebook_path || entrada.path;
      if (p) alvos.push(relativoAoRepo(raiz, p));
    } else if (ferramenta === 'Bash' || ferramenta === 'PowerShell') {
      const cmd = String(entrada.command || '');
      if (ESCRITA_BASH.test(cmd)) {
        for (const p of PROTEGIDOS) if (cmd.includes(p.replace(/\/$/, ''))) alvos.push(p.endsWith('/') ? p + 'x' : p);
      }
    } else {
      process.exit(0);
    }

    alvos = alvos.filter((a) => ehProtegido(a));
    if (!alvos.length) process.exit(0);

    const st = adrAtivo(raiz);
    if (st.ok) process.exit(0);
    negar(
      `"${alvos[0].replace(/x$/, '')}" é documento de referência protegido (${st.motivo}). ` +
      'Mudanças de arquitetura, segurança, portal, plano ou decisões exigem um ADR: ' +
      'use a skill odin-arquiteto ou rode `node scripts/adr.mjs novo "título"` (ou `abrir <n>`), ' +
      'e feche com `node scripts/adr.mjs fechar` ao terminar.'
    );
  } catch (e) {
    negar(`erro interno do guard (${e && e.message}); bloqueado por segurança`);
  }
});
