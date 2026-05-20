---
phase: 3
slug: core-loop-laboral
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash + curl (sibling to Phase 2 `nakama/test/heartbeat-test.sh`) |
| **Config file** | none — invariants embedded in `laboral-test.sh` |
| **Quick run command** | `bash nakama/test/laboral-test.sh --quick` (single happy-path) |
| **Full suite command** | `bash nakama/test/laboral-test.sh` (18 invariants) |
| **Estimated runtime** | ~60s full / ~10s quick |

Auxiliary: Godot client tests stay manual (UI flows). Server-side invariants exhaustively scripted in bash + curl against deployed Railway endpoint with `ADMIN_BEARER` set.

---

## Sampling Rate

- **After every task commit:** Run `bash nakama/test/laboral-test.sh --quick`
- **After every plan wave:** Run `bash nakama/test/laboral-test.sh` (full)
- **Before `/gsd-verify-work`:** Full suite must be green + manual Godot UI walkthrough complete
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Populated by planner once 5 plans + tasks are finalized. Pattern from Phase 2: each task references one or more of the 18 invariants below by ID.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ W3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `nakama/test/laboral-test.sh` — invariant harness skeleton (created in Wave 3, but stubs land Wave 0)
- [ ] `nakama/src/storage_keys.ts` — new COL_AGUANTADEROS, COL_BARRA_STATE, COL_RECRUIT_POOL, COL_TURNOS constants (Wave 0)
- [ ] `scripts/autoloads/StorageKeys.gd` — client mirror of above (CR-01 lesson)
- [ ] `nakama/src/util/validation.ts` — extend with rank/profession/role validators

*Per RESEARCH.md §Validation Architecture: 19 invariants enumerated (18 game-logic + LAB-TUTORIAL-DURATION added in plan revision), harness mirrors Phase 2's `heartbeat-test.sh` pattern. LAB-COPY-VOCABULARY gate counted separately = 20 tests total.*

---

## Invariants (from RESEARCH.md §Validation Architecture)

| # | Invariant | Plan Owner |
|---|-----------|------------|
| 1 | Idle accrual lazy compute is idempotent (re-read does not double-credit). | TBD |
| 2 | Idle accrual respects 12h cap per pibé. | TBD |
| 3 | Skill multiplier formula `clamp(1 + hours/100, 1, 6)` applied correctly per profession. | TBD |
| 4 | Energía regen +5/h offline, clamped [0, 100]. | TBD |
| 5 | Turno submit fails if `match_window.state != "open" \| "live"`. | TBD |
| 6 | Turno submit consumes 30-50 Energía per pibé atomically (no partial state on error). | TBD |
| 7 | Turno output exact: +50 Aguante to `barra_state.aguante_pool`, +20 Rep to dueño per pibé. | TBD |
| 8 | Turno idempotent: re-submit same `(fixture_id, pibe_ids)` does not double-credit. | TBD |
| 9 | Daily recruit pool cron refreshes at 05:00 ART (08:00 UTC); pool key `recruit_pool/{club_id}/{yyyy-mm-dd}`. | TBD |
| 10 | Procedural pibé spawn deterministic for given (seed, club_id, date) tuple. | TBD |
| 11 | Recruit cost validation: rank-gated cost + Reputación mínima enforced server-side. | TBD |
| 12 | Recruit count cap per rank: Pibe ≤2, Soldado ≤5, Capo ≤10, Mesa/Líder ≤20 total pibes. | TBD |
| 13 | Roster slot cap = aguantadero level (5/8/12/16/20). | TBD |
| 14 | Rank threshold transitions atomic on Rep write (Pibe→Soldado @ 500, Soldado→Capo @ 2500). | TBD |
| 15 | Mesa Chica = top 5 by Rep, recomputed debounced (~5 min). Displacement correct. | TBD |
| 16 | VBC source restriction: only `players.profile.rank == "lider"` can assign pibé to "hablar cana". |  TBD |
| 17 | Líder election fires once on season `active → ended` transition (no double-trigger). | TBD |
| 18 | Aguantadero upgrade cost ladder + level cap (max 5) enforced server-side. | TBD |
| 19 | Tutorial duration <10 min (ONB-05 ceiling): `complete_tutorial` server log line contains `tutorial_duration_ms=<n>` with `n < 600000`. | 03.05 |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tutorial first-pibe flow walkthrough <10 min | ONB-05 | Godot UI flow + timing | Fresh account → onboarding → tutorial → first turno → reward → measure clock time |
| Bandera room visual after first trapo reward | AGT-05 / ONB-06 | Visual asset rendering | Complete tutorial reward, navigate to aguantadero, see trapo displayed |
| Lunfardo copy + App-Store-safe vocab (no "raid"/"attack" in Phase 3 UI) | CLAUDE.md tone | Linguistic + presentation review | Smoke test all 7 new screens against vocab list |
| HomeScreen "Hacer turno" button only visible when window open | D-03 | Visual state + Phase 2 integration | Trigger fake window via admin RPC, verify UI updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (storage_keys mirror, validation extensions)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 3 lands

**Approval:** pending
