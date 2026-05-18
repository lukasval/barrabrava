// RPC: admin_close_window
//
// Forces a match window to state='closed' immediately. Used when a postponement
// arrives mid-window and we want to prevent further push notifications + new
// ventana data from polluting client reads (D-21 admin override).
//
// Input: { fixture_id: string }
// Output: { ok: true } | { ok: true, already_closed: true } | { ok: false, error: string }

import { COL_MATCH_WINDOWS, COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminCloseWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { fixture_id?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (typeof input.fixture_id !== 'string' || input.fixture_id.length === 0)
    return JSON.stringify({ ok: false, error: 'fixture_id_required' });

  const fixtureId = input.fixture_id;
  const existing = nk.storageRead([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
  }]);
  if (existing.length === 0) return JSON.stringify({ ok: false, error: 'window_not_found' });

  const w = existing[0].value as { state?: string };
  if (w.state === 'closed') return JSON.stringify({ ok: true, already_closed: true });

  const updated = {
    ...(existing[0].value as Record<string, unknown>),
    state: 'closed' as const,
    closes_at: Date.now(),
    updated_at: Date.now(),
    source: 'admin' as const,
  };
  nk.storageWrite([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
    value: updated, version: existing[0].version, permissionRead: 2, permissionWrite: 0,
  }]);

  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: { action: 'admin_close_window', fixture_id: fixtureId, caller_ip: auth.callerIp, at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[admin] close_window fixture=%s by ip=%s', fixtureId, auth.callerIp);
  return JSON.stringify({ ok: true });
}
