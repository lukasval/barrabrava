# BarraBrava — Infrastructure Notes

> Canonical infrastructure runbook, architecture decisions, and environment notes.
> Phase 1 and Phase 2 notes live at `.planning/phases/01-foundation/INFRA-NOTES.md`.
> Phase 3+ notes are recorded here.

---

## Phase 3: Core Loop Laboral

**Plans:** 03.01 – 03.05 | **Completed:** 2026-05-20 | **Status:** Complete-with-deferral

---

### 3.1 Storage Schema (Phase 3 additions)

#### New collections (4)

| Collection | Owner | Shape | Notes |
|------------|-------|-------|-------|
| `aguantaderos` | per-user singleton | `{ level, plata, energia, pibes_uuid[], last_collected_at, upgraded_at }` | Auto-bootstrapped on first `get_aguantadero` call |
| `barra_state` | system-owned per club (`barra_state/{club_id}`) | `{ club_id, aguante_pool, mesa_chica[], lider, mesa_recompute_last_at }` | Pre-seeded at boot via `admin_seed_ai_baseline` |
| `recruit_pool` | system-owned per club (`recruit_pool/{club_id}/{yyyy-mm-dd}`) | `{ club_id, generated_at, generated_date, picks[] }` | Refreshed daily at 05:00 ART by `bb_recruit_05_art` cron |
| `turnos` | per-user append-only (`turnos/{fixture_id}`) | `{ fixture_id, pibe_ids, aguante_credited, reputacion_credited, submitted_at, idempotent_replay }` | Write-marker placed BEFORE side-effects (idempotency-first pattern) |

#### Extended fields on existing records

**`players/profile`** (extended from Phase 1):

| Field | Type | Description |
|-------|------|-------------|
| `rank` | `"pibe" \| "soldado" \| "capo" \| "mesa" \| "lider"` | Auto-promote on Rep threshold |
| `plata` | number | Personal soft currency, from idle work |
| `reputacion` | number | Personal Rep; drives rank + Mesa Chica |
| `vbc` | number | Visto Bueno Cana — Líder-only generation via "hablar cana" |
| `tutorial_done` | boolean | Gated by `complete_tutorial` step 6 |
| `tutorial_step` | number | Current onboarding step (0–6) |
| `pibes_recruited_total` | number | Lifetime recruits (rank-gated cap enforcement) |
| `pibes_migrated_at` | number | Epoch ms — Phase 1 single-pibe migration timestamp |
| `faccion` | string | Picked at onboarding (Phase 1), label-only in Phase 3 |
| `aguante_contributed_total` | number | Lifetime Aguante contributed to barra pool |
| `cantico_unlocked` | boolean | Unlocked by tutorial completion reward (ONB-06) |

**`pibes` collection**: migrated from single `main` key to multi-record keyed by UUID. Phase 1 `main` key auto-migrated on first `get_roster` call (pibes_migrated_at marker).

#### Meta / lock keys

| Key | Collection | TTL | Purpose |
|-----|------------|-----|---------|
| `KEY_RECRUIT_LOCK` | `meta` | 5 min | Distributed lock on `runRecruitRefresh` (prevents cron overlap) |
| `KEY_AI_SEED_VERSION` | `meta` | none | `"v1"` marker prevents duplicate AI seed on redeploy |
| `KEY_MESA_DEBOUNCE_{club_id}` | `meta` | none | Timestamp of last Mesa recompute (5-min debounce guard) |

---

### 3.2 RPCs Added (13 total, 28 system-wide)

**Prior phases:** Phase 1 contributed 5 RPCs; Phase 2 contributed 10 RPCs → 15 total pre-Phase 3.

#### Read RPCs (4)

| RPC | Plan | Description |
|-----|------|-------------|
| `get_roster` | 03.02 | Player profile + pibes list with lazy Energía regen projection. Phase 1 pibe migrated inline. |
| `get_aguantadero` | 03.02 | Aguantadero record with auto-bootstrap on first call (creates level=1 default). |
| `get_barra_state` | 03.02 | Club barra_state with debounced Mesa Chica recompute (~5 min window). |
| `get_recruit_pool` | 03.02 | Daily recruit picks with `trait_2_hidden: true` (D-10 redaction, reveal on recruit). |

