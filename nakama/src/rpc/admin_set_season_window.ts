// RPC: admin_set_season_window
//
// Overwrites meta:current_season with provided values. Used to force the
// season state machine into a specific phase (pre/active/ended) — e.g. to
// kick off the AI-barra population script when fixtures haven't loaded yet,
// or to manually end a season before detectSeasonState catches up.
//
// Input: { division: string, season_id: number, started_at?: number,
//          ends_at?: number, status: 'pre' | 'active' | 'ended' }
// Output: { ok: true, state } | { ok: false, error: string }

import { COL_META, COL_ADMIN_ACTIONS, SYSTEM_USER_ID, KEY_CURRENT_SEASON } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

const VALID_STATUSES = ['pre', 'active', 'ended'];
const DEFAULT_SEASON_LENGTH_MS = 180 * 24 * 3600 * 1000; // 6 months fallback for ends_at

export function rpcAdminSetSeasonWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: {
    division?: unknown;
    season_id?: unknown;
    started_at?: unknown;
    ends_at?: unknown;
    status?: unknown;
  } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  if (typeof input.division !== 'string' || input.division.length === 0)
    return JSON.stringify({ ok: false, error: 'division_required' });
  if (typeof input.season_id !== 'number' || !Number.isInteger(input.season_id))
    return JSON.stringify({ ok: false, error: 'season_id_required' });
  if (typeof input.status !== 'string' || VALID_STATUSES.indexOf(input.status) < 0)
    return JSON.stringify({ ok: false, error: 'status_must_be_pre_active_ended' });

  const now = Date.now();
  const state = {
    season_id: input.season_id,
    division: input.division,
    torneo_name: 'Temporada ' + input.season_id,
    started_at: typeof input.started_at === 'number' ? input.started_at : now,
    ends_at: typeof input.ends_at === 'number' ? input.ends_at : now + DEFAULT_SEASON_LENGTH_MS,
    status: input.status,
  };

  nk.storageWrite([{
    collection: COL_META, key: KEY_CURRENT_SEASON, userId: SYSTEM_USER_ID,
    value: state, permissionRead: 0, permissionWrite: 0,
  }]);
  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_set_season_window',
      season_id: input.season_id,
      status: input.status,
      caller_ip: auth.callerIp,
      at: now,
    },
    permissionRead: 0, permissionWrite: 0,
  }]);

  logger.info('[admin] set_season_window season=%d status=%s by ip=%s',
    input.season_id, input.status, auth.callerIp);
  return JSON.stringify({ ok: true, state });
}
