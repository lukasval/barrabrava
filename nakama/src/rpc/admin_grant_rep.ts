// RPC: admin_grant_rep
//
// Grants (or deducts) Reputación delta to a player's profile.
// Wave 1: profile write + audit log.
// Wave 3 (plan 03.03): attaches checkRankTransition + atomic rank write after reputacion mutation.
//
// Input:  { user_id: string, delta_rep: number, reason?: string }
// Output: { ok: true, before: number, after: number, new_rank: string | null }
//       | { ok: false, error: string }
//
// Security: T-3-AS-01 — requireAdmin constant-time bearer compare.
// Audit:    T-3-AS-03 — every call writes a row to COL_ADMIN_ACTIONS.
// Write:    optimistic-lock (passes version from storageRead) to avoid silent overwrites.

import { requireAdmin } from '../util/admin_auth';
import { COL_ADMIN_ACTIONS, COL_PLAYERS, SYSTEM_USER_ID } from '../storage_keys';
import { checkRankTransition } from '../laboral/rank';

export function rpcAdminGrantRep(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { user_id?: unknown; delta_rep?: unknown; reason?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (typeof input.user_id !== 'string' || input.user_id.length === 0)
    return JSON.stringify({ ok: false, error: 'user_id_required' });
  if (typeof input.delta_rep !== 'number' || !Number.isFinite(input.delta_rep))
    return JSON.stringify({ ok: false, error: 'delta_rep_required' });
  const reason = typeof input.reason === 'string' ? input.reason : '';

  const r = nk.storageRead([{
    collection: COL_PLAYERS, key: 'profile', userId: input.user_id,
  }]);
  if (r.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = r[0].value as {
    reputacion?: number; rank?: string; club_id?: string;
    rank_changed_at?: number; [k: string]: unknown;
  };
  const before = typeof profile.reputacion === 'number' ? profile.reputacion : 0;
  const after = before + (input.delta_rep as number);
  profile.reputacion = after;

  // Wave 3 (plan 03.03): trigger rank check + write rank atomically in same profile write.
  const transition = checkRankTransition(nk, logger, profile as {
    rank: string; reputacion: number; rank_changed_at?: number; club_id: string;
  });

  nk.storageWrite([{
    collection: COL_PLAYERS, key: 'profile', userId: input.user_id as string,
    value: profile as { [k: string]: unknown },
    version: r[0].version,
    permissionRead: 2, permissionWrite: 0,
  }]);

  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_grant_rep',
      user_id: input.user_id, delta_rep: input.delta_rep, reason,
      before, after, caller_ip: auth.callerIp, at: Date.now(),
    },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[admin] grant_rep user=%s delta=%d before=%d after=%d by ip=%s',
    input.user_id, input.delta_rep, before, after, auth.callerIp);
  return JSON.stringify({ ok: true, before, after, new_rank: transition.new_rank ?? null });
}
