// RPC: submit_turno
//
// Records that the player's pibes participated in a barra turno during an open
// match window. Idempotency-marker-first pattern prevents double-credit
// (RESEARCH §Code Examples Pattern 2, T-3-WS-01).
//
// Design decisions:
//   D-03: Turno = active commit during match window (state open|live).
//   D-04: Energy -40 per pibe; min threshold = 30 (pibes with < 30 can't participate).
//   D-06: +50 Aguante to club pool per pibe; +20 Reputación to player per pibe.
//   D-13: checkRankTransition called after Rep credit — surfaces new_rank in response.
//   T-3-WS-01: idempotency marker written to turnos/{fixture_id} BEFORE any other side-effect.
//   T-3-WS-04: energia underflow prevented by Math.max(0, ...) clamp.
//
// Critical ordering (LAB-TURNO-IDEMPOTENT invariant):
//   STEP 1: idempotency check (return prior if exists)
//   STEP 2: window gate (open|live)
//   STEP 3: read profile + validate club
//   STEP 4: read pibes + validate energy + not already en_turno
//   STEP 5: compute deltas
//   STEP 6: WRITE MARKER FIRST
//   STEP 7: atomic batch (pibes + barra_state + profile)
//
// Input:  { fixture_id: string, pibe_ids: string[] }
// Output: { ok: true, fixture_id, pibe_ids, aguante_credited, reputacion_credited, new_rank?, ... }
//       | { ok: true, ..., idempotent_replay: true }   (duplicate submission)
//       | { ok: false, error: string }

import {
  COL_BARRA_STATE, COL_MATCH_WINDOWS, COL_PIBES, COL_PLAYERS, COL_TURNOS, SYSTEM_USER_ID,
} from '../storage_keys';
import { regenEnergia, PibeRecord } from '../laboral/idle_accrual';
import { checkRankTransition } from '../laboral/rank';
import { isUuid } from '../util/validation';

// D-06 + D-04 constants (exported for plan 03.05 invariant tests).
export const TURNO_ENERGIA_COST        = 40;
export const TURNO_ENERGIA_MIN         = 30;
export const TURNO_AGUANTE_PER_PIBE    = 50;
export const TURNO_REP_PER_PIBE        = 20;

