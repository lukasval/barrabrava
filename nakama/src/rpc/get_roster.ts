// nakama/src/rpc/get_roster.ts
//
// Player RPC: returns the caller's pibes with:
//   - projected (read-only) idle accrual (projected_plata, projected_vbc, projected_hours)
//   - persisted energia regen (written back if changed — energy is not a currency)
//   - Phase 1 single-pibe migration on first call post-Phase-3 deploy (idempotent)
//
// Design decisions:
//   D-01: accrueIdleForPibe is PROJECTION ONLY — last_collected_at / skills.*_hours
//         are NEVER written here. Only collect_idle (plan 03.03) commits those.
//   D-04: energia regen IS persisted here (via optimistic concurrency write-back).
//   T-3-RS-02: read+collect race — get_roster projects, collect_idle commits. The two
//              callers cannot double-credit because only collect_idle writes accrual state.
//   T-3-RS-05: migration race — profile marker pibes_migrated_at written FIRST with
//              version-based optimistic concurrency. Second concurrent caller sees conflict,
//              re-reads and finds marker already set → skips migration.

import {
  COL_AGUANTADEROS, COL_PIBES, COL_PLAYERS,
  KEY_AGUANTADERO_MAIN, KEY_PIBE_MAIN,
} from '../storage_keys';
import { accrueIdleForPibe, regenEnergia, PibeRecord } from '../laboral/idle_accrual';

// Roster caps by aguantadero level (D-12 + PIB-01).
const ROSTER_CAP_BY_LEVEL: { [lvl: number]: number } = {
  1: 5, 2: 8, 3: 12, 4: 16, 5: 20,
};

