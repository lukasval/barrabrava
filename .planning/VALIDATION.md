# BarraBrava — Validation Invariant Registry

> Per-phase invariant table. Each row is a named, runnable test assertion tied to
> one or more requirements. Green = passes against live Railway endpoint.
> See per-phase `XX-VALIDATION.md` files for full validation strategy.

---

## Phase 1: Foundation (5 invariants)

| ID | Requirement | Test Type | Automated Command | Status |
|----|-------------|-----------|-------------------|--------|
| HB-01-REGISTER | ONB-01 | smoke | `bash nakama/test/heartbeat-test.sh` (test 1) | ✅ green |
| HB-02-CLUBS | CLB-01 | smoke | `bash nakama/test/heartbeat-test.sh` (test 2) | ✅ green |
| HB-03-CREATE-PIBE | ONB-04 | smoke | `bash nakama/test/heartbeat-test.sh` (test 3) | ✅ green |
| HB-04-PRIVACY-URL | PRV-01 | smoke | `bash nakama/test/heartbeat-test.sh` (test 4) | ✅ green |
| HB-05-DELETE-ACCOUNT | PRV-03 | invariant | `bash nakama/test/heartbeat-test.sh` (test 5) | ✅ green |

---

## Phase 2: Heartbeat AFA (20 invariants + 3 new)

Harness: `bash nakama/test/heartbeat-test.sh`

| ID | Requirement | Test Type | Automated Command | Status |
|----|-------------|-----------|-------------------|--------|
| 02-01-CLB03-leagues | CLB-03 | invariant | heartbeat-test.sh test 1 | ✅ green |
| 02-01-CLB03-fixtures | CLB-03 | invariant | heartbeat-test.sh test 2 | ✅ green |
| 02-01-CLB05-fallback | CLB-05 | manual | MANUAL — requires unsetting API_FOOTBALL_KEY | ⏸ manual |
| 02-01-CLB05-ttl | CLB-05 | invariant | heartbeat-test.sh test 4 | ✅ green |
| 02-02-SEA01-active | SEA-01 | invariant | heartbeat-test.sh test 5 | ✅ green |
| 02-02-SEA02-end | SEA-02 | invariant | heartbeat-test.sh test 6 (ADMIN_BEARER required) | ✅ green |
| 02-03-CMB01-math | CMB-01 | invariant | heartbeat-test.sh test 7 (ADMIN_BEARER required) | ✅ green |
| 02-03-CMB01-live | CMB-01 | invariant | heartbeat-test.sh test 8 (ADMIN_BEARER required) | ✅ green |
| 02-04-DAY03-once | DAY-03 | invariant | heartbeat-test.sh test 9 (ADMIN_BEARER required) | ✅ green |
| 02-04-DAY03-topic | DAY-03 | invariant | heartbeat-test.sh test 10 (ADMIN_BEARER required) | ✅ green |
| 02-05-Resend-A | PRV-04 | invariant | heartbeat-test.sh test 11 | ✅ green |
| 02-05-Resend-B | PRV-04 | manual | MANUAL — token extraction via Nakama Console | ⏸ manual |
| 02-05-Resend-C | PRV-04 | invariant | heartbeat-test.sh test 13 | ✅ green |
| 02-06-Admin-A | CLB-04 | security | heartbeat-test.sh test 14 | ✅ green |
| 02-06-Admin-B | CLB-04 | security | heartbeat-test.sh test 15 | ✅ green |
| 02-06-Admin-C | CLB-04 | invariant | heartbeat-test.sh test 16 (ADMIN_BEARER required) | ✅ green |
| 02-07-Tick-lock | CMB-01 | manual | MANUAL — two admin_force_repoll within 1s, grep logs | ⏸ manual |
| 02-02-MAP-club_team | CLB-03 | invariant | heartbeat-test.sh test 18 | ✅ green |
| 02-08-FCM-subscribe | DAY-03 | invariant | heartbeat-test.sh test 19 (source grep) | ✅ green |
| 02-08-FCM-token-register | DAY-03 | invariant | heartbeat-test.sh test 20 (source grep) | ✅ green |

---

## Phase 3: Core Loop Laboral (19 invariants + 1 vocabulary gate = 20 tests)

