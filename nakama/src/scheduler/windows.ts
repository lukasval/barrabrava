// nakama/src/scheduler/windows.ts
// Match window state machine.
//
// Called from runHeartbeatTick. Walks COL_FIXTURES, materializes a
// COL_MATCH_WINDOWS row for any fixture whose kickoff is within MATERIALIZE_HORIZON_MS,
// and evaluates state transitions:
//
//   scheduled  → open    when now >= opens_at        (kickoff - 2h)  CMB-01
//   open       → live    when now >= kickoff_utc
//   live       → closed  when now >= closes_at       (kickoff + 2h)
//   any        → cancelled  when fixture.status ∈ {PST, CANC}
//
// Anti-double-push (D-12): `notified_open_at` is set in the SAME storageWrite
// that transitions state from scheduled → non-scheduled. The push is sent
// AFTER the write — so if the FCM call fails the marker is still in place and
// the next tick will NOT re-send.
//
// Window schema (D-05 + BLOCKER 2 fix from PLAN 02-02): every record stores
// BOTH the API-Football numeric team IDs (team_home_id / team_away_id) AND the
// Phase 1 lunfardo club slugs (club_home_id / club_away_id, nullable). The slug
// pair lets get_current_window (plan 02-06) filter by player's club_id without
// re-resolving via club_team_map on every read.

import {
  COL_FIXTURES,
  COL_MATCH_WINDOWS,
  SYSTEM_USER_ID,
} from '../storage_keys';
import { sendTopic } from '../integrations/fcm';

const WINDOW_PRE_MS = 2 * 3600 * 1000;
const WINDOW_POST_MS = 2 * 3600 * 1000;
const MATERIALIZE_HORIZON_MS = 48 * 3600 * 1000;

interface MatchWindow {
  fixture_id: string;
  team_home_id: number;
  team_away_id: number;
  club_home_id: string | null;
  club_away_id: string | null;
  kickoff_utc: number;
  state: 'scheduled' | 'open' | 'live' | 'closed' | 'cancelled';
  opens_at: number;
  closes_at: number;
  notified_open_at?: number;
  source: 'api-football' | 'admin';
  updated_at: number;
}

interface FixtureRow {
  fixture_id: string;
  kickoff_utc: number;
  status: string;
  home: { team_id: number; name: string };
  away: { team_id: number; name: string };
  club_home_id?: string | null;
  club_away_id?: string | null;
}

export function evaluateWindowTransitions(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
): void {
  // Materialize windows for fixtures <48h and evaluate transitions.
  let cursor = '';
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_FIXTURES, 100, cursor);
    for (const obj of page.objects || []) {
      const f = obj.value as FixtureRow;
      const now = Date.now();
      if (typeof f.kickoff_utc !== 'number') continue;
      if (f.kickoff_utc - now > MATERIALIZE_HORIZON_MS) continue;
      if (f.status === 'PST' || f.status === 'CANC') {
        markWindowCancelled(nk, logger, f.fixture_id);
        continue;
      }
      upsertOrTransitionWindow(ctx, logger, nk, f);
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
}

function upsertOrTransitionWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  f: FixtureRow,
): void {
  const now = Date.now();
  const opens_at = f.kickoff_utc - WINDOW_PRE_MS;
  const closes_at = f.kickoff_utc + WINDOW_POST_MS;
  const desiredState: MatchWindow['state'] =
    now >= closes_at
      ? 'closed'
      : now >= f.kickoff_utc
      ? 'live'
      : now >= opens_at
      ? 'open'
      : 'scheduled';

  // Detect transition `scheduled → non-scheduled` to fire push exactly once.
  const existing = nk.storageRead([
    { collection: COL_MATCH_WINDOWS, key: f.fixture_id, userId: SYSTEM_USER_ID },
  ]);
  const prev: MatchWindow | null =
    existing.length > 0 ? (existing[0].value as MatchWindow) : null;

  const next: MatchWindow = {
    fixture_id: f.fixture_id,
    team_home_id: f.home.team_id,
    team_away_id: f.away.team_id,
    club_home_id: f.club_home_id !== undefined ? f.club_home_id : null,
    club_away_id: f.club_away_id !== undefined ? f.club_away_id : null,
    kickoff_utc: f.kickoff_utc,
    opens_at,
    closes_at,
    state: desiredState,
    notified_open_at: prev ? prev.notified_open_at : undefined,
    source: prev ? prev.source : 'api-football',
    updated_at: now,
  };

  const shouldNotify =
    (!prev || prev.state === 'scheduled') &&
    desiredState !== 'scheduled' &&
    !next.notified_open_at;

  // Write FIRST with the notification marker — atomic anti-double-send.
  if (shouldNotify) next.notified_open_at = now;

  try {
    nk.storageWrite([
      {
        collection: COL_MATCH_WINDOWS,
        key: f.fixture_id,
        userId: SYSTEM_USER_ID,
        value: next as unknown as { [key: string]: unknown },
        version: existing.length > 0 ? existing[0].version : '*', // optimistic
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);
  } catch (e) {
    logger.warn(
      '[window] concurrent update for %s; will retry next tick',
      f.fixture_id,
    );
    return;
  }

  // Send push AFTER successful write — failure here is acceptable (logged).
  if (shouldNotify) {
    // Topic shape: prefer Phase 1 lunfardo slug (club_id) when available,
    // fall back to `team_<api_id>` so unmatched clubs still receive sends.
    const homeTopic =
      next.club_home_id != null ? next.club_home_id : 'team_' + next.team_home_id;
    const awayTopic =
      next.club_away_id != null ? next.club_away_id : 'team_' + next.team_away_id;
    for (const clubId of [homeTopic, awayTopic]) {
      sendTopic(ctx, logger, nk, {
        topic: 'club_' + clubId,
        title: '¡Ventana abierta!',
        body: 'Tu club juega ahora. Mové el orto al aguantadero.',
        data: {
          type: 'window_open',
          fixture_id: next.fixture_id,
          club_id: clubId,
          kickoff_utc: String(next.kickoff_utc),
          closes_at: String(next.closes_at),
        },
      });
    }
  }
}

function markWindowCancelled(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  fixtureId: string,
): void {
  const r = nk.storageRead([
    { collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID },
  ]);
  if (r.length === 0) return;
  const w = r[0].value as MatchWindow;
  if (w.state === 'cancelled') return;
  w.state = 'cancelled';
  w.updated_at = Date.now();
  nk.storageWrite([
    {
      collection: COL_MATCH_WINDOWS,
      key: fixtureId,
      userId: SYSTEM_USER_ID,
      value: w as unknown as { [key: string]: unknown },
      version: r[0].version,
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);
  logger.info('[window] %s cancelled (postpone detected)', fixtureId);
}
