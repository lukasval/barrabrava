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
  COL_BARRA_STATE,
  COL_PLAYERS,
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

    // D-15: on active→ended transition, elect Líder per club from Mesa Chica top entry.
    if (existing.status === 'active' && newStatus === 'ended') {
      electLideresForAllClubs(nk, logger, maxSeason);
    }
  }
}

// electLideresForAllClubs — walks all barra_state records and elects the highest-Rep
// player as Líder for each club at season end (D-15). Triggered once per season transition.
// T-3-WS-12: cost is O(1) per club (just reads mesa_chica[0]); one-shot per season.
function electLideresForAllClubs(
  nk: nkruntime.Nakama, logger: nkruntime.Logger, seasonId: number,
): void {
  const now = Date.now();
  let cursor = '';
  let elected = 0;
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_BARRA_STATE, 100, cursor);
    for (const obj of page.objects || []) {
      const clubId = obj.key;
      const bs = obj.value as {
        mesa_chica: Array<{
          kind: 'human' | 'ai';
          player_id?: string;
          ai_id?: string;
          display_name?: string | null;
          reputacion: number;
        }>;
        lider?: {
          kind: string;
          ai_id?: string;
          player_id?: string;
          reputacion: number;
          season_id?: number;
        };
        [k: string]: unknown;
      };

      // Pick highest-Rep entry from Mesa (already sorted DESC by recomputeMesa).
      const top = bs.mesa_chica && bs.mesa_chica.length > 0 ? bs.mesa_chica[0] : null;
      if (!top) continue;

      const newLider = top.kind === 'human'
        ? {
            kind: 'human' as const,
            player_id: top.player_id,
            display_name: top.display_name ?? null,
            reputacion: top.reputacion,
            elected_at: now,
            season_id: seasonId,
          }
        : {
            kind: 'ai' as const,
            ai_id: top.ai_id,
            display_name: null,  // AI display label rendered at UI layer (D-14)
            reputacion: top.reputacion,
            elected_at: now,
            season_id: seasonId,
          };

      // Promote/demote human ranks if Líder changed.
      const prevLider = bs.lider;
      const writes: nkruntime.StorageWriteRequest[] = [];

      if (prevLider && prevLider.kind === 'human' &&
          prevLider.player_id !== (newLider as { player_id?: string }).player_id) {
        // Previous human Líder → demote to mesa (still top 5 — mesa cron will sync next hour).
        const r = nk.storageRead([{
          collection: COL_PLAYERS, key: 'profile', userId: prevLider.player_id!,
        }]);
        if (r.length > 0) {
          const p = r[0].value as { [k: string]: unknown };
          p.rank = 'mesa';
          p.rank_changed_at = now;
          writes.push({
            collection: COL_PLAYERS, key: 'profile', userId: prevLider.player_id!,
            value: p, version: r[0].version,
            permissionRead: 2, permissionWrite: 0,
          });
        }
      }

      if (newLider.kind === 'human' && (newLider as { player_id?: string }).player_id) {
        // New human Líder → promote to lider rank.
        const r = nk.storageRead([{
          collection: COL_PLAYERS, key: 'profile',
          userId: (newLider as { player_id: string }).player_id,
        }]);
        if (r.length > 0) {
          const p = r[0].value as { [k: string]: unknown };
          p.rank = 'lider';
          p.rank_changed_at = now;
          writes.push({
            collection: COL_PLAYERS, key: 'profile',
            userId: (newLider as { player_id: string }).player_id,
            value: p, version: r[0].version,
            permissionRead: 2, permissionWrite: 0,
          });
        }
      }

      bs.lider = newLider;
      writes.push({
        collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
        value: bs, version: obj.version,
        permissionRead: 2, permissionWrite: 0,
      });

      try {
        nk.storageWrite(writes);
        elected++;
        logger.info('[season] lider_elected club=%s kind=%s season=%d',
          clubId, newLider.kind, seasonId);
      } catch (e) {
        // Optimistic concurrency conflict — next season end will correct (T-3-WS-12 accept).
        logger.warn('[season] lider election conflict club=%s', clubId);
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  logger.info('[season] lider election complete season=%d clubs_processed=%d', seasonId, elected);
}
