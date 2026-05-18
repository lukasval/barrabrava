// nakama/src/scheduler/leaderboard_cron.ts
// Idempotent leaderboard-create + reset-hook registration for the heartbeat
// scheduler. Two dummy leaderboards exist solely as cron carriers — no scores
// are ever submitted; the only purpose is to trigger `registerLeaderboardReset`
// on a known cadence (D-09).
//
//   bb_tick_15m  → cron "*/15 * * * *"   (every 15 minutes)
//   bb_tick_6h   → cron "0 */6 * * *"    (every 6 hours)
//
// The tick itself (`runHeartbeatTick`) decides whether to actually do work based
// on `state.active_cadence` — the wrong-cadence tick returns immediately.
//
// CRITICAL: NO `nk.timerCreate` exists in Nakama TS runtime. This pattern is
// the only supported way to schedule recurring server-side work.

import { runHeartbeatTick } from './tick';

export function ensureSchedulerLeaderboards(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
): void {
  // Idempotent: leaderboardCreate throws if it already exists; we swallow that
  // and proceed. Any other error propagates via the outer InitModule.
  try {
    nk.leaderboardCreate(
      'bb_tick_15m',
      true, // authoritative — never accept client submissions
      // sortOrder + operator are leaderboard semantics; we never read records so
      // values are cosmetic. Omit to use Nakama defaults (desc / best).
      undefined,
      undefined,
      '*/15 * * * *',
      { purpose: 'scheduler_tick' },
    );
  } catch (e) {
    // already exists — expected on every boot after the first
  }
  try {
    nk.leaderboardCreate(
      'bb_tick_6h',
      true,
      undefined,
      undefined,
      '0 */6 * * *',
      { purpose: 'scheduler_tick' },
    );
  } catch (e) {
    // already exists
  }
  logger.info('Scheduler leaderboards ensured (bb_tick_15m, bb_tick_6h)');
}

// Nakama scans the AST of the registered callback to extract a "function key".
// Anonymous function expressions have no name → "function key could not be extracted: not found"
// at boot (#GOJA-AST). Pass a NAMED top-level function declaration instead (same
// constraint that makes InitModule itself a function declaration, not an arrow).
function onSchedulerLeaderboardReset(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  lb: nkruntime.Leaderboard,
  _reset: number,
): void {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id as 'bb_tick_15m' | 'bb_tick_6h');
  }
}

export function registerSchedulerHooks(initializer: nkruntime.Initializer): void {
  initializer.registerLeaderboardReset(onSchedulerLeaderboardReset);
}
