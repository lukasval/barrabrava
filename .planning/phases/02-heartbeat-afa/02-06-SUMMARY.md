---
plan_id: 02-06
phase: 2
status: complete
completed_at: 2026-05-18T19:08:00Z
commits:
  - "feat(02-06): player RPCs — register_fcm_token + get_current_window"
files_modified:
  - nakama/src/rpc/register_fcm_token.ts (new)
  - nakama/src/rpc/get_current_window.ts (new)
  - nakama/src/main.ts (2 imports + 2 registerRpc + logger count bump)
requirements_satisfied: [DAY-03, CMB-01]
---

# Plan 02-06 — Player RPCs

## What Built

Two authenticated player-facing RPCs that close the loop between server-side scheduling (W1 plans 02-02/03) and the client (Wave 2 Godot UI):

- **`register_fcm_token`** — device → server: register the FCM push token.
- **`get_current_window`** — server → device: "what's my club's next match window?"

Closes **Wave 1**. All Phase 2 server-side work shipped; Wave 2 is Android plugin + Godot UX.

### Files

**`rpc/register_fcm_token.ts`** — Phase 2 client tells server "here's my FCM token".
- `ctx.userId` required (auth gate).
- Validates `platform ∈ {android, ios}` and non-empty `token` string.
- Writes to `COL_FCM_TOKENS userId, key='token'` singleton (S-14: new token overwrites prior — one active device per account in Phase 2; Phase 4 revisits multi-device).
- `permissionRead/Write:0` — server-only collection, never exposed to client reads.
- Log line is `[register_fcm] user=X platform=Y` — token value **never** logged (S-4 / T-2-API-02).
- Token value is currently STORED but NOT USED for per-user push in Phase 2 (D-10). Phase 2 push is topic-only via `club_<id>`. Phase 4 (Combate) will use these tokens for personal events.

**`rpc/get_current_window.ts`** — HomeScreen calls this to render the "Ventana" banner.
- `ctx.userId` required.
- Resolution chain: `userId → COL_PLAYERS[profile] → club_id → meta:club_team_map[club_id] → mapped_team_id → COL_MATCH_WINDOWS where team_home_id == mapped_team_id OR team_away_id == mapped_team_id`.
- States in scope: `scheduled | open | live` (not `closed | cancelled`).
- Sort: scheduled windows by `opens_at`; open/live windows treated as "happening now" (sort key = `now`) so they always win.
- Adds `seconds_until_open` for the client countdown (floor((opens_at - now) / 1000), clamped to 0).
- **Lower-division clubs** (b_metro / federal_a / c_metro) have no API-Football data → no mapping in `club_team_map` → returns `{ok:true, window:null, message:"Sin partidos próximos"}`. Same response when the player's mapped team has no scheduled fixtures. Client (HomeScreen.gd) renders "Coming soon" per division.
- Error paths: `no_profile` (player never created a pibe), `no_club` (profile exists but no club_id).

**`main.ts`** — 2 imports + 2 `registerRpc` lines (direct ExpressionStatements in InitModule per Goja AST constraint from plan 02-02). Logger count: 13 → 15.

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` clean (no filters) | exits 0 |
| `npm run build` | OK |
| `grep COL_FCM_TOKENS register_fcm_token.ts` | 1 hit |
| `grep "permissionRead: 0" register_fcm_token.ts` | 1 hit |
| `grep not_authenticated register_fcm_token.ts` | 1 hit |
| `grep android register_fcm_token.ts` | 1 hit (platform validation) |
| `grep club_team_map get_current_window.ts` | 1 hit |
| `grep club_id get_current_window.ts` | 4 hits (profile read + map lookup + log lines) |
| `grep team_home_id get_current_window.ts` | 1 hit |
| `grep team_away_id get_current_window.ts` | 1 hit |
| `grep seconds_until_open get_current_window.ts` | 1 hit |
| `grep "Sin partidos próximos" get_current_window.ts` | 2 hits (no_mapping + no_window) |
| `grep register_fcm_token main.ts` | 2 hits (import + registerRpc) |
| `grep get_current_window main.ts` | 2 hits |
| `grep "15 RPCs" main.ts` | 1 hit |

## Must-Haves

- ✅ register_fcm_token: ctx.userId required, COL_FCM_TOKENS singleton per user, platform validated, token never logged.
- ✅ get_current_window: chain via profile → club_team_map → mapped team_id → match_windows filter.
- ✅ seconds_until_open computed for client countdown.
- ✅ Lower-division clubs handled (null window + "Sin partidos próximos").
- ✅ Both RPCs registered in main.ts; logger count = 15.

## Threat Disposition

| Threat ID | Disposition | Implemented? |
|-----------|-------------|--------------|
| T-2-API-02 (token in logs) | mitigate | ✅ logger only emits user+platform |
| T-2-RT-09 (unauthed get_window) | mitigate | ✅ throw on missing ctx.userId |
| T-2-RT-10 (cross-user window leak) | accept | ✅ COL_MATCH_WINDOWS permissionRead:2 (public) by design — all windows are public AFA schedule; per-club filtering is convenience, not authorization |

## Deviations

- Plan suggested logger count of "13 or 14". Actual count: **15** (5 Phase 1 + 1 plan 02-03 + 7 admin from plan 02-05 + 2 player RPCs from this plan).
- Plan said registrations may live inside `registerSchedulerHooks`-style helpers; rewrote to inline because of Goja AST constraint discovered in plan 02-02 (extractHookFn / extractRPC walk only direct ExpressionStatements in InitModule).
- Plan used `: any` in a few places; tightened to `Record<string, unknown>` / inline shape types to keep typecheck strict.

## Risks Carried Forward

- Cross-window scan in `get_current_window` is O(N windows). Acceptable at Phase 2 scale (~100s of windows over a season). Phase 6+ may need a per-club index collection.
- `admin_set_club_team_mapping` (plan 02-05) is the only path to fix bad fuzzy matches. Until manually exercised, some clubs may surface as "Sin partidos próximos" even when their team plays — verify via `admin_list_windows` + cross-check `meta:unmatched_clubs`.

## Next

Wave 1 closes. **Wave 2** = plan 02-07 (Android FCM plugin — Java/Gradle, requires user work to set up Firebase Android SDK + signed APK build) + plan 02-08 (Godot push UX). Wave 3 = plan 02-09 validation harness.
