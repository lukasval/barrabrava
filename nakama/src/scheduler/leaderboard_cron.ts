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

// Nakama's `getHookFnIdentifier` (server/runtime_javascript_init.go) walks ONLY
// the top-level statements of InitModule's body — it does NOT descend into
// helper function calls. So `initializer.registerLeaderboardReset(...)` MUST
// appear directly as an ExpressionStatement inside InitModule, with the
// argument being an Identifier referring to a top-level named function
// declaration. Wrapping it in a `registerSchedulerHooks(initializer)` helper
// makes the AST walker miss the registration entirely, producing the runtime
// error "function key could not be extracted: not found".
//
// We therefore export the hook function as a top-level declaration here and
// the registration line itself lives in main.ts inside InitModule.
export function onSchedulerLeaderboardReset(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  lb: nkruntime.Leaderboard,
  _reset: number,
): void {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id as 'bb_tick_15m' | 'bb_tick_6h');
  } else if (lb.id === 'bb_recruit_05_art') {
    logger.info('[recruit_cron] fired (handler stub — Wave 2 lands body)');
  } else if (lb.id === 'bb_mesa_recompute_1h') {
    logger.info('[mesa_cron] fired (handler stub — Wave 2 lands body)');
  }
}

// Phase 3: Core Loop Laboral — two new cron-carrier leaderboards.
//
//   bb_recruit_05_art  → cron "0 8 * * *"  (UTC = 05:00 ART, no DST — RESEARCH Q4/A9)
//   bb_mesa_recompute_1h → cron "0 * * * *"  (every hour on the hour)
//
// IMPORTANT: Do NOT add a second cron registration call. The single Phase 2
// registration in main.ts dispatches ALL leaderboards via lb.id (RESEARCH §569).
// Only the onSchedulerLeaderboardReset body above needs extending with else-if branches.
export function ensureLaboralLeaderboards(
  nk: nkruntime.Nakama, logger: nkruntime.Logger,
): void {
  try {
    nk.leaderboardCreate('bb_recruit_05_art', true, undefined, undefined,
      '0 8 * * *', { purpose: 'recruit_pool_refresh' });
  } catch (e) { /* already exists */ }
  try {
    nk.leaderboardCreate('bb_mesa_recompute_1h', true, undefined, undefined,
      '0 * * * *', { purpose: 'mesa_chica_recompute' });
  } catch (e) { /* already exists */ }
  logger.info('Laboral leaderboards ensured (bb_recruit_05_art, bb_mesa_recompute_1h)');
}
