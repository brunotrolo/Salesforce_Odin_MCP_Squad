// Camada visual do portal: um só layout (barra lateral + conteúdo), tokens de cor para claro e escuro e componentes pequenos.
// Sem JavaScript, sem fontes nem imagens externas (a CSP do portal é `default-src 'none'`): só HTML e CSS inline.
export const h = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type Tom = 'ok' | 'aviso' | 'erro' | 'info' | 'neutro';
export interface Navegacao { area: 'admin' | 'conta'; csrf: string; ativo: string; quem?: string }

const ICONES: Record<string, string> = {
  painel: '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
  pessoas: '<path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-3.3 3.6-6 8-6s8 2.7 8 6v1H4v-1z"/>',
  dispositivos: '<path d="M4 5h16v10H4V5zm-2 12h20v2H2v-2z"/>',
  skills: '<path d="M12 2l2.4 6.6L21 9l-5 4.4L17.5 20 12 16.5 6.5 20 8 13.4 3 9l6.6-.4L12 2z"/>',
  mcp: '<path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h6v3h-6v-3zm0-3h3v3h-3v-3z"/>',
  propostas: '<path d="M5 3h14v18l-7-4-7 4V3z"/>',
  conta: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z"/>',
  mfa: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm-1 13l6-6-1.4-1.4L11 12.2 8.4 9.6 7 11l4 4z"/>',
  sair: '<path d="M10 3H4v18h6v-2H6V5h4V3zm4 4l-1.4 1.4L15.2 11H8v2h7.2l-2.6 2.6L14 17l5-5-5-5z"/>',
};
const icone = (n: string): string => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">${ICONES[n] ?? ''}</svg>`;

const ITENS: Record<Navegacao['area'], Array<[string, string, string]>> = {
  admin: [['/admin', 'Visão geral', 'painel'], ['/admin/mcp', 'Servidor MCP', 'mcp'], ['/admin/skills', 'Skills', 'skills'], ['/admin/pessoas', 'Pessoas', 'pessoas'], ['/admin/dispositivos', 'Dispositivos', 'dispositivos'], ['/admin/propostas', 'Conhecimento', 'propostas']],
  conta: [['/conta', 'Minha conta', 'conta'], ['/mfa', 'Segundo fator', 'mfa']],
};

