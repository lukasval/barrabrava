// RPC: admin_postpone_fixture
//
// Two modes:
//   1. Shift kickoff: pass new_kickoff_utc (ms epoch). Updates window opens_at/closes_at
//      ± 2h around new kickoff. Also updates the fixture record so subsequent ticks
//      see the new time.
//   2. Cancel: pass cancel:true. Sets window state='cancelled'. Required if window
//      is already in state 'open'/'live' (D-08 — can't silently shift a live window).
//
// Input: { fixture_id: string, new_kickoff_utc?: number, cancel?: boolean }
// Output: { ok: true, state } | { ok: false, error: string }

import {
  COL_FIXTURES,
  COL_MATCH_WINDOWS,
  COL_ADMIN_ACTIONS,
  SYSTEM_USER_ID,
} from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

const WINDOW_PRE_MS = 2 * 3600 * 1000;
const WINDOW_POST_MS = 2 * 3600 * 1000;

export function rpcAdminPostponeFixture(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { fixture_id?: unknown; new_kickoff_utc?: unknown; cancel?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  if (typeof input.fixture_id !== 'string' || input.fixture_id.length === 0)
    return JSON.stringify({ ok: false, error: 'fixture_id_required' });

  const fixtureId = input.fixture_id;
  const doCancel = input.cancel === true;

  const winRead = nk.storageRead([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
  }]);
  if (winRead.length === 0) return JSON.stringify({ ok: false, error: 'window_not_found' });

  const w = winRead[0].value as { state?: string; [k: string]: unknown };

  // D-08: open/live windows need explicit cancel flag — can't silently shift mid-window.
  if ((w.state === 'open' || w.state === 'live') && !doCancel) {
    return JSON.stringify({ ok: false, error: 'window_already_open_use_close_or_cancel_true' });
  }

  let updated: Record<string, unknown>;
  if (doCancel) {
    updated = {
      ...w,
      state: 'cancelled' as const,
      source: 'admin' as const,
      updated_at: Date.now(),
    };
  } else {
    if (typeof input.new_kickoff_utc !== 'number')
      return JSON.stringify({ ok: false, error: 'new_kickoff_utc_required_for_shift' });

    const newKickoff = input.new_kickoff_utc;
    updated = {
      ...w,
      kickoff_utc: newKickoff,
      opens_at: newKickoff - WINDOW_PRE_MS,
      closes_at: newKickoff + WINDOW_POST_MS,
      source: 'admin' as const,
      updated_at: Date.now(),
    };

    // Keep fixture record in sync so the next tick doesn't undo our change.
    const fxRead = nk.storageRead([{
      collection: COL_FIXTURES, key: fixtureId, userId: SYSTEM_USER_ID,
    }]);
    if (fxRead.length > 0) {
      const fx = { ...(fxRead[0].value as Record<string, unknown>), kickoff_utc: newKickoff };
      nk.storageWrite([{
        collection: COL_FIXTURES, key: fixtureId, userId: SYSTEM_USER_ID,
        value: fx, version: fxRead[0].version, permissionRead: 2, permissionWrite: 0,
      }]);
    }
  }

  nk.storageWrite([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
    value: updated, version: winRead[0].version, permissionRead: 2, permissionWrite: 0,
  }]);

  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_postpone_fixture',
      fixture_id: fixtureId,
      cancel: doCancel,
      new_kickoff_utc: typeof input.new_kickoff_utc === 'number' ? input.new_kickoff_utc : null,
      caller_ip: auth.callerIp,
      at: Date.now(),
    },
    permissionRead: 0, permissionWrite: 0,
  }]);

  logger.info('[admin] postpone_fixture fixture=%s cancel=%s by ip=%s',
    fixtureId, doCancel ? 'true' : 'false', auth.callerIp);
  return JSON.stringify({ ok: true, state: updated.state });
}
