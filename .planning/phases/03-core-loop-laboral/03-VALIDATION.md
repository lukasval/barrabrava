---
phase: 3
slug: core-loop-laboral
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
approved: 2026-05-20
approved_by: executor-03-05
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03.01-T1: storage constants | 03.01 | 1 | AGT-03, PIB-01 | T-3-AS-01 | Server constants define all Phase 3 collections | source-grep | `grep -q COL_AGUANTADEROS nakama/src/storage_keys.ts` | ✅ | ✅ green |
| 03.01-T2: AI baseline seed | 03.01 | 1 | JER-01, JER-03 | T-3-AS-04 | AI names null on server; canned label at UI only | invariant | `bash nakama/test/laboral-test.sh` → LAB-MESA-DEBOUNCE | ✅ | ⏳ pending deploy |
| 03.01-T3: admin RPCs | 03.01 | 1 | AGT-03, JER-04 | T-3-AS-02 | Bearer-gated; audit trail written | invariant | `bash nakama/test/laboral-test.sh` → LAB-RECRUIT-DAILY, LAB-RANK-THRESHOLD-PROMOTE | ✅ | ⏳ pending deploy |
| 03.02-T1: idle_accrual.ts | 03.02 | 2 | PIB-05, AGT-03 | T-3-RS-02 | Projection-only on get_roster; never commits | invariant | `bash nakama/test/laboral-test.sh` → LAB-IDLE-IDEMPOTENT, LAB-IDLE-RATE-TRAPITO | ✅ | ⏳ pending deploy |
| 03.02-T2: rank.ts + Mesa | 03.02 | 2 | JER-01..03 | T-3-RS-03 | Mesa debounce prevents recompute spam | invariant | `bash nakama/test/laboral-test.sh` → LAB-MESA-DEBOUNCE, LAB-RANK-THRESHOLD-PROMOTE | ✅ | ⏳ pending deploy |
| 03.02-T3: pibe_factory.ts | 03.02 | 2 | PIB-02, PIB-03 | T-3-RS-04 | Deterministic procedural spawn; lunfardo names only | invariant | `bash nakama/test/laboral-test.sh` → LAB-RECRUIT-TRAIT-REDACT | ✅ | ⏳ pending deploy |
| 03.02-T4: read RPCs (4) | 03.02 | 2 | AGT-01..05, PIB-01..07 | T-3-RS-01 | trait_2 redacted on pool read | invariant | `bash nakama/test/laboral-test.sh` → LAB-RECRUIT-TRAIT-REDACT, LAB-ENERGIA-REGEN, LAB-MESA-DEBOUNCE, LAB-AGUANTADERO-CAP | ✅ | ⏳ pending deploy |
| 03.03-T1: assign_profession | 03.03 | 3 | PIB-04, PIB-05 | T-3-WS-03 | VBC profession gated to lider_only | invariant | `bash nakama/test/laboral-test.sh` → LAB-VBC-LIDER-ONLY | ✅ | ⏳ pending deploy |
| 03.03-T2: collect_idle | 03.03 | 3 | PIB-05, AGT-03 | T-3-WS-04 | Idempotent within same-second window | smoke | `laboral-test.sh --quick` → LAB-IDLE-IDEMPOTENT | ✅ | ⏳ pending deploy |
| 03.03-T3: recruit_pibe | 03.03 | 3 | PIB-02, PIB-07 | T-3-WS-02 | Optimistic concurrency; cost + cap enforced | invariant | `bash nakama/test/laboral-test.sh` → LAB-RECRUIT-RACE, LAB-RECRUIT-COST | ✅ | ⏳ pending deploy |
| 03.03-T4: submit_turno | 03.03 | 3 | PIB-06, AGT-01 | T-3-WS-01 | Idempotency-marker-first; window gate enforced | invariant | `bash nakama/test/laboral-test.sh` → LAB-TURNO-IDEMPOTENT, LAB-TURNO-WINDOW-GATE, LAB-TURNO-OUTPUT | ✅ | ⏳ pending deploy |
| 03.03-T5: complete_tutorial | 03.03 | 3 | ONB-05, ONB-06 | T-3-WS-05 | Reward atomic; duration logged; idempotent | invariant | `bash nakama/test/laboral-test.sh` → LAB-TUTORIAL-REWARD-ATOMIC, LAB-TUTORIAL-DURATION | ✅ | ⏳ pending deploy |
| 03.03-T6: cron + seasons | 03.03 | 3 | JER-04, PIB-02 | T-3-WS-10 | Recruit lock prevents cron overlap | invariant | `bash nakama/test/laboral-test.sh` → LAB-RECRUIT-DAILY, LAB-LIDER-ELECTION (deferred) | ✅ | ⏳ pending deploy |
| 03.04a: Godot autoloads | 03.04a | 4 | AGT-01..05, PIB-01..07 | T-3-AS-05 | elapsed_ms forwarded via complete_tutorial wrapper | source-grep | `grep -q elapsed_ms scripts/autoloads/NakamaService.gd` | ✅ | ✅ green |
| 03.04b: Godot screens | 03.04b | 5 | ONB-05, ONB-06 | T-3-AS-05 | Vocab audit 0 banned terms; tutorial_start_at_ms captured | source-grep + manual | LAB-COPY-VOCABULARY + walkthroughs A–E (HUMAN-UAT.md) | ✅ | ⏳ walkthroughs pending |
| 03.05: harness | 03.05 | 6 | all above | T-3-VAL-01..05 | ADMIN_BEARER never echoed; test users filterable | invariant | `bash nakama/test/laboral-test.sh` | ✅ | ✅ green (syntax) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `nakama/test/laboral-test.sh` — invariant harness (664 lines, 20 tests) — shipped plan 03.05 Wave 6
- [x] `nakama/src/storage_keys.ts` — COL_AGUANTADEROS, COL_BARRA_STATE, COL_RECRUIT_POOL, COL_TURNOS constants — shipped plan 03.01
- [x] `scripts/autoloads/StorageKeys.gd` — client mirror — shipped plan 03.01
- [x] `nakama/src/util/validation.ts` — validateProfession, validateRank, isUuid — shipped plan 03.02

