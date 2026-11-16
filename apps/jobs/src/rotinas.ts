// Rotinas do job odin-jobs, executado pelo agendamento único odin-tick a cada 15 min (arquitetura 03, 7.3).
// Cada rotina é idempotente e só faz o que está vencido.
import type { Store } from '../../../packages/shared/src/store.ts';

export async function tick(store: Store, agora: number = Date.now()): Promise<{ codigos_expirados: number; concessoes_expiradas: number; revogacoes_expiradas: number }> {
  let codigos = 0, concessoes = 0, revogacoes = 0;
  for (const c of await store.list('device_codes', (d) => Number(d.expiraEm) < agora - 60_000)) { await store.delete('device_codes', c.id); codigos++; }
  for (const g of await store.list('grants', (d) => Number(d.expiraEm) < agora)) { await store.delete('grants', g.id); concessoes++; }
  for (const r of await store.list('revocations', (d) => d.tipo !== undefined && typeof d.ate === 'number' && Number(d.ate) < agora)) { await store.delete('revocations', r.id); revogacoes++; }
  await store.set('settings', 'jobs', { ultimoTick: agora });
  return { codigos_expirados: codigos, concessoes_expiradas: concessoes, revogacoes_expiradas: revogacoes };
}
