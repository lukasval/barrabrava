---
phase: 2
slug: heartbeat-afa
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `02-RESEARCH.md §"Validation Architecture"`. Phase 2 reuses Phase 1's bash + curl + jq smoke pattern (no Jest/pytest infra in repo).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash + curl + jq (extends Phase 1 `nakama/smoke-test.sh`) |
| **Config file** | `nakama/smoke-test.sh` (Phase 1) + NEW `nakama/test/heartbeat-test.sh` (Phase 2) |
| **Quick run command** | `npm --prefix nakama run typecheck` |
| **Full suite command** | `bash nakama/test/heartbeat-test.sh` (against deployed Railway) |
| **Estimated runtime** | ~45 s typecheck + ~120 s smoke (depends on Railway latency) |

**Rationale for not introducing Jest:** Heroic Labs ships `heroiclabs/typescript-testing` for unit tests but introducing the mock-Nakama harness is itself a multi-task Wave 0 cost that delays real Phase 2 work. E2E smoke against deployed instance suffices at Phase 2 scope. Jest infra deferred to Phase 4+ when combat resolution determinism warrants fixtures.

---

## Sampling Rate

- **After every task commit:** `npm --prefix nakama run typecheck` (local, fast, no API quota burn).
- **After every wave merge:** `bash nakama/test/heartbeat-test.sh` against Railway (post-deploy).
- **Before `/gsd-verify-work`:** Full extended `heartbeat-test.sh` covering all 17 invariants. Synthetic fixture injection (`admin_inject_test_fixture`, gated `ADMIN_TEST_MODE=true`) used for state-machine tests where waiting for real kickoffs is impractical.
- **Max feedback latency:** ~150 s (typecheck + smoke).

---

## Per-Task Verification Map

> Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 📝 manual

| Task ID | Req | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|-----|------------|-----------------|-----------|-------------------|--------|
| 02-01-CLB03-leagues | CLB-03 | — | After Wave 0 deploy, `meta:api_football_league_ids` stored with discovered Primera + Nacional IDs | smoke | `curl -s "$NK/v2/console/storage/meta" --user admin: \| jq '.objects[]\|select(.key=="api_football_league_ids")'` | ⬜ |
| 02-01-CLB03-fixtures | CLB-03 | — | After first tick, `fixtures` collection has ≥1 record with `status` ∈ valid set | smoke | `bash heartbeat-test.sh test_fixtures_seeded` | ⬜ |
| 02-01-CLB05-fallback | CLB-05 | T-2-API-01 | When `API_FOOTBALL_KEY` unset, tick logs `API_FOOTBALL_KEY missing` AND `meta:scheduler_state.last_fetched_at` unchanged | 📝 manual logs | Railway log grep after intentional unset | ⬜ |
| 02-01-CLB05-ttl | CLB-05 | — | Stale `fetched_at` (>30 min) replaced on next successful poll | smoke | inspect `fetched_at` across two ticks | ⬜ |
| 02-02-SEA01-active | SEA-01 | — | When first fixture of new season enters <7d, `meta:current_season.status == "active"` | smoke | inspect `meta:current_season` after `opens_at - 7d` passes | ⬜ |
| 02-02-SEA02-end | SEA-02 | — | 7 days post-last-fixture → `status == "ended"` | smoke (long) | inspect after 7d OR force via `admin_set_season_window` | ⬜ |
| 02-03-CMB01-math | CMB-01 | — | Window record `opens_at == kickoff - 2h` exactly | unit-smoke | `admin_list_windows` → assert math | ⬜ |
| 02-03-CMB01-live | CMB-01 | — | At kickoff, state == `"live"` within 16 min (15-min tick window) | smoke (timed) | wait for known fixture, inspect after tick | ⬜ |
| 02-04-DAY03-once | DAY-03 | T-2-FCM-01 | Single push per window-open transition (idempotent re-eval) | smoke (logs) | force 2 consecutive ticks via `admin_force_repoll`; assert exactly 1 `[fcm] sent to topic=` log per window | ⬜ |
| 02-04-DAY03-topic | DAY-03 | T-2-FCM-02 | FCM topic name passes `[a-zA-Z0-9_.~%-]+` regex; invalid club_id never sent | unit-smoke | unit-style assertion in `validateTopicName` helper | ⬜ |
| 02-05-Resend-A | CLB-1-PWR | T-1-RT-08 | `RESEND_ENABLED=false`: `request_password_reset` logs link, persists token, returns `{ok:true}` uniform | smoke | curl RPC → `nk.storageRead` token → grep logs | ⬜ |
| 02-05-Resend-B | CLB-1-PWR | T-2-PWR-01 | `confirm_password_reset` with valid token: mutates password + consumes token (replay rejected) | smoke | curl confirm → authenticate w/ new password (200) → re-confirm same token (`token_already_used`) | ⬜ |
| 02-05-Resend-C | CLB-1-PWR | T-2-PWR-02 | Expired token rejected (`token_expired`) | smoke | force `expires_at < now` via admin SQL → attempt confirm | ⬜ |
| 02-06-Admin-A | CLB-04 | T-2-ADM-01 | Admin RPC without bearer → `{ok:false, error:"unauthorized"}` | smoke | curl without header | ⬜ |
| 02-06-Admin-B | CLB-04 | T-2-ADM-01 | Admin RPC with wrong bearer → `{ok:false, error:"unauthorized"}` | smoke | curl `Authorization: Bearer wrong` | ⬜ |
| 02-06-Admin-C | CLB-04 | T-2-ADM-02 | Admin RPC with correct bearer + valid input → mutation persisted + `admin_actions` audit row written | smoke | curl + inspect both `match_windows` and `admin_actions` | ⬜ |
| 02-07-Tick-lock | CLB-03 | T-2-RACE-01 | Tick lock prevents overlap; second concurrent tick logs `previous tick still active; skipping` | 📝 manual logs | trigger 2× `admin_force_repoll` back-to-back | ⬜ |