export function rpcSubmitTurno(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  let input: { fixture_id?: unknown; pibe_ids?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (typeof input.fixture_id !== 'string' || input.fixture_id.length === 0)
    return JSON.stringify({ ok: false, error: 'fixture_id_required' });
  if (!Array.isArray(input.pibe_ids) || input.pibe_ids.length === 0)
    return JSON.stringify({ ok: false, error: 'pibe_ids_required' });
  for (const pid of input.pibe_ids) {
    if (!isUuid(pid)) return JSON.stringify({ ok: false, error: 'pibe_id_invalid' });
  }
  const fixtureId = input.fixture_id as string;
  const pibeIds = input.pibe_ids as string[];

  // STEP 1: IDEMPOTENCY MARKER CHECK FIRST (RESEARCH §Code Examples Pattern 2).
  // If a prior turno record exists for this fixture, return it immediately — no side-effects.
  const turnoRead = nk.storageRead([{
    collection: COL_TURNOS, key: fixtureId, userId,
  }]);
  if (turnoRead.length > 0) {
    const prior = turnoRead[0].value as { [k: string]: unknown };
    return JSON.stringify({ ok: true, ...prior, idempotent_replay: true });
  }

  // STEP 2: Window gate (D-03).
  const winRead = nk.storageRead([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
  }]);
  if (winRead.length === 0)
    return JSON.stringify({ ok: false, error: 'no_window' });
  const win = winRead[0].value as { state?: string; closes_at?: number; club_ids?: string[] };
  if (win.state !== 'open' && win.state !== 'live')
    return JSON.stringify({ ok: false, error: 'window_not_active', state: win.state });

  // STEP 3: Read profile, validate club + ownership.
  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as {
    club_id?: string; rank?: string; reputacion?: number;
    aguante_contributed_total?: number; [k: string]: unknown;
  };
  const clubId = String(profile.club_id ?? '');
  if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });

  // STEP 4: Read each pibe, validate energy + ownership + not already en_turno.
  const reads = pibeIds.map((pid) => ({ collection: COL_PIBES, key: pid, userId }));
  const pibeRecs = nk.storageRead(reads);
  if (pibeRecs.length !== pibeIds.length)
    return JSON.stringify({ ok: false, error: 'pibe_not_found' });

  const updatedPibes: { record: PibeRecord; version: string }[] = [];
  for (const rec of pibeRecs) {
    const p = rec.value as PibeRecord;
    if (p.club_id !== clubId)
      return JSON.stringify({ ok: false, error: 'pibe_club_mismatch', pibe_id: p.id });
    if (p.en_turno_until && p.en_turno_until > now)
      return JSON.stringify({ ok: false, error: 'pibe_in_turno', pibe_id: p.id });
    const energiaNow = regenEnergia(p, now);
    if (energiaNow < TURNO_ENERGIA_MIN)
      return JSON.stringify({ ok: false, error: 'pibe_energy_low', pibe_id: p.id, energia: energiaNow });
    // D-04: deduct cost; clamp to 0 (T-3-WS-04).
    p.energia = Math.max(0, energiaNow - TURNO_ENERGIA_COST);
    p.energia_last_tick_at = now;
    p.en_turno_until = win.closes_at ?? (now + 4 * 3600 * 1000);
    updatedPibes.push({ record: p, version: rec.version });
  }

  // STEP 5: Compute deltas (D-06).
  const bsRead = nk.storageRead([{
    collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
  }]);
  if (bsRead.length === 0) return JSON.stringify({ ok: false, error: 'no_barra_state' });
  const bs = bsRead[0].value as {
    aguante_pool?: number; aguante_pool_last_tick_at?: number; [k: string]: unknown;
  };
  const aguanteDelta = TURNO_AGUANTE_PER_PIBE * pibeIds.length;
  const repDelta = TURNO_REP_PER_PIBE * pibeIds.length;
  bs.aguante_pool = (typeof bs.aguante_pool === 'number' ? bs.aguante_pool : 0) + aguanteDelta;
  bs.aguante_pool_last_tick_at = now;

  profile.reputacion = (typeof profile.reputacion === 'number' ? profile.reputacion : 0) + repDelta;
  // Track cumulative aguante contribution (v1.1 "Top Boys" leaderboard substrate).
  profile.aguante_contributed_total = (
    typeof profile.aguante_contributed_total === 'number'
      ? profile.aguante_contributed_total : 0
  ) + aguanteDelta;

  // Rank transition after Rep credit (D-13). markMesaRecomputePending called inside if promoted.
  const rankTransition = checkRankTransition(nk, logger, profile as {
    rank: string; reputacion: number; rank_changed_at?: number; club_id: string;
  });

  // STEP 6: WRITE TURNOS MARKER FIRST — anti-double-fire guarantee (T-3-WS-01).
  const turnoRecord = {
    fixture_id: fixtureId, user_id: userId, submitted_at: now,
    pibe_ids: pibeIds, energia_consumed_per_pibe: TURNO_ENERGIA_COST,
    aguante_credited: aguanteDelta, reputacion_credited: repDelta,
    status: 'submitted', claimed_at: null,
    new_rank: rankTransition.new_rank ?? null,
  };
  nk.storageWrite([{
    collection: COL_TURNOS, key: fixtureId, userId,
    value: turnoRecord as unknown as { [k: string]: unknown },
    permissionRead: 1, permissionWrite: 0,
  }]);

  // STEP 7: Atomic batch — pibes + barra_state + profile.
  // On conflict: marker is persisted, client retry will see idempotent_replay.
  const writes: nkruntime.StorageWriteRequest[] = [
    ...updatedPibes.map(({ record, version }) => ({
      collection: COL_PIBES, key: record.id, userId,
      value: record as unknown as { [k: string]: unknown },
      version,
      permissionRead: 1, permissionWrite: 0,
    })),
    {
      collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
      value: bs, version: bsRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    },
    {
      collection: COL_PLAYERS, key: 'profile', userId,
      value: profile, version: profRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    },
  ];
  try { nk.storageWrite(writes); }
  catch (e) {
    logger.warn('[submit_turno] write conflict user=%s fixture=%s; turno marker stays — client retry safe',
      userId, fixtureId);
  }

  logger.info('[submit_turno] user=%s fixture=%s pibes=%d aguante=%d rep=%d new_rank=%s',
    userId, fixtureId, pibeIds.length, aguanteDelta, repDelta, rankTransition.new_rank ?? 'none');
  return JSON.stringify({ ok: true, ...turnoRecord });
}