const CSS = `
:root{color-scheme:light dark;--bg:#f4f5fb;--bg2:#eceefa;--card:#ffffff;--card2:#f8f9fe;--fg:#14162b;--mut:#5b6182;--bd:#dfe2f3;--acc:#5b5bf0;--acc2:#8b5cf6;--acc3:#06b6d4;--ok:#0f9d58;--okbg:#dff5e8;--aviso:#b7791f;--avisobg:#fdf0d5;--erro:#d63a3a;--errobg:#fde4e4;--info:#2563eb;--infobg:#dfe9fd;--neutro:#5b6182;--neutrobg:#e9ebf7;--sombra:0 1px 2px rgba(20,22,43,.06),0 8px 24px rgba(91,91,240,.07)}
@media(prefers-color-scheme:dark){:root{--bg:#0b0c18;--bg2:#12142a;--card:#151831;--card2:#1b1f3d;--fg:#eef0ff;--mut:#9aa1c9;--bd:#272b52;--acc:#8b8bff;--acc2:#b79cff;--acc3:#4fd8f0;--ok:#4ade80;--okbg:#10301f;--aviso:#fbbf24;--avisobg:#3a2d0c;--erro:#ff7b7b;--errobg:#3b1616;--info:#7aa7ff;--infobg:#13244f;--neutro:#9aa1c9;--neutrobg:#20244a;--sombra:0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35)}}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;background:radial-gradient(900px 500px at 85% -10%,color-mix(in srgb,var(--acc2) 18%,transparent),transparent),radial-gradient(700px 420px at -5% 0%,color-mix(in srgb,var(--acc3) 14%,transparent),transparent),var(--bg);color:var(--fg);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.app{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;padding:20px 14px;border-right:1px solid var(--bd);background:color-mix(in srgb,var(--card) 82%,transparent);backdrop-filter:blur(10px);display:flex;flex-direction:column;gap:6px}
.marca{display:flex;align-items:center;gap:10px;padding:6px 10px 18px;font-weight:700;font-size:1.15rem;letter-spacing:.2px}
.logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--acc),var(--acc2) 55%,var(--acc3));display:grid;place-items:center;color:#fff;font-weight:800;box-shadow:0 6px 18px color-mix(in srgb,var(--acc) 45%,transparent)}
.nav a{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--mut);font-weight:550}
.nav a:hover{background:var(--neutrobg);color:var(--fg);text-decoration:none}
.nav a.on{background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 22%,transparent),transparent);color:var(--fg);box-shadow:inset 3px 0 0 var(--acc)}
.rodape{margin-top:auto;display:grid;gap:8px;padding:10px;border-top:1px solid var(--bd);color:var(--mut);font-size:.82rem}
.rodape button{width:100%;display:flex;gap:8px;justify-content:center;align-items:center}
main{padding:28px clamp(16px,3.4vw,44px) 56px;max-width:1240px;width:100%}
.topo{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:end;justify-content:space-between;margin-bottom:22px}
h1{font-size:clamp(1.5rem,3vw,2rem);line-height:1.15;margin:0;letter-spacing:-.02em}
h2{font-size:1.02rem;margin:0 0 12px;letter-spacing:-.005em}
.sub{margin:6px 0 0;color:var(--mut)}
.grade{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
.grade.l{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.grade>*+*{margin-top:0}
.card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:18px 20px;box-shadow:var(--sombra);min-width:0}
.card.g{background:linear-gradient(135deg,color-mix(in srgb,var(--acc) 16%,var(--card)),var(--card) 60%)}
.card h2 .mut{font-weight:500;color:var(--mut);font-size:.85rem}
.tile .rot{color:var(--mut);font-size:.82rem;text-transform:uppercase;letter-spacing:.07em;font-weight:600}
.tile .val{font-size:2.1rem;font-weight:750;letter-spacing:-.03em;margin:4px 0 2px;background:linear-gradient(90deg,var(--fg),color-mix(in srgb,var(--acc) 70%,var(--fg)));-webkit-background-clip:text;background-clip:text;color:transparent}
.tile .nota{color:var(--mut);font-size:.85rem}
.pill{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:99px;font-size:.78rem;font-weight:650;white-space:nowrap}
.pill.ok{background:var(--okbg);color:var(--ok)}.pill.aviso{background:var(--avisobg);color:var(--aviso)}.pill.erro{background:var(--errobg);color:var(--erro)}.pill.info{background:var(--infobg);color:var(--info)}.pill.neutro{background:var(--neutrobg);color:var(--neutro)}
.pill.ok::before,.pill.erro::before,.pill.aviso::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.tab{overflow-x:auto}table{width:100%;border-collapse:collapse}main>*+*{margin-top:16px}td .mono,th .mono{white-space:nowrap}
th{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);text-align:left;padding:8px 10px;border-bottom:1px solid var(--bd)}
td{padding:11px 10px;border-bottom:1px solid color-mix(in srgb,var(--bd) 60%,transparent);vertical-align:top}tr:last-child td{border-bottom:0}
td small,.mut{color:var(--mut)}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.84em;background:var(--neutrobg);padding:2px 7px;border-radius:6px;word-break:break-all}
input,select,button,textarea{font:inherit;color:inherit}
input,select,textarea{background:var(--card2);border:1px solid var(--bd);border-radius:10px;padding:9px 12px;width:100%}
input:focus,select:focus,button:focus-visible,a:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
label{display:grid;gap:5px;font-weight:600;font-size:.88rem;margin-bottom:12px}
button,.btn{cursor:pointer;border:0;border-radius:10px;padding:9px 16px;font-weight:650;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;box-shadow:0 6px 16px color-mix(in srgb,var(--acc) 30%,transparent)}
button:hover,.btn:hover{filter:brightness(1.08);text-decoration:none}
button.sec{background:var(--neutrobg);color:var(--fg);box-shadow:none}button.p{background:linear-gradient(135deg,#e5484d,#c0262d)}
.btn{display:inline-block}
.skill{display:grid;gap:10px;align-content:start}
.skill .cab{display:flex;gap:12px;align-items:center}.etapa{flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--acc),var(--acc3))}
.skill p{margin:0;color:var(--mut);font-size:.9rem}.chips{display:flex;gap:6px;flex-wrap:wrap}
.barra{height:8px;border-radius:99px;background:var(--neutrobg);overflow:hidden}.barra i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc3))}
.vazio{padding:26px;text-align:center;color:var(--mut)}
.aviso-b{border-left:4px solid var(--aviso);background:var(--avisobg);padding:10px 14px;border-radius:10px;margin:0 0 16px}
.hero{max-width:980px;margin:0 auto;padding:56px 20px}.hero h1{font-size:clamp(2rem,5vw,3.2rem)}
.hero .grade{margin-top:28px}
.solo{min-height:100vh}
@media(max-width:860px){.app{grid-template-columns:1fr}.side{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;border-right:0;border-bottom:1px solid var(--bd)}.marca{padding:4px 8px}.nav{display:flex;flex-wrap:wrap;gap:2px}.rodape{margin:0 0 0 auto;border:0;padding:0}}
@media(prefers-reduced-motion:no-preference){.card{transition:transform .15s ease,box-shadow .15s ease}.grade>.card:hover{transform:translateY(-2px)}}
`;

