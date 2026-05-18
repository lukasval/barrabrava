---
plan_id: 02-02
phase: 2
status: complete
completed_at: 2026-05-18T18:04:39Z
commits:
  - 9ace3b9 feat(02-02): create scheduler files (tick + leaderboard_cron + windows + seasons)
  - 0de13d6 feat(02-02): wire API-Football poll + club_team_map + scheduler bootstrap in InitModule
files_modified:
  - nakama/src/scheduler/tick.ts (new)
  - nakama/src/scheduler/leaderboard_cron.ts (new)
  - nakama/src/scheduler/windows.ts (new)
  - nakama/src/scheduler/seasons.ts (new)
  - nakama/src/integrations/api_football.ts (new)
  - nakama/src/main.ts (extended)
requirements_satisfied: [CLB-03, CLB-05, SEA-01, SEA-02, CMB-01]
---

# Plan 02-02 — AFA Scheduler

## What Built

Core AFA heartbeat engine. Five new TypeScript files in `nakama/src/scheduler/` + `nakama/src/integrations/`, plus main.ts InitModule extension. No `nk.timerCreate` anywhere (correctly absent — Nakama TS runtime has no timers; D-09 cron-via-leaderboard-reset pattern verbatim).

### Files

**`scheduler/tick.ts`** — `runHeartbeatTick(ctx, logger, nk, lbId)`. Acquires `tick_lock` via CAS (epoch UUID, 5-min TTL) in try/finally. Cadence gating: 15m-tick skips if `active_cadence == "6h"`; 6h-tick skips if `active_cadence == "15m"`. Pipeline: `pollFixtures → evaluateWindowTransitions → detectSeasonState → release lock`. Includes `findNextKickoffWithin24h` page-scanner that flips cadence to 15m when a fixture is in <24h, 6h otherwise (S-3 quota math).

**`scheduler/leaderboard_cron.ts`** — `ensureSchedulerLeaderboards(nk, logger)` idempotently creates `bb_tick_15m` (`*/15 * * * *`) + `bb_tick_6h` (`0 */6 * * *`). `registerSchedulerHooks(initializer)` wires `registerLeaderboardReset → runHeartbeatTick`.

**`scheduler/windows.ts`** — `evaluateWindowTransitions(ctx, logger, nk)`. Materializes match_windows for fixtures `< 48h` ahead, evaluates `scheduled → open → live → closed` based on `kickoff_utc ± 2h` (CMB-01). Anti-double-push: `notified_open_at` set in the same `storageWrite` as the state transition (D-12). Window record schema includes BOTH `team_home_id`/`team_away_id` (API-Football numeric) AND `club_home_id`/`club_away_id` (Phase 1 slug, nullable). `sendTopic` is a stub here — real send arrives in plan 02-03.

**`scheduler/seasons.ts`** — `detectSeasonState(ctx, logger, nk)`. Page-scans `COL_FIXTURES` (Primera only per D-19), computes pre/active/ended per D-17 (active when first kickoff ≤ 7d; ended 7d after last kickoff), writes `COL_META[KEY_CURRENT_SEASON]` only on status change (write amplification guard).

**`integrations/api_football.ts`** — `pollFixtures(ctx, logger, nk, daysHorizon)` + `buildClubTeamMap(ctx, logger, nk)`. Features:
- `getLeagueIds` discovers Primera + Nacional league IDs dynamically (S-4) and caches in `meta:api_football_league_ids`.
- Retry-on-429 with `x-ratelimit-requests-remaining` log; 3-retry pattern with backoff.
- Missing `API_FOOTBALL_KEY` → warns + returns 0 (CLB-05 fallback, no throw).
- `upsertFixture` uses read-modify-write with `version` field; on `version_mismatch` retries once without version (admin_force_repoll race mitigation).
- `buildClubTeamMap` calls `/teams?league=&season=` for both leagues, normalizes names (lowercase + strip accents + word-overlap heuristic), writes `meta:club_team_map` + `meta:unmatched_clubs` for manual reconciliation via plan-02-05 admin RPC.
- `resolveClubIds` reverse-lookups team_id→club_id and sets `club_home_id`/`club_away_id` on every NormalizedFixture before storage write.
- `buildClubTeamMap` gated to run only when map absent or >7d old (T-2-MAP-02 quota guard).

