// nakama/src/scheduler/mesa_cron.ts
//
// Hourly Mesa Chica recompute cron — runs at every hour mark via bb_mesa_recompute_1h.
// Walks all barra_state records and drains any with mesa_recompute_pending = true
// by calling recomputeMesa (which performs the actual top-5 recalculation + rank changes).
//
// Design decisions:
//   D-14: Mesa Chica = top 5 by Reputación (AI+human). Debounce 5min prevents oscillation.
//         get_barra_state also triggers an inline recompute; this cron drains any remaining.
//   T-3-WS-11: Walking ~153 clubs per hour = ~1530 storage ops. Accepted cost (RESEARCH §Lazy Compute).
//
// recomputeMesa (from rank.ts) handles:
//   - Atomic write of barra_state.mesa_chica + pending flag drain
//   - Promote/demote human player ranks
//   - Optimistic concurrency conflicts (logged + silently skipped for next run)

import { COL_BARRA_STATE, SYSTEM_USER_ID } from '../storage_keys';
import { recomputeMesa } from '../laboral/rank';

// runMesaRecomputeAll — exported for leaderboard_cron dispatcher and plan 03.05 tests.
export function runMesaRecomputeAll(
  _ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama,
): void {
  let cursor = '';
  let drained = 0;
  let visited = 0;
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_BARRA_STATE, 100, cursor);
    for (const obj of page.objects || []) {
      visited++;
      const bs = obj.value as { mesa_recompute_pending?: boolean };
      if (bs.mesa_recompute_pending === true) {
        recomputeMesa(nk, logger, obj.key);
        drained++;
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  logger.info('[mesa_cron] visited=%d drained=%d', visited, drained);
}
