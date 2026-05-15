# State: BarraBrava

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** La realidad del fútbol argentino afecta el juego en tiempo real, y cada jugador es un personaje real dentro de la barra de su club.

**Current focus:** Phase 1 — Foundation (no iniciada)

## Current Phase

**Phase:** 1 — Foundation
**Status:** Ready to execute (5 plans in 4 waves)
**Next action:** Run `/gsd-execute-phase 1`

### Phase 1 Plans

| Plan | Wave | Objective |
|------|------|-----------|
| 01-01 | 0 | Infra: Railway+Nakama+Postgres+CI+AAIP+Resend (1 human-action + 3 auto + 1 human-verify) |
| 01-02 | 1 | Godot 4.3 skeleton + SDK + Theme + autoloads |
| 01-03 | 2 | Nakama TS runtime + 5 RPCs + clubs.json seed (~133) + rate limiting |
| 01-04 | 3 | 6 screens (Splash, Auth, ForgotPassword, ClubPicker, PibeCreator, Tutorial, Home) + components |
| 01-05 | 3 | Privacy Policy ES/EN + Reset HTML (device auth Bearer) + AAIP docs + PRV-05 enforcement |

## Progress

| Phase | Status |
|-------|--------|
| 1. Foundation | 📋 Planned (ready to execute) |
| 2. Heartbeat AFA | ⏳ Pending |
| 3. Core Loop Laboral | ⏳ Pending |
| 4. Combate Estratégico | ⏳ Pending |
| 5. Mundo Social | ⏳ Pending |
| 6. Monetización + Seasons | ⏳ Pending |
| 7. Polish + Soft Launch | ⏳ Pending |

## Recent Activity

- 2026-05-14: Project initialized via /gsd-new-project
- 2026-05-14: PROJECT.md committed
- 2026-05-14: config.json committed (YOLO, standard granularity, custom model profile)
- 2026-05-14: Research committed (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- 2026-05-14: REQUIREMENTS.md committed (~95 v1 requirements + v1.1/v2 backlog)
- 2026-05-14: ROADMAP.md committed (7 phases, ~5-6 months solo dev)
- 2026-05-14: Phase 1 context gathered via /gsd-discuss-phase (01-CONTEXT.md)
- 2026-05-14: Phase 1 UI design contract approved via /gsd-ui-phase (01-UI-SPEC.md)
- 2026-05-15: Phase 1 research committed (01-RESEARCH.md — Railway/Fly.io finding, Nakama-Godot SDK patterns)
- 2026-05-15: Phase 1 validation strategy created (01-VALIDATION.md — nyquist_compliant: true)
- 2026-05-15: Phase 1 planning complete — 5 plans across 4 waves (verified by plan-checker, iteration 2)
- 2026-05-15: CONTEXT.md D-14/D-15 revised — TEC-08 Android-only Phase 1, Railway region flexible
- 2026-05-15: DEFERRED-IOS-CI.md documents iOS CI deferral to Phase 7

## Open Decisions

- Final art direction for parodied club identities (commission illustrator? or paramétrico puro?)
- Legal review timing: pre-Phase 1 or post-Phase 3?
- ARS pricing tiers final values (depend on FX rate at launch month)
- AAIP database registration: when to start? (2-4 week process)

## Key Constraints

- Solo dev (vibecoding con Claude Code)
- Budget ~$20/mo (Claude subscription) + minimal infra (~$20-40 Railway)
- Mobile only v1 (iOS + Android)
- 5-6 months target to v1 soft launch

---
*Last updated: 2026-05-15 — Phase 1 planning complete (5 plans, ready to execute)*