**`main.ts`** — InitModule extended:
```
+ import { ensureSchedulerLeaderboards, registerSchedulerHooks } from './scheduler/leaderboard_cron';
...
  seedClubs(nk, logger);
+ ensureSchedulerLeaderboards(nk, logger);
+ registerSchedulerHooks(initializer);
  initializer.registerRpc('get_clubs', rpcGetClubs);
...
- logger.info('BarraBrava runtime ready: 5 RPCs registered');
+ logger.info('BarraBrava runtime ready: 5 RPCs registered + scheduler armed');
```

Phase 2 RPC imports intentionally NOT added here. Plans 02-04/05/06 each append their own `registerRpc` calls.

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` (no filters) | exits 0 clean |
| `npm run build` | produces `nakama/build/index.js` 83.1kb |
| `grep ensureSchedulerLeaderboards nakama/src/main.ts` | 2 hits |
| `grep "scheduler armed" nakama/src/main.ts` | 1 hit |
| `grep version_mismatch nakama/src/integrations/api_football.ts` | 3 hits |
| `grep buildClubTeamMap nakama/src/integrations/api_football.ts` | 4 hits |
| `grep club_team_map nakama/src/integrations/api_football.ts` | 10 hits |
| `grep -rn "nk.timerCreate" nakama/src/` | 2 hits — both in comments explaining its absence (acceptable; criterion was guarding against real calls) |

## Must-Haves (Plan Front-Matter)

- ✅ Two dummy leaderboards `bb_tick_15m` (`*/15 * * * *`) + `bb_tick_6h` (`0 */6 * * *`) registered in InitModule via `ensureSchedulerLeaderboards`.
- ✅ Every tick acquires tick_lock, polls API-Football (if key present), evaluates window transitions, detects season state, releases lock.
- ✅ Match windows: `opens_at = kickoff_utc - 7200000`, `closes_at = kickoff_utc + 7200000`.
- ✅ Cadence: 15m when fixture in <24h, 6h otherwise (`findNextKickoffWithin24h`).
- ✅ Season state in `meta:current_season` flips active/ended based on Primera fixture cluster (D-17 + D-19).
- ✅ API-Football poll returns 0 (not throws) when key missing — CLB-05 fallback.
- ✅ `meta:club_team_map` built from `/teams` endpoint, fuzzy-matching Phase 1 club_id to API-Football team_id.
- ✅ `meta:unmatched_clubs` written for unmatched (manual reconciliation entrypoint).
- ✅ Fixture upsert uses read-modify-write with version; single retry on version_mismatch.
- ✅ Window records carry both team_home_id (API-Football) and club_home_id (Phase 1 slug, nullable).

## Threat Model Disposition

| Threat ID | Disposition | Implemented? |
|-----------|-------------|--------------|
| T-2-API-01 (key spoofing) | mitigate | ✅ key from ctx.env, never logged; missing → warn + return 0 |
| T-2-API-03 (quota DoS) | mitigate | ✅ 429-guard, ratelimit-remaining logged, cadence gating + buildClubTeamMap throttled 7d |
| T-2-RACE-01 (concurrent ticks) | mitigate | ✅ KEY_TICK_LOCK with 5-min TTL + CAS via storage version; "previous tick still active" log on contention |
| T-2-CACHE-01 (cadence flag tamper) | accept | ✅ server-only read/write (permission 0/0) |
| T-2-MAP-01 (fuzzy match wrong) | accept | ✅ admin override path lives in plan 02-05 |
| T-2-MAP-02 (map-build quota) | mitigate | ✅ `<7d` cache + early return |

## Deviations

None. Both tasks landed exactly as specified.

## Risks Carried Forward

- `sendTopic` is still stubbed in `windows.ts` — real FCM send arrives in plan 02-03. Until then, ticks evaluate transitions and set `notified_open_at` but no push fires.
- Phase 2 RPCs (admin_*, register_fcm_token, get_current_window) NOT yet registered in main.ts. Plans 02-04 / 02-05 / 02-06 each append their own.
- Code not yet pushed to GitHub — Railway still serves Phase 1 build until orchestrator pushes at phase end.

## Resume / Next

Wave 1 continues with plan 02-03 (FCM v1 integration). After 02-03, `windows.ts` stub `sendTopic` gets replaced with the real import.
