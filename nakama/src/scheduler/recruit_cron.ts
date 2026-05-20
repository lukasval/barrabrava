// nakama/src/scheduler/recruit_cron.ts
//
// Daily recruit pool refresh — runs at 05:00 ART (UTC 08:00) via bb_recruit_05_art cron.
// For each club: generates 3 procedural pibe picks via pibe_factory.generatePick
// and writes them to COL_RECRUIT_POOL/{club_id}.
//
// Design decisions:
//   D-09: Pool refresh at 05:00 ART; 3 picks per club per day.
//   D-11: generatePick produces deterministic infinite procedural pibes.
//   T-3-WS-10: Distributed lock on KEY_RECRUIT_LOCK (5min TTL) prevents overlapping runs.
//              Epoch UUID enables safe lock release in finally block (tick.ts pattern).
//
// Idempotency: generated_date_art short-circuit — if today's pool already exists, skip.
// Admin override: admin_force_recruit_refresh passes forClubId to bypass date check (single club).

import {
  COL_CLUBS, COL_META, COL_RECRUIT_POOL,
  KEY_RECRUIT_LOCK, SYSTEM_USER_ID,
} from '../storage_keys';
import { generatePick, PickValue } from '../laboral/pibe_factory';

const RECRUIT_LOCK_TTL_MS = 5 * 60 * 1000;

// RESEARCH A9: Argentina does not observe DST since 2009 (ART = UTC-3 year-round).
function todayInArt(now: number): string {
  const artMs = now - 3 * 3600 * 1000;
  return new Date(artMs).toISOString().slice(0, 10);
}

// Exported for admin_force_recruit_refresh + plan 03.05 tests.
export function generatePool(
  nk: nkruntime.Nakama, clubId: string, todayArt: string,
): {
  club_id: string; generated_at: number; generated_date_art: string;
  expires_at: number; picks: PickValue[];
} {
  const now = Date.now();
  const picks: PickValue[] = [];
  for (let i = 0; i < 3; i++) picks.push(generatePick(nk, clubId));
  return {
    club_id: clubId,
    generated_at: now,
    generated_date_art: todayArt,
    expires_at: now + 25 * 3600 * 1000,  // 25h window (covers DST drift even though AR has none)
    picks,
  };
}

// runRecruitRefresh — exported for leaderboard_cron dispatcher and admin_force_recruit_refresh.
// forClubId: if provided, only refresh that one club (admin override; bypasses date short-circuit).
export function runRecruitRefresh(
  _ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama,
  forClubId?: string,
): void {
  const now = Date.now();
  const todayArt = todayInArt(now);

  // 1. Acquire distributed lock (tick.ts pattern — T-3-WS-10).
  const lockRead = nk.storageRead([{
    collection: COL_META, key: KEY_RECRUIT_LOCK, userId: SYSTEM_USER_ID,
  }]);
  if (lockRead.length > 0) {
    const lock = lockRead[0].value as { acquired_at?: number };
    if ((lock.acquired_at ?? 0) + RECRUIT_LOCK_TTL_MS > now) {
      logger.info('[recruit_cron] lock active; skipping');
      return;
    }
    logger.warn('[recruit_cron] stale lock; proceeding');
  }
  const epoch = nk.uuidv4();
  nk.storageWrite([{
    collection: COL_META, key: KEY_RECRUIT_LOCK, userId: SYSTEM_USER_ID,
    value: { acquired_at: now, epoch },
    permissionRead: 0, permissionWrite: 0,
  }]);

  try {
    // 2. Walk COL_CLUBS (or one specific club if forClubId given).
    const targetIds: string[] = [];
    if (forClubId) {
      targetIds.push(forClubId);
    } else {
      let cursor = '';
      for (let pg = 0; pg < 50; pg++) {
        const page = nk.storageList(SYSTEM_USER_ID, COL_CLUBS, 100, cursor);
        for (const obj of page.objects || []) targetIds.push(obj.key);
        if (!page.cursor) break;
        cursor = page.cursor;
      }
    }
    let regenerated = 0;
    let skipped = 0;
    for (const clubId of targetIds) {
      // 3. Idempotency: skip if already refreshed today for this club.
      //    Admin forClubId call bypasses this (regeneration forced).
      if (!forClubId) {
        const ex = nk.storageRead([{
          collection: COL_RECRUIT_POOL, key: clubId, userId: SYSTEM_USER_ID,
        }]);
        if (ex.length > 0 &&
            (ex[0].value as { generated_date_art?: string }).generated_date_art === todayArt) {
          skipped++;
          continue;
        }
      }
      const pool = generatePool(nk, clubId, todayArt);
      nk.storageWrite([{
        collection: COL_RECRUIT_POOL, key: clubId, userId: SYSTEM_USER_ID,
        value: pool as unknown as { [k: string]: unknown },
        // version: '*' OK for full replace — cron is the canonical writer for pool refresh.
        permissionRead: 2, permissionWrite: 0,
      }]);
      regenerated++;
    }
    logger.info('[recruit_cron] today=%s regenerated=%d skipped=%d targets=%d',
      todayArt, regenerated, skipped, targetIds.length);
  } finally {
    // 4. Release lock only if still ours (epoch match).
    const finalRead = nk.storageRead([{
      collection: COL_META, key: KEY_RECRUIT_LOCK, userId: SYSTEM_USER_ID,
    }]);
    if (finalRead.length > 0 &&
        (finalRead[0].value as { epoch?: string }).epoch === epoch) {
      try {
        nk.storageDelete([{
          collection: COL_META, key: KEY_RECRUIT_LOCK, userId: SYSTEM_USER_ID,
        }]);
      } catch (e) { /* tolerate — lock will expire via TTL */ }
    }
  }
}
