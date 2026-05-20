// RPC: assign_profession
//
// Assigns (or unassigns) a pibe to a profession. Before switching, lazily
// commits any accrual for the OLD profession (pays out Plata/VBC earned since
// last_collected_at) so the player is never robbed of idle earnings.
//
// Design decisions:
//   D-01: Lazy accrual committed before profession switch (CONTEXT §D-01).
//   D-07: hablar_cana is Líder-only — server reads rank from storage (T-3-WS-05/T-3-WS-06).
//   D-16: Facción label is read-only; no change here.
//
// Input:  { pibe_id: string, profession: string | null }
// Output: { ok: true, pibe: PibeRecord, accrued_on_switch: { plata, vbc } }
//       | { ok: false, error: string }

import { COL_PIBES, COL_PLAYERS } from '../storage_keys';
import { accrueIdleForPibe, PibeRecord } from '../laboral/idle_accrual';
import { validateProfession, isUuid } from '../util/validation';

export function rpcAssignProfession(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  let input: { pibe_id?: unknown; profession?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (!isUuid(input.pibe_id))
    return JSON.stringify({ ok: false, error: 'pibe_id_required' });
  const profCheck = validateProfession(input.profession);
  if (!profCheck.ok) return JSON.stringify({ ok: false, error: profCheck.error });

  // Read profile (Líder gate for hablar_cana — T-3-WS-05, D-07).
  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as { rank?: string; plata?: number; vbc?: number; [k: string]: unknown };
  const rank = String(profile.rank ?? 'pibe');
  if (input.profession === 'hablar_cana' && rank !== 'lider') {
    return JSON.stringify({ ok: false, error: 'lider_only' });
  }

  // Read pibe.
  const pibeRead = nk.storageRead([{ collection: COL_PIBES, key: input.pibe_id as string, userId }]);
  if (pibeRead.length === 0) return JSON.stringify({ ok: false, error: 'pibe_not_found' });
  const pibe = pibeRead[0].value as PibeRecord;

  // Lazy-commit prior accrual BEFORE switching (so the player gets paid for the time
  // already worked at the previous profession — D-01).
  const prior = accrueIdleForPibe(pibe, now, rank);
  let newPlata = typeof profile.plata === 'number' ? profile.plata : 0;
  let newVbc   = typeof profile.vbc === 'number' ? profile.vbc : 0;
  if (prior.plata_delta > 0) {
    newPlata += prior.plata_delta;
    // Bump skill on outgoing profession (commit what was earned).
    if (pibe.profession) {
      const key = pibe.profession + '_hours';
      pibe.skills[key] = (pibe.skills[key] || 0) + prior.hours_worked;
    }
  }
  if (prior.vbc_delta > 0) newVbc += prior.vbc_delta;
  pibe.last_collected_at = now;

  // Switch profession (null = rest mode).
  pibe.profession = input.profession === null ? null : String(input.profession);
  pibe.profession_started_at = pibe.profession ? now : null;

  // Atomic write: pibe + profile.
  profile.plata = newPlata;
  profile.vbc = newVbc;
  nk.storageWrite([
    {
      collection: COL_PIBES, key: pibe.id, userId,
      value: pibe as unknown as { [k: string]: unknown },
      version: pibeRead[0].version,
      permissionRead: 1, permissionWrite: 0,
    },
    {
      collection: COL_PLAYERS, key: 'profile', userId,
      value: profile, version: profRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    },
  ]);

  logger.info('[assign_profession] user=%s pibe=%s prof=%s prior_plata=%d',
    userId, pibe.id, String(pibe.profession), prior.plata_delta);
  return JSON.stringify({
    ok: true, pibe,
    accrued_on_switch: { plata: prior.plata_delta, vbc: prior.vbc_delta },
  });
}
