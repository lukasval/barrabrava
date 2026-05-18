// RPC: admin_set_club_team_mapping
//
// Manually maps a Phase 1 club_id to an API-Football team_id. Used to reconcile
// entries in meta:unmatched_clubs that buildClubTeamMap's fuzzy matcher missed.
// Merges into the existing meta:club_team_map (never overwrites the whole map).
// Removes any matching entry from meta:unmatched_clubs once the mapping is set.
//
// Input: { club_id: string, team_id: number }
// Output: { ok: true, club_id, team_id } | { ok: false, error: string }

import { COL_META, COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminSetClubTeamMapping(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { club_id?: unknown; team_id?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  if (typeof input.club_id !== 'string' || input.club_id.length === 0)
    return JSON.stringify({ ok: false, error: 'club_id_required' });
  if (typeof input.team_id !== 'number' || !Number.isInteger(input.team_id) || input.team_id <= 0)
    return JSON.stringify({ ok: false, error: 'team_id_must_be_positive_integer' });

  const clubId = input.club_id;
  const teamId = input.team_id;

  // Merge into existing club_team_map.
  const mapRead = nk.storageRead([{
    collection: COL_META, key: 'club_team_map', userId: SYSTEM_USER_ID,
  }]);
  const map: Record<string, number> = mapRead.length > 0
    ? (mapRead[0].value as Record<string, number>)
    : {};
  map[clubId] = teamId;

  nk.storageWrite([{
    collection: COL_META, key: 'club_team_map', userId: SYSTEM_USER_ID,
    value: map,
    ...(mapRead.length > 0 ? { version: mapRead[0].version } : {}),
    permissionRead: 0, permissionWrite: 0,
  }]);

  // Remove matching entry from unmatched_clubs (keyed by api_team_name, value has team_id).
  const unmatchedRead = nk.storageRead([{
    collection: COL_META, key: 'unmatched_clubs', userId: SYSTEM_USER_ID,
  }]);
  if (unmatchedRead.length > 0) {
    const unmatched = unmatchedRead[0].value as Record<string, { team_id?: number }>;
    let changed = false;
    for (const name of Object.keys(unmatched)) {
      if (unmatched[name].team_id === teamId) {
        delete unmatched[name];
        changed = true;
        break;
      }
    }
    if (changed) {
      nk.storageWrite([{
        collection: COL_META, key: 'unmatched_clubs', userId: SYSTEM_USER_ID,
        value: unmatched, version: unmatchedRead[0].version,
        permissionRead: 0, permissionWrite: 0,
      }]);
    }
  }

  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: {
      action: 'admin_set_club_team_mapping',
      club_id: clubId,
      team_id: teamId,
      caller_ip: auth.callerIp,
      at: Date.now(),
    },
    permissionRead: 0, permissionWrite: 0,
  }]);

  logger.info('[admin] set_club_team_mapping club_id=%s team_id=%d by ip=%s',
    clubId, teamId, auth.callerIp);
  return JSON.stringify({ ok: true, club_id: clubId, team_id: teamId });
}
