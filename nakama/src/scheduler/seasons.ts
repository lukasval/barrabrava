// nakama/src/scheduler/seasons.ts
// Season state detector. Reads COL_FIXTURES (Primera only — D-19 says
// "Phase 2 mantiene UNA season activa global"), finds the max `season` year
// and the first/last kickoff in that cluster, and writes COL_META[current_season]
// when the status changes.
//
// Status machine (D-17):
//   pre     — first fixture is >7d away
//   active  — first fixture is within <=7d OR has already started
//   ended   — 7 days have elapsed since the last detected fixture
//
// Singleton record. Each tick reads + writes once at most (write-only when
// status or season_id actually changed — prevents pointless storageWrite churn).

import {
  COL_FIXTURES,
  COL_META,
  SYSTEM_USER_ID,
  KEY_CURRENT_SEASON,
} from '../storage_keys';

interface SeasonState {
  season_id: number;
  division: 'primera' | 'nacional';
  torneo_name: string;
  started_at: number;
  ends_at: number;
  status: 'pre' | 'active' | 'ended';
}

export function detectSeasonState(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
): void {
  const now = Date.now();
  let firstKickoff: number | undefined;
  let lastKickoff: number | undefined;
  let maxSeason = 0;

  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_FIXTURES, 100, cursor);
    for (const obj of page.objects || []) {
      const f = obj.value as {
        kickoff_utc?: number;
        season?: number;
        division?: string;
      };
      if (f.division !== 'primera') continue; // D-19: Primera drives season state
      if (typeof f.season === 'number' && f.season > maxSeason) {
        maxSeason = f.season;
      }
      if (typeof f.kickoff_utc === 'number') {
        if (firstKickoff === undefined || f.kickoff_utc < firstKickoff) {
          firstKickoff = f.kickoff_utc;
        }
        if (lastKickoff === undefined || f.kickoff_utc > lastKickoff) {
          lastKickoff = f.kickoff_utc;
        }
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  if (!maxSeason || firstKickoff === undefined || lastKickoff === undefined) {
    // No Primera fixtures stored yet — nothing to derive.
    return;
  }

  // D-17: auto-start when first fixture within <=7d. auto-end 7d after last.
  const sevenDays = 7 * 24 * 3600 * 1000;
  let newStatus: SeasonState['status'] = 'pre';
  if (now >= lastKickoff + sevenDays) {
    newStatus = 'ended';
  } else if (firstKickoff - now <= sevenDays) {
    newStatus = 'active';
  }

  // Read existing season state.
  const r = nk.storageRead([
    {
      collection: COL_META,
      key: KEY_CURRENT_SEASON,
      userId: SYSTEM_USER_ID,
    },
  ]);
  const existing: Partial<SeasonState> =
    r.length > 0 ? (r[0].value as SeasonState) : {};

  // Only write if status changed or not yet initialized.
  if (
    r.length === 0 ||
    existing.status !== newStatus ||
    existing.season_id !== maxSeason
  ) {
    const state: SeasonState = {
      season_id: maxSeason,
      division: 'primera',
      torneo_name: 'Temporada ' + String(maxSeason),
      started_at:
        existing.started_at !== undefined ? existing.started_at : firstKickoff,
      ends_at: lastKickoff + sevenDays,
      status: newStatus,
    };
    nk.storageWrite([
      {
        collection: COL_META,
        key: KEY_CURRENT_SEASON,
        userId: SYSTEM_USER_ID,
        value: state as unknown as { [key: string]: unknown },
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);
    logger.info('[season] status=%s season=%d', newStatus, maxSeason);
  }
}
