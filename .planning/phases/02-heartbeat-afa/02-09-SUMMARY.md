---
plan_id: 02-09
phase: 2
status: complete
completed_at: 2026-05-18T19:30:00Z
commits:
  - "feat(02-09): validation harness — heartbeat-test.sh + admin curl runbook + INFRA-NOTES"
files_modified:
  - nakama/test/heartbeat-test.sh (new, 20 invariants)
  - nakama/test/admin-curl-examples.md (new, 8 admin RPCs + 3 auth tests)
  - .planning/phases/01-foundation/INFRA-NOTES.md (5 Phase 2 sections appended)
  - .planning/phases/02-heartbeat-afa/02-VALIDATION.md (3 new invariant rows)
requirements_satisfied: [CLB-03, CLB-04, CLB-05, SEA-01, SEA-02, CMB-01, DAY-03]
---

# Plan 02-09 — Validation Harness

## What Built

The runnable verification surface for Phase 2: a 20-invariant smoke test, an admin curl runbook, and Phase-2 infrastructure documentation appended to `INFRA-NOTES.md`.

### Files

**`nakama/test/heartbeat-test.sh`** — 20 numbered test cases (`=== 1 ) ===` through `=== 20 ) ===`) following the Phase 1 `smoke-test.sh` PASS/FAIL/SKIP pattern.
- Tests 1-4: CLB-03 + CLB-05 (`api_football_league_ids`, fixtures, fallback log, TTL).
- Tests 5-6: SEA-01 + SEA-02 (`current_season` status + admin override).
- Tests 7-8: CMB-01 (window math + state=live transition).
- Tests 9-10: DAY-03 (anti-double-push + topic validation). Test 10 calls `admin_test_validate_topic` RPC directly — deterministic, not indirect.
- Tests 11-13: Resend (anti-enumeration, replay rejection — Test 12 manual-only).
- Tests 14-16: CLB-04 (admin auth — no/wrong/correct bearer).
- Tests 17: tick lock (manual).
- Tests 18-20: new invariants from revision (`club_team_map` populated, FlowRouter wires subscribe, NakamaService wires on_token_received).
- Skip path is graceful when `ADMIN_BEARER` is unset — script still validates the non-admin invariants.
- `bash -n` syntax clean.

**`nakama/test/admin-curl-examples.md`** — copy-pasteable curl for all 8 admin RPCs + 3 auth tests (no bearer / wrong bearer / correct bearer). Includes a PowerShell section for Windows users (here-string + `--data-binary "@-"` workaround for the PowerShell `--data-raw` quote-mangling bug we hit earlier).

**`.planning/phases/01-foundation/INFRA-NOTES.md`** — 5 new Phase 2 sections appended (Phase 1 content untouched):

1. **AFA Scheduler** — cadence rules, tick lock, league discovery, club-team map, debug. Documents the Goja AST gotcha that bit us in plan 02-02 so future me / contributors don't repeat it.
2. **FCM Setup** — GCP project + service account JSON + base64 encoding + Railway vars + security note about never committing the JSON.
3. **Admin RPCs** — bearer setup, test mode flag, audit log behavior, links to the curl runbook.
4. **Resend (Pending)** — current Phase 2 state (`RESEND_ENABLED=false`), Railway log grep recipe to recover dev reset link, 5-step pre-flip checklist for Phase 6/7, one-line flip recipe.
5. **Env Var Inventory** — full table of every env var the server reads (Phase 1 + 2 combined), shape/example, notes per var. Includes the new `--runtime.env=KEY=VALUE` CLI flag injection pattern.

**`.planning/phases/02-heartbeat-afa/02-VALIDATION.md`** — 3 new rows appended to the per-task verification table:
- `02-02-MAP-club_team` (CLB-03 / T-2-MAP-01)
- `02-08-FCM-subscribe-on-clubpick` (DAY-03 / T-2-FCM-05)
- `02-08-FCM-token-register` (DAY-03 / T-2-FCM-03)

## Verification

| Check | Result |
|-------|--------|
| `bash -n nakama/test/heartbeat-test.sh` | syntax OK |
| `grep -c "=== "` heartbeat-test.sh | 42 (header + 20 numbered cases + nested headers) |
| `grep -c "ADMIN_BEARER"` heartbeat-test.sh | 25 |
| `grep -c "CLB-03\|CLB-05\|SEA-01\|SEA-02\|CMB-01\|DAY-03\|CLB-04"` heartbeat-test.sh | 18 |
| `grep -c admin_test_validate_topic` heartbeat-test.sh | ≥1 |
| `grep -c "club boca"` heartbeat-test.sh | 1 |
| `grep -c "club_xeneizes"` heartbeat-test.sh | 1 |
| `grep -c admin_force_repoll` admin-curl-examples.md | 2 |
| `grep -c admin_set_club_team_mapping` admin-curl-examples.md | 2 |
| `grep -c admin_test_validate_topic` admin-curl-examples.md | 4 |
| INFRA-NOTES 5 section headings | all 5 hit |
| `grep -c "empty string"` INFRA-NOTES.md | 3 |
| 3 new VALIDATION rows present | all 3 ✓ |

## Must-Haves

- ✅ 20 numbered invariants in heartbeat-test.sh.
- ✅ Admin curl runbook for all 8 admin RPCs.
- ✅ INFRA-NOTES Phase 2: 5 sections appended (AFA Scheduler, FCM Setup, Admin RPCs, Resend Pending, Env Var Inventory).
- ✅ All 7 phase requirement IDs surface in test comments + assertions.
- ✅ Test #10 deterministic via admin_test_validate_topic RPC.
- ✅ VALIDATION.md updated with 3 new invariant rows.

## Deviations

- Test #10 (admin_test_validate_topic) needed the PowerShell-compatible `--data-binary` body shape that we discovered worked on Railway during the env-var debugging session — applied that to bash too so the script behaves consistently.
- INFRA-NOTES "empty-string vs unset" section was reworded — the original wording referenced local.yml expansion, but after the `--runtime.env=KEY=VALUE` CLI-flag refactor (entrypoint script), the empty-string concern matters less for local.yml and more for tooling. Updated note explains the actual Phase 2 mechanism.
- Test 17 (tick lock) kept manual — the race window is sub-100ms and any automated test would be flaky.

## Risks Carried Forward

- **Resend-B (12)** is `skip` — token extraction would require either a separate admin-only "list reset tokens" RPC or Nakama Console access. Acceptable for v1 (manual-only validation noted in VALIDATION.md §Manual-Only).
- **Tests 19-20** are static grep checks on GDScript files. They protect against accidental deletion of the FCM wiring but do not exercise the runtime path (that requires plan 02-07's Android plugin + a real device).

## Wave 3 closes here. All 9 Phase 2 plans shipped except 02-07 (Android FCM plugin — deferred, needs Android Studio + Firebase SDK setup that the user has to do manually).

## Next

Phase 2 verification + STATE/ROADMAP update + final push.
