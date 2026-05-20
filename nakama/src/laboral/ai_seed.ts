// nakama/src/laboral/ai_seed.ts
//
// Idempotent boot-time seed of barra_state for every club (D-14, D-15).
//
// Called from InitModule after seedClubs. Re-running InitModule (e.g. on Railway
// redeploy) is safe: the COL_META[KEY_AI_SEED_VERSION] marker gates skipping.
//
// barra_state/{club_id} shape (RESEARCH §Storage Schema "Collection: barra_state"):
//   club_id, aguante_pool, aguante_pool_last_tick_at,
//   mesa_chica (5 AI entries sorted by reputacion DESC),
//   lider (single AI entry, reputacion > mesa_chica[0].reputacion),
//   barra_age_days, ai_seeded_at, mesa_recompute_pending, mesa_recompute_last_at,
//   lider_vbc_balance, lider_vbc_last_tick_at
//
// AI ids: ai_{club_id}_{slot} (D-14 — prefix ensures no collision with player UUIDs).
// AI display names: canned label "Capo de la Barra #N" rendered only at UI layer (03.04).
//   This seeder stores no display_name string on the server — null until UI assigns.
//   (T-3-AS-04 mitigation: no real names, no LLM-generated names.)

import {
  COL_BARRA_STATE, COL_CLUBS, COL_META,
  KEY_AI_SEED_VERSION, SYSTEM_USER_ID,
} from '../storage_keys';
import { aiBaselineRep } from './ai_baseline';

const SEED_VERSION = 'v1';

export function seedAiBaseline(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  try {
    const existing = nk.storageRead([{
      collection: COL_META, key: KEY_AI_SEED_VERSION, userId: SYSTEM_USER_ID,
    }]);
    if (existing.length > 0 && (existing[0].value as { version?: string }).version === SEED_VERSION) {
      logger.info('AI baseline already seeded (version=%s); skipping', SEED_VERSION);
      return;
    }
  } catch (e) { /* first run — fall through */ }

  const now = Date.now();
  let cursor = '';
  let clubCount = 0;
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_CLUBS, 100, cursor);
    for (const obj of page.objects || []) {
      const clubId = obj.key;
      const club = obj.value as { division_rank?: number };
      const divisionRank = club.division_rank ?? 3;
      const ageDays = 0;
      const slots = [1, 2, 3, 4, 5];
      const mesa = slots.map((slot) => ({
        kind: 'ai' as const,
        ai_id: 'ai_' + clubId + '_' + slot,
        reputacion: aiBaselineRep(slot, ageDays, divisionRank),
      })).sort((a, b) => b.reputacion - a.reputacion);
      const lider = {
        kind: 'ai' as const,
        ai_id: 'ai_' + clubId + '_lider',
        display_name: null as string | null,
        reputacion: Math.floor(mesa[0].reputacion * 1.2),
        elected_at: now,
        season_id: 0,
      };
      nk.storageWrite([{
        collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
        value: {
          club_id: clubId,
          aguante_pool: 0,
          aguante_pool_last_tick_at: now,
          mesa_chica: mesa,
          lider,
          barra_age_days: 0,
          ai_seeded_at: now,
          mesa_recompute_pending: false,
          mesa_recompute_last_at: now,
          lider_vbc_balance: 0,
          lider_vbc_last_tick_at: now,
        },
        permissionRead: 2,
        permissionWrite: 0,
      }]);
      clubCount++;
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  nk.storageWrite([{
    collection: COL_META, key: KEY_AI_SEED_VERSION, userId: SYSTEM_USER_ID,
    value: { seeded: true, version: SEED_VERSION, count: clubCount, at: now },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('AI baseline seeded for %d clubs (version=%s)', clubCount, SEED_VERSION);
}
