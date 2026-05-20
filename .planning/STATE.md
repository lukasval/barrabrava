---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: executing
last_updated: "2026-05-20T00:29:35.576Z"
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 20
  completed_plans: 13
  percent: 65
---

# State: BarraBrava

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** La realidad del fútbol argentino afecta el juego en tiempo real, y cada jugador es un personaje real dentro de la barra de su club.

**Current focus:** Phase 2 — Heartbeat AFA. 8/9 plans deployed to Railway. Plan 02-07 (Android FCM plugin) deferred — requires user-side Android Studio + Firebase SDK setup.

## Current Phase

**Phase:** 2 — Heartbeat AFA
**Status:** Ready to execute
**Next action:** Begin Phase 3 planning via `/gsd-plan-phase 3` (Core Loop Laboral) OR finish 02-07 if Android plugin work is on the table.

**Phase 1:** ✅ COMPLETE (2026-05-17). All 5 plans executed end-to-end.

### Phase 2 Plans — Final Status

| Plan | Wave | Status | Live artifact |
|------|------|--------|---------------|
| 02-01 | 0 | ✅ | storage_keys + admin_auth + admin_inject_test_fixture; Railway env vars live |
| 02-02 | 1 | ✅ | AFA scheduler (registerLeaderboardReset cron) + API-Football integration + club_team_map builder; 2 hot-fixes for Goja AST |
| 02-03 | 1 | ✅ | FCM v1 OAuth2 + topic validator + admin_test_validate_topic RPC |
| 02-04 | 1 | ✅ | Resend un-stub (Phase 1 carryover) behind `RESEND_ENABLED=false` flag |
| 02-05 | 1 | ✅ | 7 admin RPCs (postpone/close/season/repoll/list_windows/set_club_team_mapping/inject_test_fixture) |
| 02-06 | 1 | ✅ | Player RPCs: register_fcm_token + get_current_window |
| 02-07 | 2 | ⏸️ DEFERRED | Android FCM plugin — requires Android Studio + Firebase Android SDK + signed APK build. Defer to Phase 7 device-build phase. |
| 02-08 | 2 | ✅ | Godot push UX: AppConfig flag flip, NakamaService 3 new methods, FlowRouter.confirm_club_pick, HomeScreen WindowBanner |
| 02-09 | 3 | ✅ | heartbeat-test.sh (20 invariants) + admin curl runbook + INFRA-NOTES Phase 2 (5 sections) + 3 new VALIDATION rows |

### Phase 1 Plans — Final Status

| Plan | Wave | Status | Live URL / Artifact |
|------|------|--------|---------------------|
| 01-01 | 0 | ✅ | Railway Nakama deploy https://nakama-production-7ea8.up.railway.app |
| 01-02 | 1 | ✅ | Godot 4.3 project + 4 autoloads + Nakama SDK v3.4.0 vendored |
| 01-03 | 2 | ✅ | TS runtime live — 5 RPCs + 133 clubs seeded |
| 01-04 | 3 | ✅ | 7 onboarding screens + 3 components + 3 autoloads + flow router |
| 01-05 | 3 | ✅ | Privacy/Terms/Reset web LIVE + AAIP/LEGAL docs |

## Progress

| Phase | Status |
|-------|--------|
| 1. Foundation | ✅ Complete (2026-05-17) |
| 2. Heartbeat AFA | ✅ Complete-with-deferral (2026-05-18) — 8/9 plans, 02-07 deferred |
| 3. Core Loop Laboral | ⏳ Pending |
| 4. Combate Estratégico | ⏳ Pending |
| 5. Mundo Social | ⏳ Pending |
| 6. Monetización + Seasons | ⏳ Pending |
| 7. Polish + Soft Launch | ⏳ Pending |

## Deferrals carried over to later phases

| Item | Deferred to | Status |
|------|-------------|--------|
| **Android FCM plugin (plan 02-07)** | **Phase 7 device build** | **NEW — Java/Gradle plugin + AndroidManifest + GDExtension. Needs Firebase Android SDK setup + signed APK toolchain. NakamaService.gd gracefully no-ops when FCMPlugin singleton is absent.** |
| Resend live wiring (`RESEND_ENABLED=true`) | Phase 6/7 | Token machinery shipped behind feature flag; flip after domain verified |
| Custom domain (`barrabrava.com.ar` or similar) | Phase 6/7 | GitHub Pages free `lukasval.github.io/barrabrava` works for now |
| Railway project rename `barrabrava-nakama` | TODO cosmetic | Current name `honest-heart` (auto-gen) |
| Nakama Console (port 7351) public exposure | On demand | Use TCP Proxy or local Nakama for admin |
| Railway auto-deploy GitHub webhook | DONE Phase 2 | Auto-deploy active on push to main |
| iOS CI workflow | Phase 7 | `DEFERRED-CI.md` |
| Android APK CI workflow | Phase 7 | `DEFERRED-CI.md` — workflow exists, trigger reduced to `workflow_dispatch` |
| API-Football paid tier | Phase 6 prelaunch | Phase 2 dev uses free tier 100 req/day |
| AAIP trámite | Phase 6/7 (≥1mo pre-launch) | `AAIP-REGISTRATION.md` checklist ready |
| IP lawyer review (AFA parodia) | Pre-launch | `LEGAL-NOTES.md` documents constraints |
| Cross-user `storageList` token scan in `confirm_password_reset` | Phase 6+ | Acceptable at Phase 2 scale; add secondary index when >1000 pending tokens |
| Stack-trace redaction in `admin_force_repoll` error path | Phase 6/7 | Tolerable for dev; redact `detail` when `ADMIN_TEST_MODE!=true` for prod |