Harness: `bash nakama/test/laboral-test.sh`
Quick mode: `bash nakama/test/laboral-test.sh --quick` (4 smoke tests, <30s)

| ID | Requirement | Test Type | Automated Command | Status |
|----|-------------|-----------|-------------------|--------|
| LAB-IDLE-IDEMPOTENT | AGT-03, PIB-05 (D-01) | smoke | `laboral-test.sh --quick` (or full suite) | ⏳ pending Railway deploy |
| LAB-IDLE-CAP | AGT-03, PIB-05 (D-02) | manual | MANUAL — requires admin storage-write to backdate last_collected_at. Deferred to Phase 7. | ⏸ deferred Phase 7 |
| LAB-IDLE-RATE-TRAPITO | PIB-05, AGT-03 (D-05) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-ENERGIA-REGEN | PIB-04 (D-04) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-TURNO-WINDOW-GATE | CMB-01, PIB-06 (D-03) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-TURNO-ENERGY-GATE | PIB-04, PIB-06 (D-04) | invariant (partial) | `bash nakama/test/laboral-test.sh` — energy-low branch deferred Phase 7 | ⏸ deferred Phase 7 (energy-low) |
| LAB-TURNO-OUTPUT | PIB-06, AGT-01 (D-06) | invariant | `bash nakama/test/laboral-test.sh` (ADMIN_BEARER + ADMIN_TEST_MODE=true required) | ⏳ pending Railway deploy |
| LAB-TURNO-IDEMPOTENT | PIB-06 (D-03, D-06) | smoke | `laboral-test.sh --quick` (or full suite) | ⏳ pending Railway deploy |
| LAB-RECRUIT-DAILY | PIB-02 (D-09) | smoke | `laboral-test.sh --quick` (or full suite) | ⏳ pending Railway deploy |
| LAB-RECRUIT-TRAIT-REDACT | PIB-03 (D-10) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-RECRUIT-RACE | PIB-02 (D-09 concurrency) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-RECRUIT-COST | PIB-02, PIB-07 (D-12) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-RECRUIT-CAP | PIB-02 (D-12) | manual | MANUAL — requires 2-pibe setup. See laboral-test.md. | ⏸ manual |
| LAB-RANK-THRESHOLD-PROMOTE | JER-01, JER-02 (D-13) | invariant | `bash nakama/test/laboral-test.sh` (ADMIN_BEARER required) | ⏳ pending Railway deploy |
| LAB-MESA-DEBOUNCE | JER-03 (D-14) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-VBC-LIDER-ONLY | JER-04, PIB-04 (D-07, D-16) | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-LIDER-ELECTION | JER-04 (D-15) | manual | MANUAL — requires admin season-end trigger. Deferred to Phase 7. | ⏸ deferred Phase 7 |
| LAB-TUTORIAL-REWARD-ATOMIC | ONB-06 | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |
| LAB-TUTORIAL-DURATION | ONB-05 | manual | MANUAL — Railway log access required; skip in harness. See laboral-test.md §2. | ⏸ manual (Railway logs) |
| LAB-COPY-VOCABULARY | CLAUDE.md tone, UI-SPEC §8.5 | smoke | `laboral-test.sh --quick` (or full suite) — greps .ts + .gd source | ⏳ pending Railway deploy |
| LAB-AGUANTADERO-CAP | AGT-01..05 | invariant | `bash nakama/test/laboral-test.sh` | ⏳ pending Railway deploy |

**Notes:**
- "Pending Railway deploy" = harness authored; Railway Hobby plan builds paused 2026-05-20. Run once Railway deploys queued commits c9ecf60 + 95b0099.
- ADMIN_BEARER rotation still outstanding from Phase 2 — rotate before any production admin RPC.
- Quick mode covers: LAB-IDLE-IDEMPOTENT + LAB-TURNO-IDEMPOTENT + LAB-RECRUIT-DAILY + LAB-COPY-VOCABULARY.
- Harness location: `nakama/test/laboral-test.sh` | Admin recipes: `nakama/test/admin-curl-examples-laboral.md`

---

*Last updated: 2026-05-20 — Phase 3 complete-with-deferral.*