export const pill = (texto: unknown, tom: Tom = 'neutro'): string => `<span class="pill ${tom}">${h(texto)}</span>`;
export const stat = (rotulo: string, valor: unknown, nota = ''): string => `<div class="card tile"><div class="rot">${h(rotulo)}</div><div class="val">${h(valor)}</div>${nota ? `<div class="nota">${nota}</div>` : ''}</div>`;
export const caixa = (titulo: string, corpo: string, extra = ''): string => `<section class="card ${extra}"><h2>${titulo}</h2>${corpo}</section>`;
export const barra = (pct: number): string => `<div class="barra" role="img" aria-label="${Math.round(pct)}%"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

/** Página completa. Sem `nav`, mostra o layout de uma coluna (início, login, erros). */
export function pagina(titulo: string, corpo: string, nav?: Navegacao, subtitulo = ''): string {
  const cab = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${h(titulo)} · Odin</title><style>${CSS}</style>`;
  const topo = `<div class="topo"><div><h1>${h(titulo)}</h1>${subtitulo ? `<p class="sub">${subtitulo}</p>` : ''}</div></div>`;
  if (!nav) return `${cab}<body><main class="solo" style="margin:0 auto"><div class="marca"><span class="logo">O</span>Odin</div>${topo}${corpo}</main></body></html>`;
  const links = ITENS[nav.area].map(([href, rot, ic]) => `<a href="${href}" class="${nav.ativo === href || (href !== '/admin' && href !== '/conta' && nav.ativo.startsWith(href)) ? 'on' : ''}">${icone(ic)}${h(rot)}</a>`).join('');
  return `${cab}<body><div class="app"><aside class="side"><div class="marca"><span class="logo">O</span>Odin</div><nav class="nav">${links}</nav><div class="rodape">${nav.quem ? `<span>${h(nav.quem)}</span>` : ''}<form method="post" action="/sair"><input type="hidden" name="csrf" value="${h(nav.csrf)}"><button class="sec">${icone('sair')}Sair</button></form></div></aside><main>${topo}${corpo}</main></div></body></html>`;
}
