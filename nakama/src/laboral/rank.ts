// nakama/src/laboral/rank.ts
//
// Rank transition + Mesa Chica recompute helpers.
//
// Design decisions (from 03-CONTEXT.md):
//   D-13: Auto-promote thresholds — Pibe→Soldado@500, Soldado→Capo@2500.
//         Mesa Chica / Líder transitions live in recomputeMesa + seasons hook.
//   D-14: Mesa Chica = top 5 by Rep (AI+human mixed). Tie-break: human wins.
//         Debounce 5 min (MESA_DEBOUNCE_MS) prevents oscillation thrash.
//   D-16: Facción is label-only; no mechanic in Phase 3.

import {
  COL_BARRA_STATE, COL_PLAYERS, SYSTEM_USER_ID,
  KEY_MESA_DEBOUNCE_PREFIX,
} from '../storage_keys';

// ─── Constants ────────────────────────────────────────────────────────────────

// D-13: sub-rank thresholds (pibe/soldado/capo only; mesa/lider go via recomputeMesa).
export const RANK_THRESHOLDS: { [from: string]: { to: string; rep: number } } = {
  pibe:    { to: 'soldado', rep: 500 },
  soldado: { to: 'capo',    rep: 2500 },
};

// D-14: debounce between Mesa recompute calls per club.
export const MESA_DEBOUNCE_MS = 5 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileLite {
  rank: string;
  reputacion: number;
  rank_changed_at?: number;
  club_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Mutates `profile` in-place; caller MUST storageWrite the profile after this returns.
// Returns { transitioned, new_rank? } so caller can surface transition in response.
//
// Does NOT handle mesa/lider transitions — those live in recomputeMesa / seasons cron.
// T-3-RS-06 mitigation: markMesaRecomputePending sets a pending flag; actual recompute
// is debounced via get_barra_state + hourly cron (not triggered here directly).
export function checkRankTransition(
  nk: nkruntime.Nakama, logger: nkruntime.Logger,
  profile: ProfileLite,
): { transitioned: boolean; new_rank?: string } {
  let target = profile.rank;
  // Pibe → Soldado at 500 Rep (D-13).
  if (profile.rank === 'pibe' && profile.reputacion >= RANK_THRESHOLDS.pibe.rep) {
    target = RANK_THRESHOLDS.pibe.to;
  }
  // Pibe or Soldado → Capo at 2500 Rep (skip-over D-13 shortcut).
  if ((profile.rank === 'pibe' || profile.rank === 'soldado') &&
      profile.reputacion >= RANK_THRESHOLDS.soldado.rep) {
    target = RANK_THRESHOLDS.soldado.to;
  }
  if (target === profile.rank) return { transitioned: false };
  profile.rank = target;
  profile.rank_changed_at = Date.now();
  markMesaRecomputePending(nk, logger, profile.club_id);
  return { transitioned: true, new_rank: target };
}

// Sets mesa_recompute_pending on barra_state for a club (idempotent — no-op if already set).
// Uses optimistic concurrency; on conflict the flag will be re-set on the next mutation.
export function markMesaRecomputePending(
  nk: nkruntime.Nakama, _logger: nkruntime.Logger, clubId: string,
): void {
  const r = nk.storageRead([{
    collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
  }]);
  if (r.length === 0) return;
  const bs = r[0].value as { [k: string]: unknown };
  // Idempotent — skip the write if already pending.
  if (bs.mesa_recompute_pending === true) return;
  bs.mesa_recompute_pending = true;
  try {
    nk.storageWrite([{
      collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
      value: bs, version: r[0].version,
      permissionRead: 2, permissionWrite: 0,
    }]);
  } catch (e) {
    // Concurrent update — another writer already set it; safe to ignore.
  }
}

// Mesa recompute: top-5 by Rep of (all humans of this club + 5 AI entries).
// Tie-break: human wins over AI at equal Rep (D-14 stability rule).
// Atomically writes barra_state + any promoted/demoted human profiles.
// Uses optimistic concurrency on barra_state; on conflict logs and returns
// (next cron or next get_barra_state call retries — T-3-RS-06 mitigation).
export function recomputeMesa(
  nk: nkruntime.Nakama, logger: nkruntime.Logger, clubId: string,
): void {
  const bsRead = nk.storageRead([{
    collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
  }]);
  if (bsRead.length === 0) return;
  const bs = bsRead[0].value as {
    mesa_chica: Array<{
      kind: 'human' | 'ai';
      player_id?: string;
      ai_id?: string;
      display_name?: string | null;
      reputacion: number;
    }>;
    mesa_recompute_pending?: boolean;
    mesa_recompute_last_at?: number;
    ai_seeded_at?: number;
    barra_age_days?: number;
    [k: string]: unknown;
  };
  const now = Date.now();

  // 1. Preserve existing AI entries (ids + reps seeded in plan 03.01).
  const aiEntries = bs.mesa_chica.filter((e) => e.kind === 'ai');

  // 2. Paginated walk of all players in this club.
  const humans: Array<{
    kind: 'human';
    player_id: string;
    display_name: string;
    reputacion: number;
  }> = [];
  let cursor = '';
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList('', COL_PLAYERS, 100, cursor);
    for (const obj of page.objects || []) {
      const p = obj.value as { club_id?: string; display_name?: string; reputacion?: number };
      if (p.club_id !== clubId) continue;
      humans.push({
        kind: 'human',
        player_id: obj.userId || '',
        display_name: String(p.display_name ?? ''),
        reputacion: typeof p.reputacion === 'number' ? p.reputacion : 0,
      });
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  // 3. Combine + sort DESC by rep; tie-break: human beats AI (D-14 stability).
  const candidates = [...humans, ...aiEntries];
  candidates.sort((a, b) => {
    if (b.reputacion !== a.reputacion) return b.reputacion - a.reputacion;
    // Equal rep: human wins over AI.
    if (a.kind === 'human' && b.kind === 'ai') return -1;
    if (a.kind === 'ai' && b.kind === 'human') return 1;
    return 0;
  });
  const newMesa = candidates.slice(0, 5);

  // 4. Diff vs existing Mesa: detect demotion (Mesa→Capo) + promotion (Capo→Mesa).
  const prevHumanIds = new Set(
    bs.mesa_chica.filter((e) => e.kind === 'human').map((e) => e.player_id!));
  const newHumanIds = new Set(
    newMesa.filter((e) => e.kind === 'human').map((e) => e.player_id!));

  const profileWrites: nkruntime.StorageWriteRequest[] = [];

  prevHumanIds.forEach((pid) => {
    if (!newHumanIds.has(pid)) {
      // Demote: Mesa → Capo.
      const r = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId: pid }]);
      if (r.length > 0) {
        const p = r[0].value as { [k: string]: unknown };
        p.rank = 'capo';
        p.rank_changed_at = now;
        profileWrites.push({
          collection: COL_PLAYERS, key: 'profile', userId: pid,
          value: p, version: r[0].version,
          permissionRead: 2, permissionWrite: 0,
        });
      }
    }
  });

  newHumanIds.forEach((pid) => {
    if (!prevHumanIds.has(pid)) {
      // Promote: Capo → Mesa.
      const r = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId: pid }]);
      if (r.length > 0) {
        const p = r[0].value as { [k: string]: unknown };
        p.rank = 'mesa';
        p.rank_changed_at = now;
        profileWrites.push({
          collection: COL_PLAYERS, key: 'profile', userId: pid,
          value: p, version: r[0].version,
          permissionRead: 2, permissionWrite: 0,
        });
      }
    }
  });

  // 5. Atomic write: drain pending flag + stamp last_at + update barra_age_days.
  bs.mesa_chica = newMesa;
  bs.mesa_recompute_pending = false;
  bs.mesa_recompute_last_at = now;
  if (bs.ai_seeded_at) {
    bs.barra_age_days = Math.floor((now - (bs.ai_seeded_at as number)) / 86400000);
  }
  try {
    nk.storageWrite([
      {
        collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
        value: bs, version: bsRead[0].version,
        permissionRead: 2, permissionWrite: 0,
      },
      ...profileWrites,
    ]);
    logger.info('[mesa] recomputed club=%s humans=%d new_mesa=%d',
      clubId, humans.length, newMesa.length);
  } catch (e) {
    // Optimistic concurrency conflict — another writer raced us.
    // Next hourly cron or get_barra_state call will retry (T-3-RS-06 accept).
    logger.warn('[mesa] concurrent update for %s; will retry next cron', clubId);
  }
}
