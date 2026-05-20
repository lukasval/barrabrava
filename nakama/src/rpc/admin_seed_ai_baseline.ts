// RPC: admin_seed_ai_baseline
//
// Re-runs seedAiBaseline() on demand. Useful after adding new clubs or if the
// initial boot seed failed partway. With force=true, clears the idempotency marker
// first so all clubs are re-seeded even if already seeded.
//
// Input:  { force?: boolean }  — default false
// Output: { ok: true, force: boolean }
//       | { ok: false, error: string }
//
// Security: T-3-AS-01 — requireAdmin constant-time bearer compare.
//           T-3-AS-05 — requireAdmin gate limits DoS impact; audit log tracks calls.
// Audit:    T-3-AS-03 — every call writes a row to COL_ADMIN_ACTIONS.

import { requireAdmin } from '../util/admin_auth';
import { COL_ADMIN_ACTIONS, COL_META, KEY_AI_SEED_VERSION, SYSTEM_USER_ID } from '../storage_keys';
import { seedAiBaseline } from '../laboral/ai_seed';

export function rpcAdminSeedAiBaseline(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { force?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  if (input.force === true) {
    try {
      nk.storageDelete([{
        collection: COL_META, key: KEY_AI_SEED_VERSION, userId: SYSTEM_USER_ID,
      }]);
      logger.info('[admin] cleared ai_seed_version marker (force)');
    } catch (e) { /* not present — ok */ }
  }
  seedAiBaseline(nk, logger);
  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_seed_ai_baseline',
      force: input.force === true, caller_ip: auth.callerIp, at: Date.now(),
    },
    permissionRead: 0, permissionWrite: 0,
  }]);
  return JSON.stringify({ ok: true, force: input.force === true });
}
