// nakama/src/rpc/get_recruit_pool.ts
//
// Player RPC: returns today's recruit pool picks for the caller's club.
//
// CRITICAL D-10 anti-cheat: the server MUST NEVER return the trait_2_hidden STRING value.
// The RPC replaces { trait_2_hidden: "buchon" } with { trait_2_hidden: true } (boolean).
// The actual trait value is revealed only when the player recruits (plan 03.03 recruit_pibe).
//
// T-3-RS-03: get_recruit_pool trait_2 redaction verified by invariant LAB-RECRUIT-TRAIT-REDACT.
//
// If no pool has been generated yet (cron hasn't run for this club today), returns
// picks: [] so the client can show "Esperá a las 05:00." empty state (UI-SPEC §5.3).

import {
  COL_PLAYERS, COL_RECRUIT_POOL, SYSTEM_USER_ID,
} from '../storage_keys';

export function rpcGetRecruitPool(
  ctx: nkruntime.Context, _logger: nkruntime.Logger,
  nk: nkruntime.Nakama, _payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');

  // Get club_id from server-side profile (T-3-RS-09 pattern: never trust client claims).
  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const clubId = String((profRead[0].value as { club_id?: string }).club_id ?? '');
  if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });

  const poolRead = nk.storageRead([{
    collection: COL_RECRUIT_POOL, key: clubId, userId: SYSTEM_USER_ID,
  }]);

  // Pool not yet generated for this club today → empty state.
  if (poolRead.length === 0) {
    return JSON.stringify({ ok: true, picks: [], expires_at: null, generated_at: null });
  }

  const pool = poolRead[0].value as {
    generated_at?:       number;
    expires_at?:         number;
    generated_date_art?: string;
    picks?: Array<{
      pick_id:         string;
      name:            string;
      rol:             string;
      trait_1:         string;
      trait_2_hidden:  string;  // string server-side; redacted to boolean below
      avatar:          any;
      stats_preview:   any;
    }>;
  };

  // ── D-10 CRITICAL: redact trait_2_hidden value before serializing ───────────
  // Replace string value with boolean true. Client UI shows "?" icon.
  // Actual value revealed only on recruit (plan 03.03 recruit_pibe).
  const safePicks = (pool.picks ?? []).map((p) => ({
    pick_id:        p.pick_id,
    name:           p.name,
    rol:            p.rol,
    trait_1:        p.trait_1,
    trait_2_hidden: true,          // BOOLEAN — NEVER the string value (T-3-RS-03)
    avatar:         p.avatar,
    stats_preview:  p.stats_preview,
  }));

  return JSON.stringify({
    ok:                  true,
    picks:               safePicks,
    expires_at:          pool.expires_at ?? null,
    generated_at:        pool.generated_at ?? null,
    generated_date_art:  pool.generated_date_art ?? null,
  });
}