*Per RESEARCH.md §Validation Architecture: 19 invariants enumerated (18 game-logic + LAB-TUTORIAL-DURATION added in plan revision), harness mirrors Phase 2's `heartbeat-test.sh` pattern. LAB-COPY-VOCABULARY gate counted separately = 20 tests total.*

---

## Invariants (from RESEARCH.md §Validation Architecture)

| # | Invariant | LAB ID | Plan Owner |
|---|-----------|--------|------------|
| 1 | Idle accrual lazy compute is idempotent (re-read does not double-credit). | LAB-IDLE-IDEMPOTENT | 03.02 + 03.03 |
| 2 | Idle accrual respects 12h cap per pibé. | LAB-IDLE-CAP | 03.02 + 03.03 (test deferred Phase 7) |
| 3 | Skill multiplier formula `clamp(1 + hours/100, 1, 6)` applied correctly per profession. | LAB-IDLE-RATE-TRAPITO | 03.02 + 03.03 |
| 4 | Energía regen +5/h offline, clamped [0, 100]. | LAB-ENERGIA-REGEN | 03.02 |
| 5 | Turno submit fails if `match_window.state != "open" \| "live"`. | LAB-TURNO-WINDOW-GATE | 03.03 |
| 6 | Turno submit consumes 30-50 Energía per pibé atomically (no partial state on error). | LAB-TURNO-ENERGY-GATE | 03.03 (energy-low path deferred Phase 7) |
| 7 | Turno output exact: +50 Aguante to `barra_state.aguante_pool`, +20 Rep to dueño per pibé. | LAB-TURNO-OUTPUT | 03.03 |
| 8 | Turno idempotent: re-submit same `(fixture_id, pibe_ids)` does not double-credit. | LAB-TURNO-IDEMPOTENT | 03.03 |
| 9 | Daily recruit pool cron refreshes at 05:00 ART (08:00 UTC); pool key `recruit_pool/{club_id}/{yyyy-mm-dd}`. | LAB-RECRUIT-DAILY | 03.01 + 03.03 |
| 10 | Procedural pibé spawn deterministic for given (seed, club_id, date) tuple. | LAB-RECRUIT-TRAIT-REDACT | 03.02 |
| 11 | Recruit cost validation: rank-gated cost + Reputación mínima enforced server-side. | LAB-RECRUIT-COST | 03.03 |
| 12 | Recruit count cap per rank: Pibe ≤2, Soldado ≤5, Capo ≤10, Mesa/Líder ≤20 total pibes. | LAB-RECRUIT-CAP | 03.03 (manual verify) |
| 13 | Roster slot cap = aguantadero level (5/8/12/16/20). | LAB-AGUANTADERO-CAP | 03.02 + 03.03 |
| 14 | Rank threshold transitions atomic on Rep write (Pibe→Soldado @ 500, Soldado→Capo @ 2500). | LAB-RANK-THRESHOLD-PROMOTE | 03.02 + 03.03 |
| 15 | Mesa Chica = top 5 by Rep, recomputed debounced (~5 min). Displacement correct. | LAB-MESA-DEBOUNCE | 03.02 + 03.03 |
| 16 | VBC source restriction: only `players.profile.rank == "lider"` can assign pibé to "hablar cana". | LAB-VBC-LIDER-ONLY | 03.03 |
| 17 | Líder election fires once on season `active → ended` transition (no double-trigger). | LAB-LIDER-ELECTION | 03.03 (test deferred Phase 7) |
| 18 | Aguantadero upgrade cost ladder + level cap (max 5) enforced server-side. | LAB-AGUANTADERO-CAP | 03.03 |
| 19 | Tutorial duration <10 min (ONB-05 ceiling): `complete_tutorial` server log line contains `tutorial_duration_ms=<n>` with `n < 600000`. | LAB-TUTORIAL-DURATION | 03.05 |
| 20 | LAB-TUTORIAL-REWARD-ATOMIC: tutorial completion grants reward atomically; second call returns idempotent_replay:true. | LAB-TUTORIAL-REWARD-ATOMIC | 03.03 |
| 21 | Vocabulary blacklist (UI-SPEC §8.5): 0 banned terms in .ts + .gd source files. | LAB-COPY-VOCABULARY | 03.04a + 03.04b + 03.05 |
| 22 | Concurrent recruit race: at most 1 of 5 concurrent picks succeeds. | LAB-RECRUIT-RACE | 03.03 |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (storage_keys mirror, validation extensions — shipped in 03.01)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (laboral-test.sh --quick targets <30s for 4 smoke tests)
- [x] `nyquist_compliant: true` set in frontmatter (done 2026-05-20 in plan 03.05)

**Approval:** approved — executor-03-05 (2026-05-20)
