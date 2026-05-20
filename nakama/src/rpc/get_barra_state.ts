// nakama/src/rpc/get_barra_state.ts
//
// Player RPC: reads the system-owned barra_state for the caller's club (or
// an explicitly supplied club_id for cross-club viewing — future Phase 5 feature).
//
// Design decisions:
//   D-14: Inline debounced Mesa recompute — if mesa_recompute_pending && now - last_at
//         > MESA_DEBOUNCE_MS (5 min), trigger recomputeMesa then re-read and return.
//         Otherwise return the cached state. This keeps Mesa roughly up-to-date without
//         a per-call recompute that could thrash on popular clubs.
//   T-3-RS-06: Tie-breaker in recomputeMesa is human-wins-over-AI — stable ordering.
//   T-3-RS-08: barra_state is intentionally public (permissionRead=2). Mesa Chica
//              player_ids + display names are the public leaderboard surface.

import {
  COL_BARRA_STATE, COL_PLAYERS, SYSTEM_USER_ID,
} from '../storage_keys';
import { recomputeMesa, MESA_DEBOUNCE_MS } from '../laboral/rank';

export function rpcGetBarraState(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');

  // Optional club_id override (future Phase 5 cross-club viewing).
  let input: { club_id?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  let clubId = typeof input.club_id === 'string' ? input.club_id : '';
  if (!clubId) {
    // Default: caller's own club (server-side profile, T-3-RS-09 pattern).
    const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
    if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
    clubId = String((profRead[0].value as { club_id?: string }).club_id ?? '');
    if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });
  }

  const bsRead = nk.storageRead([{
    collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
  }]);
  if (bsRead.length === 0) {
    return JSON.stringify({ ok: false, error: 'no_barra_state', club_id: clubId });
  }
  const bs = bsRead[0].value as {
    mesa_recompute_pending?: boolean;
    mesa_recompute_last_at?: number;
    [k: string]: unknown;
  };
  const now = Date.now();

  // ── Inline debounced Mesa recompute (D-14, T-3-RS-06) ──────────────────────
  if (bs.mesa_recompute_pending === true
      && now - (bs.mesa_recompute_last_at ?? 0) > MESA_DEBOUNCE_MS) {
    recomputeMesa(nk, logger, clubId);
    // Re-read after recompute to get the fresh state.
    const after = nk.storageRead([{
      collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
    }]);
    if (after.length > 0) {
      return JSON.stringify({ ok: true, barra_state: after[0].value });
    }
  }

  return JSON.stringify({ ok: true, barra_state: bs });
}