#### Write RPCs (6)

| RPC | Plan | Description |
|-----|------|-------------|
| `assign_profession` | 03.03 | Assigns pibé to profession. Commits prior idle accrual before switch (D-01). VBC profession gated to `rank == "lider"` (D-07). |
| `collect_idle` | 03.03 | Commits lazy-computed Plata accrual. Stamps `last_collected_at`. Idempotent within same-second window. |
| `recruit_pibe` | 03.03 | Recruits from pool with optimistic concurrency (concurrent_update → `pick_already_taken`). Rank/cost/cap validated server-side. |
| `upgrade_aguantadero` | 03.03 | Upgrades level 1–5. Cost ladder: 500/1000/2000/4000 Plata. Max level 5 enforced. |
| `submit_turno` | 03.03 | Submits barra participation for open/live fixture. Idempotency-marker-first. +50 Aguante/pibé + +20 Rep/pibé (D-06). |
| `complete_tutorial` | 03.03 | Advances tutorial step 0→6. Step 6 grants reward (trapo + cántico). Logs `tutorial_duration_ms` (ONB-05). Idempotent. |

#### Admin RPCs (3)

| RPC | Plan | Description |
|-----|------|-------------|
| `admin_force_recruit_refresh` | 03.01 stub → 03.03 | Forces recruit pool refresh for all clubs (or specific club). Bypasses daily date guard when `force=true`. |
| `admin_grant_rep` | 03.01 | Grants/deducts Rep to a player. Recalculates rank post-write via `checkRankTransition`. |
| `admin_seed_ai_baseline` | 03.01 | Seeds/re-seeds AI barra_state for all 153 clubs. `force=true` clears version marker first. |

**Total RPC count after Phase 3:** 28 (`grep -c "initializer.registerRpc" nakama/src/main.ts`)

---

### 3.3 Scheduler Additions

| Leaderboard ID | Cron | ART Time | Handler |
|---------------|------|----------|---------|
| `bb_recruit_05_art` | `0 8 * * *` (UTC) | 05:00 ART | `runRecruitRefresh` — generates 3 procedural pibé picks per club, stores `recruit_pool/{club_id}/{date}` |
| `bb_mesa_recompute_1h` | `0 * * * *` (UTC) | every hour | `runMesaRecomputeAll` — recomputes Mesa Chica (top 5 by Rep) for every club |

**Cron implementation notes:**
- Both leaderboards registered in `ensureLaboralLeaderboards()` via the existing single `registerLeaderboardReset` dispatcher in `main.ts`. The dispatcher uses `else-if lb.id` branches — no second `registerLeaderboardReset` call (Goja AST gotcha from Phase 2, lesson applied).
- ART date = UTC offset constant: `new Date(now - 3*3600*1000).toISOString().slice(0,10)`. Argentina has not observed DST since 2009 (RESEARCH A9).
- `runRecruitRefresh` uses `KEY_RECRUIT_LOCK` (5-min TTL, released on completion) to prevent cron overlap across dual leaderboard triggers.

**Season hook:**
- `seasons.ts`: `detectSeasonState` now calls `electLideresForAllClubs` on `active → ended` transition.
- Election logic: per club, find highest-Rep entry in `barra_state.mesa_chica`; write as `barra_state.lider` with `season_id` and `elected_at` timestamps.
- Atomic per-club write; no cross-club transaction needed.

---

### 3.4 Lazy Compute Pattern

All resource changes in Phase 3 use lazy compute on read, committed on explicit write. This matches the Phase 2 tick pattern.

| Resource | Lazy on | Committed on | Cap / Clamp |
|----------|---------|--------------|-------------|
| Plata accrual | `get_roster` (projection only) | `collect_idle` | 12h per pibé (`last_collected_at` stamp) |
| Energía regen | `get_roster` (writes result) | `get_roster` | `[0, 100]`, +5/h offline |
| Mesa Chica | `get_barra_state` (if debounce elapsed) | `runMesaRecomputeAll` cron | Top 5 by Rep, mixed AI/human |
| AI Líder Rep | `get_barra_state` | `admin_seed_ai_baseline` | `barra_age_days * division_mult` baseline |

