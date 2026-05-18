---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: completed
last_updated: "2026-05-17T19:49:00.103Z"
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# State: BarraBrava

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** La realidad del fútbol argentino afecta el juego en tiempo real, y cada jugador es un personaje real dentro de la barra de su club.

**Current focus:** Phase 2 — Heartbeat AFA. Plans ready. Awaiting execution.

## Current Phase

**Phase:** 2 — Heartbeat AFA
**Status:** ✅ PLANNED (2026-05-18). 9 plans across 4 waves. Plan-checker iter 3/3 clean (0 BLOCKER, 0 HIGH, 0 MEDIUM remaining).
**Next action:** Run `/gsd-execute-phase 2` to start Wave 0 bootstrap (env vars + storage_keys + admin_auth + human checkpoint).

**Phase 1:** ✅ COMPLETE (2026-05-17). All 5 plans executed end-to-end.

### Phase 1 Plans — Final Status

| Plan | Wave | Status | Live URL / Artifact |
|------|------|--------|---------------------|
| 01-01 | 0 | ✅ | Railway Nakama deploy https://nakama-production-7ea8.up.railway.app |
| 01-02 | 1 | ✅ | Godot 4.3 project + 4 autoloads + Nakama SDK v3.4.0 vendored |
| 01-03 | 2 | ✅ | TS runtime live — 5 RPCs + 133 clubs seeded — smoke test passed with real server_key |
| 01-04 | 3 | ✅ | 7 onboarding screens + 3 components + 3 autoloads + flow router |
| 01-05 | 3 | ✅ | Privacy/Terms/Reset web LIVE https://lukasval.github.io/barrabrava/ + AAIP/LEGAL docs |

## Progress

| Phase | Status |
|-------|--------|
| 1. Foundation | ✅ Complete (2026-05-17) |
| 2. Heartbeat AFA | 📋 Planned — `/gsd-execute-phase 2` |
| 3. Core Loop Laboral | ⏳ Pending |
| 4. Combate Estratégico | ⏳ Pending |
| 5. Mundo Social | ⏳ Pending |
| 6. Monetización + Seasons | ⏳ Pending |
| 7. Polish + Soft Launch | ⏳ Pending |

## Deferrals carried over to later phases

| Item | Deferred to | Status |
|------|-------------|--------|
| Resend / SMTP for password reset emails | Phase 2 | Stub RPC returns `feature_unavailable_phase_1` |
| Custom domain (`barrabrava.com.ar` or similar) | Phase 2 | GitHub Pages free `lukasval.github.io/barrabrava` works for now |
| Railway project rename `barrabrava-nakama` | TODO cosmetic | Current name `honest-heart` (auto-gen) |
| Nakama Console (port 7351) public exposure | On demand | Use TCP Proxy or local Nakama for admin |
| Railway auto-deploy GitHub webhook | TBD | Manual redeploys for now |
| iOS CI workflow | Phase 7 | `DEFERRED-CI.md` |
| Android APK CI workflow | Phase 7 | `DEFERRED-CI.md` — workflow exists, trigger reduced to `workflow_dispatch` |
| AAIP trámite | Phase 6/7 (≥1mo pre-launch) | `AAIP-REGISTRATION.md` checklist ready |
| IP lawyer review (AFA parodia) | Pre-launch | `LEGAL-NOTES.md` documents constraints |

## Recent Activity

