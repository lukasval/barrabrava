// RPC: admin_force_repoll
//
// Triggers runHeartbeatTick synchronously (as if a 15m cron just fired).
// Honors tick_lock — if a tick is already in progress, the inner function
// logs "previous tick still active; skipping" and returns without throwing
// (S-13). The audit row is written either way.
//
// Input: (none — payload ignored)
// Output: { ok: true } | { ok: false, error: string }

import { runHeartbeatTick } from '../scheduler/tick';
import { COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminForceRepoll(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  logger.info('[admin] force_repoll triggered by ip=%s', auth.callerIp);
  try {
    runHeartbeatTick(ctx, logger, nk, 'bb_tick_15m');
  } catch (e) {
    logger.error('[admin] force_repoll tick threw: %s', String(e));
    return JSON.stringify({ ok: false, error: 'tick_threw', detail: String(e) });
  }

  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: { action: 'admin_force_repoll', caller_ip: auth.callerIp, at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);
  return JSON.stringify({ ok: true });
}