*Threat refs trace to the `<threat_model>` block each PLAN.md must include (per Security Threat Model Gate, ASVS L1).*

---

## Wave 0 Requirements

- [ ] `nakama/test/heartbeat-test.sh` — new script with 17 test cases.
- [ ] `nakama/test/admin-curl-examples.md` — companion doc with copy-pasteable curl invocations for each admin RPC + each test case.
- [ ] `admin_inject_test_fixture(fixture_id, kickoff_utc_iso, home, away)` RPC — gated behind `ADMIN_TEST_MODE=true`, unblocks deterministic state-machine testing.
- [ ] `meta:api_football_league_ids` discovery RPC OR boot-time call to `/leagues?country=Argentina&current=true` to resolve LOW-confidence league ID question from research.
- [ ] Framework install: **none — bash + curl + jq present from Phase 1 INFRA-NOTES**.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fallback log emission when `API_FOOTBALL_KEY` unset | CLB-05 | Requires unsetting env var + redeploy on Railway (destructive to dev infra) | Stage in dev workspace only; grep `API_FOOTBALL_KEY missing` in Railway logs; restore key |
| Tick lock under real concurrent load | CLB-03 | Race window <100ms — automated test would be flaky | Two terminals firing `admin_force_repoll` within 1s; inspect logs for `tick_in_progress` |
| Real push delivery to Android device | DAY-03 | Cannot mock FCM end-to-end; requires real device + Google account | Build dev APK → install → register token → trigger fake fixture → confirm push received on device |
| Resend domain verification gates `RESEND_ENABLED=true` | CLB-1-PWR | Resend external system; only validates when dev buys domain (Phase 6/7) | Defer to Phase 6/7 prelaunch checklist in INFRA-NOTES |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify OR are explicitly marked manual with reason
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (17 invariants × 13 automated = 76% automated coverage)
- [x] Wave 0 covers all MISSING references (5 Wave-0 items above)
- [x] No watch-mode flags (typecheck is one-shot)
- [x] Feedback latency <150s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (auto-promotes to `approved 2026-05-17` once Wave 0 commits land).

---

*Derived from `02-RESEARCH.md` §"Validation Architecture" lines 1442-1490 + §"Pitfalls & Mitigations" lines 1494-1593.*
*Threat refs to be locked once planner emits `<threat_model>` blocks per PLAN.md (Security ASVS L1 gate enabled per `.planning/config.json`).*