## Recent Activity (Phase 2 execution)

- 2026-05-18 13:18 — `/gsd-execute-phase 2` started Wave 0.
- 2026-05-18 ~13:20 — Plan 02-01 (W0) committed: storage_keys + admin_auth + admin_inject_test_fixture. User provisioned Railway env vars (API_FOOTBALL_KEY, FCM_SERVICE_ACCOUNT_B64, FCM_PROJECT_ID, ADMIN_BEARER, RESEND_*, ADMIN_TEST_MODE).
- 2026-05-18 ~14:00 — Plan 02-02 (W1): AFA scheduler + API-Football. Hit Goja AST boot crash 3 times (`registerLeaderboardReset function key could not be extracted`). Fix #4 (research-grounded via Nakama source): inline registration inside InitModule body — Goja AST extractor only walks top-level statements in InitModule, never descends into helpers. Documented in `memory/feedback_debugging_escalation.md`.
- 2026-05-18 ~14:30 — Plan 02-03 (W1): FCM v1 + topic validator + admin_test_validate_topic.
- 2026-05-18 ~14:45 — Railway env vars confirmed working end-to-end after pivot from `local.yml ${VAR}` expansion (Nakama treats as literal) to `--runtime.env=KEY=VALUE` CLI-flag injection in `docker/nakama-entrypoint.sh`.
- 2026-05-18 ~16:00 — Plans 02-04 (Resend un-stub), 02-05 (7 admin RPCs), 02-06 (player RPCs) shipped sequentially. Logger count: 5 → 15 RPCs.
- 2026-05-18 ~18:00 — Plan 02-08 (Godot push UX): AppConfig flag flip + NakamaService FCM signal wiring + HomeScreen WindowBanner (state-aware copy + "Coming soon" for lower divisions).
- 2026-05-18 ~19:00 — Plan 02-09: heartbeat-test.sh (20 invariants), admin-curl-examples.md, INFRA-NOTES Phase 2 sections (5), VALIDATION.md (3 new rows). Plan 02-07 (Android FCM plugin) deferred — `autonomous:false` + requires user-side Android tooling.
- 2026-05-18 19:30 — Phase 2 complete-with-deferral. All code pushed to `lukasval/barrabrava@main`; Railway auto-deploy verified active.

## Open Decisions (rolled into Phase 3+ planning)

- Final art direction for parodied club identities (commission illustrator? or paramétrico puro?)
- Legal review timing: confirmed pre-launch (Phase 7) — `LEGAL-NOTES.md` tracks
- ARS pricing tiers final values (depend on FX rate at launch month — Phase 6)
- Phase 3 (Core Loop Laboral): laboral resources, work intervals, ventana-open bonus mechanic
- Multi-device FCM token support (Phase 4+): per-device key in `COL_FCM_TOKENS`

## Phase 2 — Closing Checklist

- ✅ All 9 plans accounted for (8 shipped, 1 deferred with rationale).
- ✅ All commits pushed to GitHub `main`.
- ✅ Railway auto-redeployed via GitHub webhook.
- ✅ Production smoke test: `get_clubs` returns 153 clubs; `admin_test_validate_topic` returns `{ok:true, normalized:"club_xeneizes"}` with valid bearer.
- ⏳ Run `bash nakama/test/heartbeat-test.sh` with `ADMIN_BEARER` set when convenient — full 20-invariant verification.
- ⏳ Build dev APK + verify real push delivery on Android device (depends on plan 02-07).
- ⏳ Rotate `ADMIN_BEARER` — current value was exposed in chat during debugging.

## Key Constraints

- Solo dev (vibecoding con Claude Code)
- Budget ~$20/mo (Claude subscription) + minimal infra (~$20-40 Railway)
- Mobile only v1 (iOS + Android)
- 5-6 months target to v1 soft launch

---
*Last updated: 2026-05-18 19:32 ART — Phase 2 complete-with-deferral. 02-07 Android FCM plugin deferred to Phase 7 device-build work.*
