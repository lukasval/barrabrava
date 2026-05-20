// RPC: admin_force_recruit_refresh
//
// Forces a recruit pool refresh for one club (or all clubs).
// Wave 3 (plan 03.03): stub replaced with real runRecruitRefresh call.
//
// Input:  { club_id?: string }  — omit to refresh ALL clubs
// Output: { ok: true, regenerated: true, club_id: string | null }
//       | { ok: false, error: string }
//
// Security: T-3-AS-01 — requireAdmin constant-time bearer compare.
// Audit:    T-3-AS-03 — every call writes a row to COL_ADMIN_ACTIONS.

import { requireAdmin } from '../util/admin_auth';
import { COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';
import { runRecruitRefresh } from '../scheduler/recruit_cron';

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

  // Audit first (before potentially throwing in runRecruitRefresh).
  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_force_recruit_refresh',
      club_id: clubId, caller_ip: auth.callerIp, at: Date.now(),
    },
    permissionRead: 0, permissionWrite: 0,
  }]);

  // Wave 3: real runRecruitRefresh (forClubId bypasses generated_date_art short-circuit
  // for targeted refresh; undefined = all clubs).
  runRecruitRefresh(ctx, logger, nk, clubId ?? undefined);

  logger.info('[admin] force_recruit_refresh club=%s by ip=%s', clubId ?? 'ALL', auth.callerIp);
  return JSON.stringify({ ok: true, regenerated: true, club_id: clubId });
}
