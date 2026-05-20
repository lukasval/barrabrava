// RPC: complete_tutorial
//
// Advances the tutorial step counter. On the final step (6), atomically grants:
//   - tutorial_done = true + cantico_unlocked = 'primer_cantico' in profile
//   - tutorial_trapo appended to aguantadero.trapos_robados[]
//
// Idempotent: re-calling after tutorial_done is true returns the prior reward state.
// This prevents double-grant on network retry (T-3-WS-09 / LAB-TUTORIAL-REWARD-ATOMIC).
//
// Design decisions:
//   ONB-05/06: Tutorial scripted 6-step flow (RESEARCH §Tutorial Scripting).
//   Step 5 simulates a turno reward (+20 Rep) without the real submit_turno dependency
//   — avoids requiring an open match_window during onboarding.
//   LAB-TUTORIAL-DURATION: optional elapsed_ms telemetry from client; server logs it on
//   step 6 but NEVER uses it for business logic (T-3-UIB-05 accepted risk).
//
// Input:  { step: number, elapsed_ms?: number }
// Output: { ok: true, step, tutorial_done: boolean, rep_credited?: number }
//       | { ok: true, tutorial_done: true, reward: { trapo, cantico } }
//       | { ok: true, idempotent_replay: true, tutorial_done: true, cantico_unlocked }
//       | { ok: false, error: string }

import {
  COL_AGUANTADEROS, COL_PLAYERS, KEY_AGUANTADERO_MAIN,
} from '../storage_keys';

const FINAL_STEP = 6;

export function rpcCompleteTutorial(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  let input: { step?: unknown; elapsed_ms?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (typeof input.step !== 'number')
    return JSON.stringify({ ok: false, error: 'step_required' });
  const step = Math.floor(input.step);
  if (step < 1 || step > FINAL_STEP)
    return JSON.stringify({ ok: false, error: 'step_out_of_range' });

  // Parse optional elapsed_ms telemetry (client-supplied; telemetry-only — never trust for logic).
  const elapsedMs = typeof input.elapsed_ms === 'number' && input.elapsed_ms >= 0
    ? Math.floor(input.elapsed_ms) : 0;

  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as {
    tutorial_done?: boolean; tutorial_step?: number;
    cantico_unlocked?: string; reputacion?: number;
    [k: string]: unknown;
  };

  // Idempotency gate (T-3-WS-09): tutorial already completed — return prior state.
  if (profile.tutorial_done === true) {
    return JSON.stringify({
      ok: true, idempotent_replay: true, tutorial_done: true,
      cantico_unlocked: profile.cantico_unlocked ?? 'primer_cantico',
    });
  }

  // Step 5: simulated turno reward (ONB-05 scripted, RESEARCH §Tutorial Scripting step 5).
  // Server directly credits +20 Rep without requiring an open match_window.
  let repDelta = 0;
  if (step === 5) {
    repDelta = 20;
    profile.reputacion = (typeof profile.reputacion === 'number' ? profile.reputacion : 0) + repDelta;
  }

  if (step < FINAL_STEP) {
    profile.tutorial_step = step;
    nk.storageWrite([{
      collection: COL_PLAYERS, key: 'profile', userId,
      value: profile, version: profRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    }]);
    return JSON.stringify({
      ok: true, step, tutorial_done: false, rep_credited: repDelta,
    });
  }

  // FINAL step (6): atomic profile + aguantadero update (RESEARCH §Atomicity of Final Reward).
  // Both rewards granted in a single storageWrite batch — partial failure is safe because
  // tutorial_done=false until write succeeds, and tutorial_trapo has stable id preventing dupe.
  profile.tutorial_done = true;
  profile.tutorial_step = FINAL_STEP;
  profile.cantico_unlocked = 'primer_cantico';

  // Append tutorial_trapo to aguantadero.trapos_robados[] (stable id = no duplicate on retry).
  const aguRead = nk.storageRead([{
    collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
  }]);
  const writes: nkruntime.StorageWriteRequest[] = [{
    collection: COL_PLAYERS, key: 'profile', userId,
    value: profile, version: profRead[0].version,
    permissionRead: 2, permissionWrite: 0,
  }];
  if (aguRead.length > 0) {
    const agu = aguRead[0].value as { trapos_robados?: Array<{ id: string; [k: string]: unknown }>; [k: string]: unknown };
    const trapos = Array.isArray(agu.trapos_robados) ? agu.trapos_robados : [];
    if (!trapos.find((t) => t?.id === 'tutorial_trapo')) {
      trapos.push({ id: 'tutorial_trapo', name: 'Primer trapo', granted_at: now });
    }
    agu.trapos_robados = trapos;
    writes.push({
      collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
      value: agu, version: aguRead[0].version,
      permissionRead: 1, permissionWrite: 0,
    });
  }
  nk.storageWrite(writes);

  // LAB-TUTORIAL-DURATION precursor: log elapsed_ms for plan 03.05 invariant test.
  // elapsed_ms comes from client (informational only; T-3-UIB-05 accepted).
  logger.info('[complete_tutorial] user=%s tutorial_done=true tutorial_duration_ms=%d', userId, elapsedMs);
  return JSON.stringify({
    ok: true, tutorial_done: true,
    reward: { trapo: 'tutorial_trapo', cantico: 'primer_cantico' },
  });
}