- 2026-05-14: Project initialized via /gsd-new-project
- 2026-05-14: PROJECT.md committed
- 2026-05-14: config.json committed (YOLO, standard granularity, custom model profile)
- 2026-05-14: Research committed (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- 2026-05-14: REQUIREMENTS.md committed (~95 v1 requirements + v1.1/v2 backlog)
- 2026-05-14: ROADMAP.md committed (7 phases, ~5-6 months solo dev)
- 2026-05-14: Phase 1 context gathered via /gsd-discuss-phase (01-CONTEXT.md)
- 2026-05-14: Phase 1 UI design contract approved via /gsd-ui-phase (01-UI-SPEC.md)
- 2026-05-15: Phase 1 research committed (01-RESEARCH.md)
- 2026-05-15: Phase 1 validation strategy created (01-VALIDATION.md — nyquist_compliant: true)
- 2026-05-15: Phase 1 planning complete — 5 plans across 4 waves (verified by plan-checker, iteration 2)
- 2026-05-15: Wave 0 Plan 01-01 complete — Railway + Postgres + Nakama + GitHub repo + INFRA-NOTES
- 2026-05-15: Wave 1 Plan 01-02 complete — Godot 4.3 skeleton (Android CI deferred to Phase 7 → DEFERRED-CI.md)
- 2026-05-17: Wave 2 Plan 01-03 complete — Nakama TS runtime LIVE; resolved Goja InitModule AST issue (function decls, not arrows) + IIFE strip post-build; smoke test passes end-to-end with real server_key after Railway start command updated with `--socket.server_key $NAKAMA_SERVER_KEY`
- 2026-05-17: Wave 3 Plan 01-04 complete — 7 onboarding screens (Splash, Auth, ForgotPassword, ClubPicker, PibeCreator, Tutorial, Home) + 3 reusable components + FlowRouter/PlayerStore/AppConfig autoloads
- 2026-05-17: Wave 3 Plan 01-05 complete — privacy/terms/reset web pages LIVE on GitHub Pages; AppConfig PRV-05 asserts; AcceptTerms consent gate in AuthScreen; AAIP-REGISTRATION + LEGAL-NOTES docs
- 2026-05-17: ✅ PHASE 1 FOUNDATION COMPLETE — repo public, all infra live, all checkpoints closed
- 2026-05-17: Phase 2 context gathered via /gsd-discuss-phase (`02-CONTEXT.md` + `02-DISCUSSION-LOG.md`). 27 decisions logged (D-01..D-27). User delegó decisiones técnicas a Claude — scheduler in-process Nakama timer, FCM topics+tokens híbrido, admin RPCs vía curl, Resend wired internamente detrás de feature flag (activación real diferida a Phase 6/7 pendiente compra de dominio), scraping lower divisions diferido a v1.1.
- 2026-05-18: Phase 2 research committed (`02-RESEARCH.md`, 1750 lines, 10 [VERIFY] items). Critical correction: D-01 timer → `registerLeaderboardReset` cron pattern (Nakama TS runtime has no `nk.timerCreate`).
- 2026-05-18: Phase 2 validation strategy (`02-VALIDATION.md`, 17 invariants, bash+curl smoke) + pattern map (`02-PATTERNS.md`, 32 files mapped to Phase 1 analogs).
- 2026-05-18: Phase 2 planning complete — 9 plans across 4 waves. Plan-checker iter 1 found 3 BLOCKER + 1 HIGH + 4 MEDIUM + 2 LOW; iter 2 closed 9/10; iter 3 closed MEDIUM 7 (typecheck mask). Final state: 0 issues. Ready for `/gsd-execute-phase 2`.

## Open Decisions (rolled into Phase 3+ planning)

- Final art direction for parodied club identities (commission illustrator? or paramétrico puro?)
- Legal review timing: confirmed pre-launch (Phase 7) — `LEGAL-NOTES.md` tracks
- ARS pricing tiers final values (depend on FX rate at launch month — Phase 6)
- Custom domain registration → Phase 6/7 prelaunch (per Phase 2 D-26)
- Resend live wiring → Phase 6/7 once domain verified (Phase 2 ships token machinery behind `RESEND_ENABLED=false` flag)
- API-Football paid tier → Phase 6 prelaunch (Phase 2 dev uses free tier 100 req/day)

## Phase 2 — Pre-Execute Checklist (USER ACTION REQUIRED at Wave 0)

Plan 02-01 marks `autonomous: false` — executor will STOP and ask user before continuing:

1. API-Football signup (free tier) → set `API_FOOTBALL_KEY` on Railway
2. GCP project + FCM + service account JSON (base64 encoded) → set `FCM_SERVICE_ACCOUNT_B64` + `FCM_PROJECT_ID` on Railway
3. Generate UUID v4 → set `ADMIN_BEARER` on Railway
4. (Optional Phase 2) Resend account → set `RESEND_API_KEY` on Railway (any value if `RESEND_ENABLED=false`)

## Key Constraints

- Solo dev (vibecoding con Claude Code)
- Budget ~$20/mo (Claude subscription) + minimal infra (~$20-40 Railway)
- Mobile only v1 (iOS + Android)
- 5-6 months target to v1 soft launch

---
*Last updated: 2026-05-18 — Phase 2 plans verified clean (3-iteration loop). Ready for `/gsd-execute-phase 2`.*
