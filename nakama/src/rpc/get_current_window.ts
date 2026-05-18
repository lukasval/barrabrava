// RPC: get_current_window
//
// Returns the earliest upcoming (or currently open/live) match window for
// the authenticated player's club. Resolves player.club_id → API-Football
// team_id via meta:club_team_map, then filters COL_MATCH_WINDOWS by
// team_home_id OR team_away_id.
//
// Lower-division clubs (b_metro, federal_a, c_metro) are not in API-Football
// data — they have no mapping in club_team_map and get a null window with a
// friendly message. Client (HomeScreen.gd) renders "Coming soon" per division.
//
// Input: {} (server derives club_id from ctx.userId → players/profile)
// Output: { ok: true, window: MatchWindow | null, message?: string }
//       | { ok: false, error: string }

import { COL_PLAYERS, COL_MATCH_WINDOWS, COL_META, SYSTEM_USER_ID } from '../storage_keys';

const ACTIVE_STATES = ['scheduled', 'open', 'live'];
const NO_MATCH_MESSAGE = 'Sin partidos próximos';

export function rpcGetCurrentWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');

  const profileRead = nk.storageRead([{
    collection: COL_PLAYERS, key: 'profile', userId,
  }]);
  if (profileRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });

  const profile = profileRead[0].value as { club_id?: string };
  const clubId = profile.club_id;
  if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });

  const mapRead = nk.storageRead([{
    collection: COL_META, key: 'club_team_map', userId: SYSTEM_USER_ID,
  }]);
  const teamMap: Record<string, number> = mapRead.length > 0
    ? (mapRead[0].value as Record<string, number>)
    : {};
  const mappedTeamId: number | undefined = teamMap[clubId];

  if (mappedTeamId === undefined) {
    // No mapping — lower-division club or pending manual reconciliation.
    logger.info('[get_window] user=%s club=%s no_team_mapping', userId, clubId);
    return JSON.stringify({ ok: true, window: null, message: NO_MATCH_MESSAGE });
  }

  const now = Date.now();
  let earliest: Record<string, unknown> | null = null;
  let earliestSortKey = Infinity;

  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_MATCH_WINDOWS, 100, cursor);
    for (const obj of (page.objects || [])) {
      const w = obj.value as {
        state?: string;
        team_home_id?: number;
        team_away_id?: number;
        opens_at?: number;
      };
      if (!w.state || ACTIVE_STATES.indexOf(w.state) < 0) continue;
      if (w.team_home_id !== mappedTeamId && w.team_away_id !== mappedTeamId) continue;
      // Sort key: scheduled windows by opens_at; open/live windows treated as "happening now" (sort key = now).
      const sortKey = w.state === 'scheduled' && typeof w.opens_at === 'number'
        ? w.opens_at
        : now;
      if (sortKey < earliestSortKey) {
        earliestSortKey = sortKey;
        earliest = w as Record<string, unknown>;
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  if (!earliest) {
    logger.info('[get_window] user=%s club=%s team_id=%d no_window', userId, clubId, mappedTeamId);
    return JSON.stringify({ ok: true, window: null, message: NO_MATCH_MESSAGE });
  }

  const opensAt = typeof earliest.opens_at === 'number' ? earliest.opens_at : now;
  earliest.seconds_until_open = Math.max(0, Math.floor((opensAt - now) / 1000));

  logger.info('[get_window] user=%s club=%s team_id=%d state=%s',
    userId, clubId, mappedTeamId, String(earliest.state));
  return JSON.stringify({ ok: true, window: earliest });
}
