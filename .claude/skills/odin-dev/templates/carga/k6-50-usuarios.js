// Teste de carga (modelo k6): 50 usuários virtuais por 10 minutos contra o MCP (decisão 33).
// Uso: k6 run -e ODIN_MCP_URL=https://... -e ODIN_TOKEN_TESTE=... k6-50-usuarios.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: { padrao: { executor: 'constant-vus', vus: 50, duration: '10m' } },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{ferramenta:odin_rotear}': ['p(95)<300'],
    'http_req_duration{ferramenta:odin_carregar_skill}': ['p(95)<300'],
  },
};

const URL = `${__ENV.ODIN_MCP_URL}/mcp`;
const HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${__ENV.ODIN_TOKEN_TESTE}` };
const PEDIDOS = ['testar a capacidade de exemplo na sandbox', 'detalhar o discovery da release de exemplo', 'criar a classe de teste do serviço de exemplo'];

function chamar(nome, args, id) {
  const corpo = JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: nome, arguments: args } });
  return http.post(URL, corpo, { headers: HEADERS, tags: { ferramenta: nome } });
}

export default function () {
  const r = chamar('odin_rotear', { pedido: PEDIDOS[__ITER % PEDIDOS.length] }, __ITER);
  check(r, { 'rotear 200': (x) => x.status === 200 });
  const s = chamar('odin_carregar_skill', { skill: 'sf-test' }, __ITER + 1);
  check(s, { 'carregar 200': (x) => x.status === 200 });
  sleep(1 + Math.random() * 2);
}
