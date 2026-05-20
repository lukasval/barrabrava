// RPC: recruit_pibe
//
// Recruits a pibe from the club's daily pool into the player's roster.
// Enforces rank-gated cost/Rep-min/lifetime-cap (D-12) and a per-aguantadero
// roster cap (PIB-01). Optimistic concurrency on the shared pool prevents two
// players from claiming the same pick simultaneously (LAB-RECRUIT-RACE).
//
// Design decisions:
//   D-09: Pool is system-owned per club; refreshed daily by recruit_cron.
//   D-10: trait_2 is revealed here (materializePibeFromPick copies it from pick).
//   D-11: materializePibeFromPick produces a full PibeRecord from a deterministic pick.
//   D-12: Rank gates: cost + Rep_min + lifetime_cap. Tutorial bypasses cost+rep, not cap.
//   T-3-WS-02: Optimistic concurrency — concurrent pick write with same version → exception
//              → return pick_already_taken to the loser.
//   T-3-WS-06: Server reads rank from storage; never trusts payload-supplied rank.
//
// Input:  { pick_id: string, tutorial?: boolean }
// Output: { ok: true, pibe: PibeRecord }
//       | { ok: false, error: string, ... }

import {
  COL_AGUANTADEROS, COL_PIBES, COL_PLAYERS, COL_RECRUIT_POOL,
  KEY_AGUANTADERO_MAIN, SYSTEM_USER_ID,
} from '../storage_keys';
import { materializePibeFromPick, generatePick, PickValue } from '../laboral/pibe_factory';
import { isUuid } from '../util/validation';

// D-12: cost + Rep min + lifetime cap per rank (exported for plan 03.05 invariant tests).
export const RECRUIT_GATES: { [rank: string]: { cost: number; rep_min: number; lifetime_cap: number } } = {
  pibe:    { cost: 500, rep_min: 0,    lifetime_cap: 2 },
  soldado: { cost: 400, rep_min: 100,  lifetime_cap: 5 },
  capo:    { cost: 300, rep_min: 500,  lifetime_cap: 10 },
  mesa:    { cost: 200, rep_min: 1000, lifetime_cap: 20 },
  lider:   { cost: 200, rep_min: 1000, lifetime_cap: 20 },
};

export function rpcRecruitPibe(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  let input: { pick_id?: unknown; tutorial?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (!isUuid(input.pick_id)) return JSON.stringify({ ok: false, error: 'pick_id_required' });
  const pickId = input.pick_id as string;
  const isTutorial = input.tutorial === true;

  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as {
    club_id?: string; rank?: string; plata?: number; reputacion?: number;
    pibes_recruited_total?: number; [k: string]: unknown;
  };
  const clubId = String(profile.club_id ?? '');
  if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });
  const rank = String(profile.rank ?? 'pibe');
  const gate = RECRUIT_GATES[rank];
  if (!gate) return JSON.stringify({ ok: false, error: 'unknown_rank' });

  const recruitedTotal = typeof profile.pibes_recruited_total === 'number' ? profile.pibes_recruited_total : 0;
  // Rank gates (D-12): rep_min + lifetime_cap. Tutorial bypasses cost + rep_min.
  if (recruitedTotal >= gate.lifetime_cap) {
    return JSON.stringify({ ok: false, error: 'lifetime_cap_reached', rank, cap: gate.lifetime_cap });
  }
  const plata = typeof profile.plata === 'number' ? profile.plata : 0;
  const reputacion = typeof profile.reputacion === 'number' ? profile.reputacion : 0;
  const cost = isTutorial ? 0 : gate.cost;
  if (!isTutorial && reputacion < gate.rep_min) {
    return JSON.stringify({ ok: false, error: 'rep_min_not_reached', need: gate.rep_min, have: reputacion });
  }
  if (plata < cost) return JSON.stringify({ ok: false, error: 'plata_insufficient', need: cost, have: plata });

  // Roster cap from aguantadero level (PIB-01).
  const aguRead = nk.storageRead([{ collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId }]);
  const aguLevel = aguRead.length > 0 ? Number((aguRead[0].value as { level?: number }).level ?? 1) : 1;
  const rosterCap = ({ 1: 5, 2: 8, 3: 12, 4: 16, 5: 20 } as { [k: number]: number })[aguLevel] ?? 5;
  // Count current pibes.
  let currentCount = 0;
  let cursor = '';
  for (let pg = 0; pg < 5; pg++) {
    const page = nk.storageList(userId, COL_PIBES, 100, cursor);
    currentCount += (page.objects || []).length;
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  if (currentCount >= rosterCap) {
    return JSON.stringify({ ok: false, error: 'roster_cap_reached', cap: rosterCap });
  }

  let pick: PickValue | null = null;
  if (isTutorial) {
    // Tutorial: synthesize a deterministic pick directly (no pool dependency).
    // RESEARCH §Tutorial Scripting step 2.
    pick = generatePick(nk, clubId);
  } else {
    // Optimistic-concurrency read-modify-write of recruit_pool (T-3-WS-02, RESEARCH Pitfall 1).
    const poolRead = nk.storageRead([{
      collection: COL_RECRUIT_POOL, key: clubId, userId: SYSTEM_USER_ID,
    }]);
    if (poolRead.length === 0) return JSON.stringify({ ok: false, error: 'no_pool' });
    const poolValue = poolRead[0].value as { picks?: PickValue[]; [k: string]: unknown };
    const poolVersion = poolRead[0].version;
    const picks: PickValue[] = poolValue.picks || [];
    const idx = picks.findIndex((p) => p.pick_id === pickId);
    if (idx < 0) return JSON.stringify({ ok: false, error: 'pick_not_in_pool' });
    pick = picks[idx];
    // Remove pick from pool — write back with optimistic concurrency.
    const remaining = picks.slice(0, idx).concat(picks.slice(idx + 1));
    const updatedPool = { ...poolValue, picks: remaining };
    try {
      nk.storageWrite([{
        collection: COL_RECRUIT_POOL, key: clubId, userId: SYSTEM_USER_ID,
        value: updatedPool as { [k: string]: unknown }, version: poolVersion,
        permissionRead: 2, permissionWrite: 0,
      }]);
    } catch (e) {
      logger.warn('[recruit_pibe] pool concurrent_update; pick may be taken user=%s pick=%s', userId, pickId);
      return JSON.stringify({ ok: false, error: 'pick_already_taken' });
    }
  }

  // Materialize pibe + atomic deduction of Plata + increment recruited_total.
  const pibe = materializePibeFromPick(pick!, clubId, now);
  profile.plata = plata - cost;
  profile.pibes_recruited_total = recruitedTotal + 1;
  nk.storageWrite([
    {
      collection: COL_PIBES, key: pibe.id, userId,
      value: pibe as unknown as { [k: string]: unknown },
      permissionRead: 1, permissionWrite: 0,
    },
    {
      collection: COL_PLAYERS, key: 'profile', userId,
      value: profile, version: profRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    },
  ]);

  logger.info('[recruit_pibe] user=%s pibe=%s rank=%s cost=%d tutorial=%s',
    userId, pibe.id, rank, cost, String(isTutorial));
  return JSON.stringify({ ok: true, pibe });
}