export function rpcGetRoster(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, _payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  // ── 1. Read profile (rank, migration guard) ───────────────────────────────
  const profRead = nk.storageRead([{
    collection: COL_PLAYERS, key: 'profile', userId,
  }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as {
    rank?: string;
    reputacion?: number;
    pibes_migrated_at?: number | null;
    club_id?: string;
    [k: string]: unknown;
  };
  const ownerRank = String(profile.rank ?? 'pibe');

  // ── 2. Lazy migration: pibes/main → pibes/{uuid} (idempotent, ONCE per user) ──
  // RESEARCH Pitfall 7: write profile marker FIRST (optimistic concurrency) before
  // writing the new pibe key, to prevent a concurrent call from duplicating it.
  if (!profile.pibes_migrated_at) {
    try {
      const legacy = nk.storageRead([{ collection: COL_PIBES, key: KEY_PIBE_MAIN, userId }]);
      if (legacy.length > 0) {
        const legacyValue = legacy[0].value as any;
        const newId = (legacyValue && typeof legacyValue.id === 'string')
          ? legacyValue.id : nk.uuidv4();
        // Upgrade shape with Phase 3 fields if missing.
        const migrated: PibeRecord = {
          id:      newId,
          name:    String(legacyValue?.name ?? 'Pibe'),
          club_id: String(legacyValue?.club_id ?? profile.club_id ?? ''),
          rol:     String(legacyValue?.rol ?? 'aguantador'),
          trait_1: String(legacyValue?.trait_1 ?? 'aguantador'),
          trait_2: String(legacyValue?.trait_2 ?? 'pichon'),
          avatar:  legacyValue?.avatar ?? { pelo: 'corto', remera: 'tricolor_1', accesorio: 'ninguno' },
          stats:   legacyValue?.stats ?? { aguante: 50, velocidad: 50, astucia: 50, carisma: 50 },
          energia: typeof legacyValue?.energia === 'number' ? legacyValue.energia : 100,
          energia_last_tick_at: typeof legacyValue?.energia_last_tick_at === 'number'
            ? legacyValue.energia_last_tick_at : now,
          profession:           legacyValue?.profession ?? null,
          profession_started_at: legacyValue?.profession_started_at ?? null,
          last_collected_at:    legacyValue?.last_collected_at ?? null,
          skills:  legacyValue?.skills ?? {
            trapito_hours: 0, vendedor_hours: 0, patovica_hours: 0,
            remisero_hours: 0, hablar_cana_hours: 0,
          },
          en_turno_until: legacyValue?.en_turno_until ?? null,
          created_at: typeof legacyValue?.created_at === 'number' ? legacyValue.created_at : now,
        };
        // Write profile marker FIRST (anti-race, RESEARCH Pitfall 7).
        const profCopy = { ...profile, pibes_migrated_at: now };
        nk.storageWrite([{
          collection: COL_PLAYERS, key: 'profile', userId,
          value: profCopy, version: profRead[0].version,
          permissionRead: 2, permissionWrite: 0,
        }]);
        // Then write new pibe key.
        nk.storageWrite([{
          collection: COL_PIBES, key: newId, userId,
          value: migrated as unknown as { [k: string]: unknown },
          permissionRead: 1, permissionWrite: 0,
        }]);
        // Delete legacy key (tolerate failure — idempotent; storageList skips 'main' next time).
        try { nk.storageDelete([{ collection: COL_PIBES, key: KEY_PIBE_MAIN, userId }]); }
        catch (e) { /* tolerate */ }
        profile.pibes_migrated_at = now;
        logger.info('[get_roster] migrated legacy pibe user=%s new_id=%s', userId, newId);
      } else {
        // No legacy pibe: stamp marker anyway to skip future migration attempts.
        const profCopy = { ...profile, pibes_migrated_at: now };
        try {
          nk.storageWrite([{
            collection: COL_PLAYERS, key: 'profile', userId,
            value: profCopy, version: profRead[0].version,
            permissionRead: 2, permissionWrite: 0,
          }]);
          profile.pibes_migrated_at = now;
        } catch (e) { /* concurrent — second call will see marker already set */ }
      }
    } catch (e) {
      logger.warn('[get_roster] migration error user=%s err=%s', userId, String((e as Error).message));
    }
  }

  // ── 3. List all pibes for this user (max 20 by D-12 cap; 1 page of 100 is ample) ─
  const pibes: PibeRecord[] = [];
  const versionByKey: { [k: string]: string } = {};
  let cursor = '';
  for (let pg = 0; pg < 5; pg++) {
    const page = nk.storageList(userId, COL_PIBES, 100, cursor);
    for (const obj of page.objects || []) {
      pibes.push(obj.value as PibeRecord);
      versionByKey[obj.key] = obj.version;
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  // ── 4. Projected accrual (READ-ONLY) + persisted energia regen ──────────────
  // CRITICAL: projected_plata / projected_vbc / projected_hours are display-only.
  // last_collected_at + skills.*_hours are NEVER written here (T-3-RS-02 mitigation).
  const energyWrites: nkruntime.StorageWriteRequest[] = [];
  const views = pibes.map((p) => {
    const projected = accrueIdleForPibe(p, now, ownerRank);
    const newEnergia = regenEnergia(p, now);
    // Persist energy regen if it changed (write-back with version for concurrency safety).
    if (newEnergia !== p.energia) {
      const updated = { ...p, energia: newEnergia, energia_last_tick_at: now };
      energyWrites.push({
        collection: COL_PIBES, key: p.id, userId,
        value: updated as unknown as { [k: string]: unknown },
        version: versionByKey[p.id],
        permissionRead: 1, permissionWrite: 0,
      });
      p.energia = newEnergia;
      p.energia_last_tick_at = now;
    }
    return {
      id:                    p.id,
      name:                  p.name,
      club_id:               p.club_id,
      rol:                   p.rol,
      trait_1:               p.trait_1,
      trait_2:               p.trait_2,
      avatar:                p.avatar,
      stats:                 p.stats,
      energia:               p.energia,
      profession:            p.profession,
      profession_started_at: p.profession_started_at,
      last_collected_at:     p.last_collected_at,
      skills:                p.skills,
      en_turno_until:        p.en_turno_until,
      // Projected (display only — never committed here):
      projected_plata:  projected.plata_delta,
      projected_vbc:    projected.vbc_delta,
      projected_hours:  projected.hours_worked,
    };
  });

  if (energyWrites.length > 0) {
    try { nk.storageWrite(energyWrites); }
    catch (e) {
      // Concurrent update — tolerate; energia will be recomputed on next call.
      logger.warn('[get_roster] energy write conflict user=%s', userId);
    }
  }

  // ── 5. Roster cap from aguantadero level (default 5 if no aguantadero yet) ──
  const aguRead = nk.storageRead([{
    collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
  }]);
  const level = aguRead.length > 0
    ? Number((aguRead[0].value as any).level ?? 1) : 1;
  const rosterCap = ROSTER_CAP_BY_LEVEL[level] ?? 5;

  logger.info('[get_roster] user=%s pibes=%d cap=%d rank=%s',
    userId, pibes.length, rosterCap, ownerRank);

  return JSON.stringify({
    ok:          true,
    pibes:       views,
    pibes_count: pibes.length,
    roster_cap:  rosterCap,
    rank:        ownerRank,
  });
}
