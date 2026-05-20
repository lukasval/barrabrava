// RPC: collect_idle
//
// Commits accumulated idle Plata/VBC from all (or one) assigned pibes into the
// player's profile. Stamps last_collected_at + bumps skill hours on each pibe.
//
// Design decisions:
//   D-01: Only this RPC writes last_collected_at / skill hours — get_roster never does.
//         Prevents the T-3-RS-02 double-credit race.
//   D-02: 12h offline cap applied inside accrueIdleForPibe (elapsed clamped to IDLE_CAP_MS).
//   D-05: Skill grind: profession_hours incremented by hours_worked (post-cap).
//   D-07: hablar_cana VBC zero-out for non-Líder enforced in accrueIdleForPibe.
//   T-3-WS-03: last_collected_at is server-stamped; spam collect = 0 accrual.
//
// Input:  { pibe_id?: string, tutorial?: boolean }
//          pibe_id null = collect all pibes
//          tutorial = true → fixed +10 Plata bypass (TutorialScreen step 4)
// Output: { ok: true, plata_credited: number, vbc_credited: number, per_pibe: CollectResult[] }
//       | { ok: false, error: string }

import { COL_PIBES, COL_PLAYERS } from '../storage_keys';
import { accrueIdleForPibe, PibeRecord } from '../laboral/idle_accrual';
import { isUuid } from '../util/validation';

export interface CollectResult {
  pibe_id: string; plata: number; vbc: number; hours_worked: number;
}

export function commitAccrualForPibes(
  nk: nkruntime.Nakama, logger: nkruntime.Logger,
  userId: string, pibeIds: string[] | null, now: number, ownerRank: string,
): { results: CollectResult[]; total_plata: number; total_vbc: number } {
  // 1. Read all pibes (or filter by ids).
  const pibes: PibeRecord[] = [];
  const versions: { [k: string]: string } = {};
  let cursor = '';
  for (let pg = 0; pg < 5; pg++) {
    const page = nk.storageList(userId, COL_PIBES, 100, cursor);
    for (const obj of page.objects || []) {
      const p = obj.value as PibeRecord;
      if (pibeIds && !pibeIds.includes(p.id)) continue;
      pibes.push(p);
      versions[p.id] = obj.version;
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  // 2. Compute accrual per pibe + mutate in-place (skill bump + stamp last_collected_at).
  const results: CollectResult[] = [];
  let totalPlata = 0, totalVbc = 0;
  const writes: nkruntime.StorageWriteRequest[] = [];
  for (const p of pibes) {
    const a = accrueIdleForPibe(p, now, ownerRank);
    if (a.plata_delta === 0 && a.vbc_delta === 0) continue;
    totalPlata += a.plata_delta;
    totalVbc += a.vbc_delta;
    if (p.profession) {
      const k = p.profession + '_hours';
      p.skills[k] = (p.skills[k] || 0) + a.hours_worked;
    }
    p.last_collected_at = now;
    writes.push({
      collection: COL_PIBES, key: p.id, userId,
      value: p as unknown as { [k: string]: unknown },
      version: versions[p.id],
      permissionRead: 1, permissionWrite: 0,
    });
    results.push({ pibe_id: p.id, plata: a.plata_delta, vbc: a.vbc_delta, hours_worked: a.hours_worked });
  }
  if (writes.length > 0) {
    try { nk.storageWrite(writes); }
    catch (e) { logger.warn('[collect_idle] write conflict user=%s', userId); }
  }
  return { results, total_plata: totalPlata, total_vbc: totalVbc };
}

export function rpcCollectIdle(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  let input: { pibe_id?: unknown; tutorial?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  const filter: string[] | null = isUuid(input.pibe_id) ? [input.pibe_id as string] : null;

  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as { rank?: string; plata?: number; vbc?: number; [k: string]: unknown };
  const ownerRank = String(profile.rank ?? 'pibe');

  // Tutorial bypass (TutorialScreen step 4): grant fixed 10 Plata
  // without computing accrual — player hasn't had pibes long enough to earn naturally.
  if (input.tutorial === true) {
    profile.plata = (typeof profile.plata === 'number' ? profile.plata : 0) + 10;
    nk.storageWrite([{
      collection: COL_PLAYERS, key: 'profile', userId,
      value: profile, version: profRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    }]);
    logger.info('[collect_idle] tutorial bypass user=%s +10 Plata', userId);
    return JSON.stringify({
      ok: true, plata_credited: 10, vbc_credited: 0, per_pibe: [], tutorial: true,
    });
  }

  const { results, total_plata, total_vbc } = commitAccrualForPibes(
    nk, logger, userId, filter, now, ownerRank,
  );
  profile.plata = (typeof profile.plata === 'number' ? profile.plata : 0) + total_plata;
  profile.vbc   = (typeof profile.vbc === 'number' ? profile.vbc : 0) + total_vbc;
  nk.storageWrite([{
    collection: COL_PLAYERS, key: 'profile', userId,
    value: profile, version: profRead[0].version,
    permissionRead: 2, permissionWrite: 0,
  }]);

  // Plata audit log (RESEARCH §Security #1 — T-3-WS-03 mitigation).
  logger.info('[plata] user=%s delta=%d source=collect_idle pibes=%d after=%d',
    userId, total_plata, results.length, profile.plata);
  return JSON.stringify({
    ok: true, plata_credited: total_plata, vbc_credited: total_vbc, per_pibe: results,
  });
}
