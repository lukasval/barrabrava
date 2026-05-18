---
plan_id: 02-05
phase: 2
status: complete
completed_at: 2026-05-18T19:02:00Z
commits:
  - "feat(02-05): admin_close_window + admin_postpone_fixture + admin_set_club_team_mapping"
  - "feat(02-05): admin_set_season_window + admin_force_repoll + admin_list_windows + main.ts wire"
files_modified:
  - nakama/src/rpc/admin_close_window.ts (new)
  - nakama/src/rpc/admin_postpone_fixture.ts (new)
  - nakama/src/rpc/admin_set_club_team_mapping.ts (new)
  - nakama/src/rpc/admin_set_season_window.ts (new)
  - nakama/src/rpc/admin_force_repoll.ts (new)
  - nakama/src/rpc/admin_list_windows.ts (new)
  - nakama/src/main.ts (7 admin imports + 7 registerRpc lines + logger count bump)
requirements_satisfied: [CLB-04]
---

# Plan 02-05 — Admin Override Plane

## What Built

Six admin RPCs + manual-reconciliation RPC `admin_set_club_team_mapping`. Each guards on `requireAdmin` (constant-time bearer compare from plan 02-01) and writes a `COL_ADMIN_ACTIONS` audit row with `caller_ip + at + action-specific fields` (D-22). Total Phase 2 admin plane = 7 RPCs (six new + `admin_inject_test_fixture` from plan 02-01, registered here).

### Files

| RPC | Mutates | Notes |
|-----|---------|-------|
| `admin_close_window` | `COL_MATCH_WINDOWS` (state=closed) | Idempotent: returns `already_closed:true` on re-call. |
| `admin_postpone_fixture` | `COL_MATCH_WINDOWS` + `COL_FIXTURES` | Two modes: shift kickoff (recomputes opens/closes ± 2h) OR `cancel:true`. D-08: open/live windows refuse silent shift — explicit `cancel:true` required. |
| `admin_set_season_window` | `meta:current_season` | Forces season status ∈ {pre,active,ended}. Defaults `ends_at` to now+180d when omitted. |
| `admin_force_repoll` | (calls `runHeartbeatTick`) | Synchronous tick. tick_lock honored internally (S-13). |
| `admin_list_windows` | (read only) | Paginated 50×100. Optional `state` filter. No audit row (read-only path). |
| `admin_set_club_team_mapping` | `meta:club_team_map` + `meta:unmatched_clubs` | Merge-not-overwrite into map; prunes matching entry from unmatched. |
| `admin_inject_test_fixture` | (created plan 02-01) | Registered here; previously orphan code. ADMIN_TEST_MODE gate + `requireAdmin`. |

### main.ts changes

- 7 imports added (after Phase 1 RPC imports, before `storage_keys` import).
- 7 `registerRpc` lines added inside `InitModule`, **as direct ExpressionStatements** (Goja AST extractor only walks top-level statements — see commit history of plan 02-02 for the rabbit hole).
- Final `logger.info` count: `"13 RPCs registered + scheduler armed"` (5 Phase 1 + 1 plan 02-03 + 7 admin = 13).

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` clean (no filters) | exits 0 |
| `npm run build` | OK (build/index.js refreshed) |
| `grep requireAdmin admin_*.ts` | 7 hits across 7 files |
| `grep COL_ADMIN_ACTIONS admin_*.ts` | 6 hits (admin_list_windows is read-only) |
| `grep "window_already_open_use_close" admin_postpone_fixture.ts` | 1 hit |
| `grep "club_team_map" admin_set_club_team_mapping.ts` | 2 hits |
| `grep "admin_postpone_fixture" main.ts` | 2 hits (import + registerRpc) |
| `grep "admin_set_club_team_mapping" main.ts` | 2 hits |
| `grep "admin_inject_test_fixture" main.ts` | 2 hits |
| `grep "13 RPCs" main.ts` | 1 hit |

## Must-Haves

- ✅ All admin RPCs return `{ok:false, error:'unauthorized'}` without correct ADMIN_BEARER (delegated to `requireAdmin`).
- ✅ Every admin mutation writes a `COL_ADMIN_ACTIONS` audit row (D-22).
- ✅ `admin_postpone_fixture` shifts opens_at/closes_at when state is 'scheduled'; requires `cancel:true` for open/live.
- ✅ `admin_close_window` sets state='closed' + closes_at=now, idempotent.
- ✅ `admin_set_season_window` overwrites `meta:current_season`.
- ✅ `admin_force_repoll` invokes `runHeartbeatTick`; respects tick_lock.
- ✅ `admin_list_windows` paginated with optional state filter.
- ✅ `admin_set_club_team_mapping` writes to `meta:club_team_map` (merge), prunes `meta:unmatched_clubs`.
- ✅ `requireAdmin` constant-time compare (already mitigated in plan 02-01).
- ✅ All 7 admin RPCs registered in `main.ts` as direct ExpressionStatements.

## Threat Disposition

| Threat ID | Disposition | Implemented? |
|-----------|-------------|--------------|
| T-2-ADM-01 (bearer spoof) | mitigate | ✅ requireAdmin constant-time |
| T-2-ADM-02 (audit tampering) | mitigate | ✅ permissionRead/Write:0, UUID-keyed rows |
| T-2-ADM-03 (force_repoll DoS) | mitigate | ✅ tick_lock honored inside runHeartbeatTick |
| T-2-ADM-04 (privilege escalation) | mitigate | ✅ requireAdmin is first line of every admin RPC |
| T-2-RT-07 (bearer in logs) | mitigate | ✅ never logged; only callerIp |
| T-2-MAP-03 (mapping tamper) | mitigate | ✅ bearer auth + audit + integer validation + merge-not-overwrite |

## Deviations

- Plan said `logger.info` count should be "11 RPCs". Actual: 13 (plan didn't account for `admin_test_validate_topic` from 02-03 and `admin_inject_test_fixture` from 02-01). Used the accurate count.
- Plan 02-04 was said to register `admin_inject_test_fixture` — that was a planning error (02-04 was Resend un-stub). Registered it here alongside the other admin RPCs (logical home).
- All registerRpc calls live in InitModule (forced by Goja AST constraint — discovered the hard way in plan 02-02). Did NOT introduce a helper function like the original `registerSchedulerHooks` wrapper.

## Risks Carried Forward

- Untested in production until `/gsd-verify-work` curls. Verification path: plan 02-09 ships `nakama/test/heartbeat-test.sh` covering all admin RPCs (invariants 02-06-Admin-A/B/C).
- `admin_force_repoll` could expose stack trace via the `detail: String(e)` field if `runHeartbeatTick` throws an exception with sensitive content. Tolerable for dev; for prod, redact `detail` when `ADMIN_TEST_MODE !== 'true'`.

## Next

Plan 02-06: player-facing RPCs `register_fcm_token` + `get_current_window`. Both authenticated (require ctx.userId). After 02-06, Wave 1 closes. Wave 2 = Android FCM plugin + Godot push UX.
