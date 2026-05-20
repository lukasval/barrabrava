// RPC: admin_force_recruit_refresh
//
// Wave 1 STUB — Wave 2 (plan 03.03) fills the real runRecruitRefresh body.
// Wave 1 purpose: register the RPC endpoint, gate with bearer auth, audit the call.
//
// Input:  { club_id?: string }  — omit to refresh ALL clubs (Wave 2 behavior)
// Output: { ok: true, stub: true, club_id: string | null }
//       | { ok: false, error: string }
//
// Security: T-3-AS-01 — requireAdmin constant-time bearer compare.
// Audit:    T-3-AS-03 — every call writes a row to COL_ADMIN_ACTIONS.

import { requireAdmin } from '../util/admin_auth';
import { COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';

export function rpcAdminForceRecruitRefresh(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { club_id?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  const clubId = typeof input.club_id === 'string' ? input.club_id : null;
  // Wave 2 (plan 03.03) replaces this stub with runRecruitRefresh(ctx, logger, nk, clubId).
  logger.info('[admin] force_recruit_refresh stub fired club=%s by ip=%s',
    clubId ?? 'ALL', auth.callerIp);
  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_force_recruit_refresh',
      club_id: clubId, caller_ip: auth.callerIp, at: Date.now(),
      note: 'stub — Wave 2 03.03 wires real refresh',
    },
    permissionRead: 0, permissionWrite: 0,
  }]);
  return JSON.stringify({ ok: true, stub: true, club_id: clubId });
}
