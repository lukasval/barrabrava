// nakama/src/scheduler/tick.ts
// Heartbeat tick entry point — invoked by the leaderboard reset hook on each
// dummy cron leaderboard (bb_tick_15m / bb_tick_6h). Acquires a distributed lock
// (KEY_TICK_LOCK, 5-min TTL) via COL_META, polls API-Football, evaluates window
// transitions, detects season state, and rewrites cadence flag for next tick.
//
// CRITICAL: Nakama TS runtime has NO `nk.timerCreate`. The only way to schedule
// recurring server work is via `registerLeaderboardReset` against a leaderboard
// with a cron reset schedule. See leaderboard_cron.ts and 02-RESEARCH.md §Q1.
//
// Goja constraints:
//   - No setTimeout / setInterval (synchronous only).
//   - Function declarations preferred at top-level (not arrows) for AST safety,
//     though that constraint specifically targets InitModule; helpers may use
//     either.

import {
  COL_META,
  COL_MATCH_WINDOWS,
  SYSTEM_USER_ID,
  KEY_TICK_LOCK,
  KEY_SCHEDULER_STATE,
} from '../storage_keys';
import { pollFixtures } from '../integrations/api_football';
import { evaluateWindowTransitions } from './windows';
import { detectSeasonState } from './seasons';

const TICK_LOCK_TTL_MS = 5 * 60 * 1000; // 5 min — long enough for poll + sends

interface SchedulerState {
  last_poll_at: number; // unix ms
  last_poll_success_at: number;
  next_fixture_kickoff?: number;
  active_cadence: '15m' | '6h';
}

export function runHeartbeatTick(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  triggeredBy: 'bb_tick_15m' | 'bb_tick_6h',
): void {
  // Acquire tick lock — prevents overlap if previous tick still running (e.g.
  // duplicate Railway replicas or admin_force_repoll racing the cron).
  const now = Date.now();
  const lockRead = nk.storageRead([
    { collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID },
  ]);
  if (lockRead.length > 0) {
    const lock = lockRead[0].value as { acquired_at: number; epoch: string };
    if (lock.acquired_at + TICK_LOCK_TTL_MS > now) {
      logger.info(
        '[tick] previous tick still active (acquired %dms ago); skipping',
        now - lock.acquired_at,
      );
      return;
    }
    logger.warn(
      '[tick] previous tick lock expired (stale by %dms) — proceeding',
      now - lock.acquired_at - TICK_LOCK_TTL_MS,
    );
  }
  const epoch = nk.uuidv4();
  nk.storageWrite([
    {
      collection: COL_META,
      key: KEY_TICK_LOCK,
      userId: SYSTEM_USER_ID,
      value: { acquired_at: now, epoch },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);

  try {
    // Read state — decide whether to actually run for THIS cadence.
    const stateRead = nk.storageRead([
      { collection: COL_META, key: KEY_SCHEDULER_STATE, userId: SYSTEM_USER_ID },
    ]);
    const state: SchedulerState =
      stateRead.length > 0
        ? (stateRead[0].value as SchedulerState)
        : { last_poll_at: 0, last_poll_success_at: 0, active_cadence: '6h' };

    // Skip if wrong cadence — e.g., 15m fires but no fixture in 24h.
    if (triggeredBy === 'bb_tick_15m' && state.active_cadence !== '15m') {
      logger.debug('[tick] 15m fired but active cadence is 6h; skip');
      return;
    }
    if (triggeredBy === 'bb_tick_6h' && state.active_cadence !== '6h') {
      logger.debug('[tick] 6h fired but active cadence is 15m; skip');
      return;
    }

    // 1. Poll fixtures (max 3 API-Football calls; each ~500ms).
    let polled = 0;
    try {
      polled = pollFixtures(ctx, logger, nk, /*windowDays*/ 14);
      state.last_poll_at = Date.now();
      state.last_poll_success_at = Date.now();
    } catch (e) {
      logger.warn('[tick] pollFixtures failed: %s', String(e));
      state.last_poll_at = Date.now();
      // last_poll_success_at unchanged — fallback cache remains in use.
    }

    // 2. Evaluate window transitions + emit FCM topics for `scheduled → open`.
    evaluateWindowTransitions(ctx, logger, nk);

    // 3. Update season state.
    detectSeasonState(ctx, logger, nk);

    // 4. Reschedule cadence based on next fixture.
    const next = findNextKickoffWithin24h(nk);
    state.next_fixture_kickoff = next;
    state.active_cadence =
      next !== undefined && next - Date.now() < 24 * 3600 * 1000 ? '15m' : '6h';

    nk.storageWrite([
      {
        collection: COL_META,
        key: KEY_SCHEDULER_STATE,
        userId: SYSTEM_USER_ID,
        value: state,
        permissionRead: 0,
        permissionWrite: 0,
      },
    ]);

    logger.info(
      '[tick] done — polled=%d cadence=%s nextKickoff=%s',
      polled,
      state.active_cadence,
      next ? new Date(next).toISOString() : 'none',
    );
  } finally {
    // Release lock if it's still ours (epoch match — prevents an overdue tick
    // from releasing the lock of a fresh tick that already acquired it).
    const finalLockRead = nk.storageRead([
      { collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID },
    ]);
    if (
      finalLockRead.length > 0 &&
      (finalLockRead[0].value as { epoch?: string }).epoch === epoch
    ) {
      nk.storageDelete([
        { collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID },
      ]);
    }
  }
}

// findNextKickoffWithin24h: scans COL_MATCH_WINDOWS page-by-page (S2 pattern:
// 50 × 100) and returns the minimum `opens_at` where opens_at > now and
// opens_at - now < 24h. Used by the cadence-flip logic so the next 15m tick
// (or 6h tick) lines up with the imminent kickoff cluster.
function findNextKickoffWithin24h(nk: nkruntime.Nakama): number | undefined {
  const now = Date.now();
  const horizon = now + 24 * 3600 * 1000;
  let earliest: number | undefined;
  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_MATCH_WINDOWS, 100, cursor);
    for (const obj of page.objects || []) {
      const w = obj.value as { opens_at?: number; state?: string };
      if (
        w.state === 'scheduled' &&
        w.opens_at !== undefined &&
        w.opens_at > now &&
        w.opens_at < horizon
      ) {
        if (earliest === undefined || w.opens_at < earliest) earliest = w.opens_at;
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return earliest;
}