**Idle Plata rate formula:**
```
plata_per_ms = PROFESSION_RATES_PER_HOUR[profession] * skill_multiplier / 3_600_000
skill_multiplier = clamp(1 + (skill_hours / 100), 1, 6)   // D-05
accrued = floor(elapsed_ms * plata_per_ms)
capped = min(accrued, floor(IDLE_CAP_HOURS * rate * skill_multiplier))  // D-02
```

**Energía regen formula:**
```
regen_ms = now - last_energia_regen_at
regen_units = floor(regen_ms / 3_600_000) * 5   // +5/h, integer floor
new_energia = clamp(energia + regen_units, 0, 100)
```

**Skip-stamp idempotency:** `collect_idle` checks `last_collected_at > now - 1000ms` and returns `{plata_credited: 0, idempotent_replay: true}` within the same-second window. Prevents double-credit from rapid-fire calls (LAB-IDLE-IDEMPOTENT).

---

### 3.5 Tone + Safety Gates (App Store)

| Gate | Mechanism | Status |
|------|-----------|--------|
| Vocabulary blacklist | `LAB-COPY-VOCABULARY` in `laboral-test.sh` — greps `.ts` + `.gd` source for banned terms: `ataque, raid, pelea, atacar, robar` | Enforced on every test run |
| AI display names | Server stores `null`; UI renders "Capo de la Barra #N" — no LLM, no real barra leader names | Implemented in `ai_seed.ts` |
| Procedural pibé names | APODOS pool (15 lunfardo apodos) + NOMBRES list; no real names | Implemented in `pibe_factory.ts` |
| Trait pool | 10 traits (positive/neutral mix); no trait referencing real violence | Implemented in `pibe_factory.ts` |
| Phase 3 copy framing | "hacer turno / estar en la cancha / aguantar / laburar" — sports vocabulary, no combat | `03-UI-SPEC.md §8.5` |
| Server-authoritative resources | Client never computes Plata/Rep/Aguante/VBC; all mutations via RPC with server validation | All 6 write RPCs + 3 read RPCs |

**Manual audit command:**
```bash
grep -rE "\b(ataque|raid|pelea|atacar|robar)\b" \
  nakama/src scripts/screens scripts/components scripts/autoloads \
  --include="*.ts" --include="*.gd"
```
Expected: 0 matches.

---

### 3.6 Env Var Additions (Phase 3)

No new Railway env vars required for Phase 3 server-side. All Phase 3 features use existing `ADMIN_BEARER`, `NAKAMA_SERVER_KEY`, `DATABASE_URL`.

**Pending action (carried from Phase 2):** Rotate `ADMIN_BEARER` — current value was exposed in chat during Phase 2 debugging. Generate a new UUID and update Railway Variables before any production admin operation.

```bash
# Generate new ADMIN_BEARER
python3 -c "import uuid; print(uuid.uuid4())"
# Then: Railway → Variables → ADMIN_BEARER → update → Redeploy
```

---

### 3.7 Phase 3 → Phase 7 Deferral Notes

| Item | Blocker | Plan |
|------|---------|------|
| LAB-IDLE-CAP automated test | Requires admin storage-write endpoint to backdate `last_collected_at` | Phase 7 (Hardening) |
| LAB-IDLE-RATE-TRAPITO full assertion | Deterministic state seeding requires admin storage-write | Phase 7 (Hardening) |
| LAB-TURNO-ENERGY-GATE energy-low path | Requires admin energy-set endpoint | Phase 7 (Hardening) |
| LAB-LIDER-ELECTION automated | Requires season-end admin trigger wired to lider election verification | Phase 7 (Hardening) |
| `release_pibe` RPC | Permadeath handles pibé loss in Phase 4; no release mechanic in v1 | Phase 4 (Combate) |
| Android device build + FCM | Same as plan 02-07 deferral | Phase 7 device build |

---

*Updated: 2026-05-20 — Phase 3 Core Loop Laboral documentation complete.*
