# Phase 3: Core Loop Laboral — Research

**Researched:** 2026-05-18
**Domain:** Server-authoritative resource economy, idle accrual, daily cron, AI population, procedural generation, hierarchy state machine, Godot UI extension.
**Confidence:** HIGH on storage/RPC/cron patterns (reusing verified Phase 2 patterns). MEDIUM on AI baseline curves and procedural pibe weights (game-design dials — needs tuning). HIGH on Goja AST + Nakama storage constraints (load-bearing lessons from Phase 2).

---

## Summary

Phase 3 layers an idle-economy + roster + hierarchy system on top of Phase 2's match-window heartbeat. There is no new infrastructure to invent: every pattern needed already exists in `nakama/src/`. The phase is mostly **storage schema design + lazy-compute math + AI population priming + ~7 Godot screens**.

Three constraints dominate the shape of the work:

1. **Goja AST extractor** only walks top-level statements in `InitModule`'s body. Every new RPC and every new daily-cron hook must be registered as an inline `initializer.registerRpc(...)` / `initializer.registerLeaderboardReset(...)` expression inside `InitModule` — no helper wrappers. Phase 2 paid 3 hot-fixes for this; Phase 3 must not.
2. **Storage as DB.** No raw SQL; every entity is a JSON blob keyed under `{collection, key, userId}`. Optimistic concurrency via the `version` field on writes (the windows.ts pattern). System-owned data goes under `SYSTEM_USER_ID`; user-owned data under `ctx.userId`.
3. **Server-authoritative economy.** Client never computes Plata/Aguante/Reputación/Energía. Client triggers RPCs; RPCs do lazy compute on read using `last_tick_at` deltas and write back the new state with idempotency markers.

The phase introduces **3 net-new resources** (Plata, Aguante, Reputación, plus VBC carried forward), **4 new storage collections** (`aguantaderos`, `barra_state`, `recruit_pool`, `turnos`), **extends `pibes` to multi-record + new fields**, **8 player RPCs + 3 admin RPCs**, **1 new cron leaderboard** (`bb_recruit_05_art`), **AI baseline seeding for ~153 clubs × 5 Mesa slots**, and **~7 Godot screens**.

**Primary recommendation:** Sequence the work as 4 plans across 3 waves — (W0) storage_keys + admin helpers + AI seed + cron leaderboard registration; (W1) read-side RPCs (`get_roster`, `get_aguantadero`, `get_barra_state`, `get_recruit_pool`) + lazy-compute helpers + tutorial-completion RPC; (W2) write-side RPCs (`assign_profession`, `collect_idle`, `recruit_pibe`, `upgrade_aguantadero`, `submit_turno`) + recruit-pool refresh cron + season-end Líder hook + rank-transition writer; (W3) Godot screens + PlayerStore extension + invariant test harness.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Idle Plata accrual math | Nakama RPC (server) | — | Server-auth invariant (TEC-09). Client tampering of clock or rate is the #1 anti-cheat target. Lazy compute on read avoids cron. |
| Energía regen | Nakama RPC (server) | — | Same as Plata — clock skew exploit risk. Computed on every roster read. |
| Turno de Barra submit | Nakama RPC (server) | Postgres (via storage) | Validates window state + pibe energy + atomically credits Aguante pool + Rep. Idempotency marker on submit prevents double-credit. |
| Recruit pool refresh | Nakama scheduler (cron) | Nakama admin RPC | Daily cron at ~05:00 ART regenerates per-club pool. Admin force-refresh RPC for testing. |
| AI Mesa Chica / Líder population | Nakama scheduler (boot-time seed) | Nakama RPC (rank transition recompute) | Seeded once at boot (idempotent, similar to clubs seed). Recomputed on Rep write to displace AI when humans qualify. |
| Procedural pibe generation | Nakama RPC (server) | — | Server seeds RNG with `nk.uuidv4()` so the pool is deterministic per-day but unguessable client-side. |
| Rank threshold auto-promote | Nakama RPC (server) | Nakama scheduler (Mesa recompute) | Triggered inline on any Rep write; debounced for Mesa Chica recompute. |
| Tutorial state machine | Godot client (FlowRouter + screens) | Nakama RPC (1 completion flag) | UX-only; server stores `tutorial_done` flag and grants the trapo+cántico reward atomically. |
| Aguantadero upgrade | Nakama RPC (server) | Godot client (UI) | Server validates Plata cost + writes `level`. UI shows the 5 tiers + cost. |
| Roster + resources display | Godot client (HomeScreen + RosterScreen) | Nakama RPC (read) | PlayerStore cache + signals; refresh on `_ready` and `NOTIFICATION_APPLICATION_RESUMED` (same pattern as HomeScreen Phase 2 banner). |
| Season-end Líder election | Nakama scheduler (in seasons.ts) | Nakama RPC (per-club compute) | Hooks `season_state.status: active → ended` transition; writes `barra_state.lider`. |

---

## Standard Stack

> Phase 3 uses **zero new libraries**. Every dependency is already locked in by Phases 1-2.

### Core (already locked-in)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Nakama Server | 3.21.x | Game backend (auth, storage, RPC, scheduler) | `[VERIFIED: nakama-production-7ea8.up.railway.app live]` Phase 1+2 deployment. |
| Nakama TS runtime (Goja) | bundled | RPC + scheduler authoring | `[VERIFIED: nakama/src/main.ts compiles to IIFE via esbuild]` |
| Godot Engine | 4.3 | Client | `[VERIFIED: addons/com.heroiclabs.nakama vendored SDK v3.4.0]` |
| Nakama GDScript SDK | 3.4.0 | Client-side Nakama wrapper | Already vendored under `addons/com.heroiclabs.nakama`. |
| esbuild | bundled in build.mjs | TS → IIFE bundle | `[VERIFIED: nakama/build.mjs ships IIFE for Goja]` |
| PostgreSQL | bundled w/ Nakama | Storage backend (via Nakama Storage API) | Phase never touches raw SQL. |

### Supporting (utilities already shipped)

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `validation.ts` | `nakama/src/util/validation.ts` | Input validation patterns | Reuse for pibe name validation, integer bounds checks. `[VERIFIED]` |
| `admin_auth.ts` | `nakama/src/util/admin_auth.ts` | Constant-time bearer compare | Reuse for `admin_force_recruit_refresh`, `admin_grant_rep`, etc. `[VERIFIED]` |
| Goja IIFE bundle | `nakama/build.mjs` | Bundles TS into single IIFE for Nakama | No change needed. `[VERIFIED]` |
| `StorageKeys.gd` ↔ `storage_keys.ts` mirror | both | Source-of-truth for collection names | Add new COL_* on both sides simultaneously. CR-01 lesson. `[VERIFIED]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Lazy compute on read (idle accrual) | Active cron per-user every minute | Cron would blow up at 10k users; lazy scales with reads | Lazy — already Phase 2 pattern. `[VERIFIED]` |
| Storage JSON blobs | Separate Postgres tables via TS runtime | Nakama TS runtime has no direct SQL access; helper modules nonexistent | Storage. `[VERIFIED: Phase 1 D-05]` |
| `nk.timerCreate` for daily cron | `registerLeaderboardReset` w/ cron schedule | `nk.timerCreate` does not exist in Nakama TS runtime | `registerLeaderboardReset`. `[VERIFIED: nakama/src/scheduler/leaderboard_cron.ts]` |
| Per-AI-pibe storage records (~650 records) | Single `barra_state/{club_id}` value w/ embedded Mesa array (5 entries) | Per-record = 650 reads on any list op; embedded = 1 read per club, 1 write on displacement | **Embedded.** Phase 5 may explode this if AI gains personal state. |
| Push notification on rank transition | Defer to Phase 5 (per CONTEXT D-13 hint) | Phase 3 already wires FCM tokens — could send rank push for "free". Risk: noisy if oscillates. | **Defer to Phase 5** unless invariant test confirms stability. Cheap to add later. |

**Installation:** No new packages. Phase 3 only adds new source files under `nakama/src/rpc/`, `nakama/src/scheduler/`, `nakama/src/laboral/` (new dir for shared helpers like `idle_accrual.ts`, `pibe_factory.ts`, `ai_population.ts`).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 .. D-16)

Verbatim from `.planning/phases/03-core-loop-laboral/03-CONTEXT.md` §decisions:

**Day Cycle & Work Model**
- **D-01:** Idle generation offline. Each pibe assigned to a profession generates Plata while the player is offline. Server computes lazily on read: `accrued = (now - last_tick_at) * rate`, clamped to `idle_cap_hours`. No cron — only recompute when player opens app or executes another RPC.
- **D-02:** Idle cap = **12h per pibe**. After 12h without check-in, the pibe stops accruing. Server stamps `last_collected_at` on collection.
- **D-03:** Turno de Barra = active commit during match window. HomeScreen gains "Hacer turno" button when `current_window.state == "open" | "live"`. Modal: pibe selection → confirm → pibes locked "en turno" until `closes_at` → reward credited server-side on window close (or first read post-close, lazy).
- **D-04:** Energía per-pibe. Each pibe has `energia: int (0..100)`. Passive regen `+5/h` offline (lazy compute). Turno consumes 30-50 (Phase 3 hardcodes 40 base). Energía is NOT Plata-buyable in Phase 3.

**Resource Economy**
- **D-05:** Plata rate = base profesión × skill multiplier.
  - trapito: 10 Plata/h
  - vendedor: 15 Plata/h
  - patovica: 20 Plata/h
  - remisero: 25 Plata/h
  - "hablar cana" (Líder-only): 0 Plata/h, +1 VBC/h
  - Skill multiplier: `1 + skill_horas / 100`, clamped `[1, 6]`. 500h trabajadas = 6× base.
- **D-06:** Turno output split per pibe (energía ≥ 30 at start):
  - +50 Aguante to club pool (`barra_state.aguante_pool`)
  - +20 Reputación to owning player (`players.profile.reputacion`)
- **D-07:** VBC source único Phase 3 = "hablar cana" del Líder. Rate fijo `+1 VBC/h`. AI Líder accumulates club VBC, distributed Phase 4 to heat system.
- **D-08:** No hard daily caps. Throttle is natural via energy + idle cap + skill grind. No catch-up modifier in Phase 3.

**Recruitment Flow**
- **D-09:** Daily recruit pool refresh, 3 pibes/day per club. Server cron ~05:00 ART regenerates global club pool. Storage: `recruit_pool/{club_id}` value `{ generated_at, picks: [...3] }`. No save-for-later.
- **D-10:** Asymmetric trait reveal. Card shows `nombre, rol, avatar, trait_1`. `trait_2` hidden until recruited.
- **D-11:** Procedural infinite spawn. Server generates per pick: name (apodo + nombre), avatar (paramétrico composite), rol (weighted random), 2 traits.
- **D-12:** Recruitment cost scales by player rank. Pibe → 500 Plata, max 2 total. Soldado → 400 Plata + 100 Rep min, max 5. Capo → 300 Plata + 500 Rep min, max 10. Mesa/Líder → 200 Plata + 1000 Rep min, max 20. Roster cap depends on **aguantadero level** (5/8/12/16/20), not rank.

**Hierarchy**
- **D-13:** Auto-promote by Rep threshold. Pibe→Soldado 500 Rep. Soldado→Capo 2500 Rep. Capo→Mesa top 5 by Rep (displace lowest). Mesa→Líder highest Rep at season-end. Demote possible if falls out of top 5.
- **D-14:** Mesa Chica = top 5 mixto AI/humano. AI ids prefix `ai_{club_id}_{slot}`. Recompute on Rep change (debounced ~5 min). AI baseline scales with `barra_age_days`.
- **D-15:** Líder = highest Rep at season-end AFA. Trigger: `season_state.status: active → ended` in `seasons.ts`. v1 = pure threshold, no challenge/vote.
- **D-16:** Factions internas visible only (label en perfil). No Capo de Facción, sin drama, sin votos. JER-05..07 defer to Phase 5.

### Claude's Discretion (researcher fills these)

Verbatim from CONTEXT §"Claude's Discretion":
- Storage schema details for each new collection — **resolved §Storage Schema below**.
- Idempotency markers for turno/recruit/upgrade — **resolved §RPC Surface**.
- RPC naming — **locked §RPC Surface**.
- Server-side input validation — **resolved §RPC Surface + §Common Pitfalls**.
- Godot screen layout — **deferred to plan (UI-SPEC concern)**.
- AI baseline Rep curve — **proposed §AI Population Strategy**.
- Tutorial scripted state machine — **proposed §Tutorial Scripting**.
- Avatar composition paramétrica vs preset — **proposed §Procedural Pibe Generation**.
- Procedural name list — **proposed §Procedural Pibe Generation**.
- Trait pool list completa — **proposed §Procedural Pibe Generation**.
- Plata/Rep/Aguante starting balance — **proposed 0/0/0 with tutorial reward**.

### Deferred Ideas (OUT OF SCOPE — DO NOT plan)

Verbatim from CONTEXT §deferred:

**To Phase 4 (Combate Estratégico):**
- PIB-08 permadeath. HEA-01..05 heat/cana/abogado. VBC consumption. Loadout/formation multipliers. AIB-01..05 IA combate behaviors.

**To Phase 5 (Mundo Social):**
- JER-05..07 facciones drama. Mesa Chica acciones reales. Líder challenge mid-season. Push notification de rank transition. Cronista LLM. Recruit shared pool con AI muertos. Recruit geographic. Catch-up modifier.

**To Phase 6 (Monetización):**
- Cosmetics shop wired. Drops sincronizados realidad. Battle Pass rewards.

**To v1.1 / Post-Launch:**
- JER-04 elección activa Líder + voto. Tradeoff Plata↔VBC. Daily cap on Rep. A/B trait reveal. Negociar dirigentes / conseguir entradas mechanical effects.

---

## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|------------------------------------|------------------|
| **AGT-01** | Cada player tiene aguantadero (HQ) en barrio real del club | `aguantaderos/{userId}` singleton; `barrio_hq` reads from `clubs/{club_id}.barrio_hq`. §Storage Schema. |
| **AGT-02** | Aguantadero niveles upgradeables (capacidad, almacén, bandera, defensa) | 5-level ladder; capacity → roster cap mapping `5/8/12/16/20`. §RPC Surface `upgrade_aguantadero`. |
| **AGT-03** | Recursos: Plata, Aguante, Reputación, VBC | Plata + Reputación in `players/profile`. Aguante grupal in `barra_state/{club_id}.aguante_pool`. VBC personal in `players/profile.vbc`. §Storage Schema. |
| **AGT-04** | Generación pasiva de Aguante según nivel + turnos | Aguante gen: passive `+5/h × aguantadero_level` (Phase 3 confirm with planner) + +50/pibe-en-turno-exitoso. §Lazy Compute. |
| **AGT-05** | Bandera room muestra trapos robados | Phase 3 ships **empty bandera-room UI** (placeholder). Phase 4 wires the trapo data. UI table in §Godot UI. |
| **PIB-01** | Roster max 5 inicial, escala con rango hasta 20 | Roster cap by aguantadero level (D-12 modifies: rank gates COST/Rep min, capacity gates SIZE). §Lazy Compute roster cap calc. |
| **PIB-02** | Roles tácticos: trompada, aguantador, corredor, vigía, líder, pirotécnico, abogado, viejo | Weighted role table in §Procedural Pibe Generation. |
| **PIB-03** | 1-2 traits aleatorios | Trait pool §Procedural Pibe Generation. Asymmetric reveal (D-10). |
| **PIB-04** | Profesiones disponibles + tareas del Líder | trapito/vendedor/patovica/remisero + Líder-only "hablar cana" → VBC. §RPC Surface `assign_profession`. |
| **PIB-05** | Trabajo día sin partido genera Plata personal | Idle accrual algorithm §Lazy Compute. |
| **PIB-06** | Turno de Barra día partido consume Energía → Aguante grupal + Rep personal | `submit_turno` RPC §RPC Surface; ventana validation hooks Phase 2 `match_windows`. §Turno Mechanic. |
| **PIB-07** | Skills desbloqueables por horas trabajadas | Skill grind: each accrual bumps `skill_{profession}_hours`; multiplier `clamp(1 + h/100, 1, 6)`. §Lazy Compute. |
| **JER-01** | Niveles: Pibe → Soldado → Capo → Mesa Chica → Líder | §Rank Transition System. |
| **JER-02** | Promoción por Rep + voto Mesa (Phase 3: pure Rep threshold, voto defers v1.1) | Threshold table §Rank Transition System. |
| **JER-03** | Mesa Chica = top 5 by Rep, vota uso pozo + targets (Phase 3: label-only, voting defers Phase 5) | Mesa recompute §AI Population Strategy. Voting deferred. |
| **JER-04** | Líder elegido cada season AFA por Rep (Phase 3: pure threshold, challenge defers v1.1) | Hook in `seasons.ts` on `active → ended`. §Rank Transition System. |
| **ONB-05** | Tutorial primera salida <10 min | §Tutorial Scripting. |
| **ONB-06** | Recompensa primera sesión (trapo + cántico) | `complete_tutorial` RPC writes `players/profile.tutorial_done=true` + grants reward atomically. §Tutorial Scripting. |

---

## System Architecture Diagram

```
                          ┌───────────────────────────────┐
                          │     GODOT 4.3 CLIENT          │
                          │                                │
   HomeScreen ──[on resume]→ get_roster + get_aguantadero +
       │                    │  get_barra_state + get_current_window
       │                    │                                │
       ├─["Reclutar"]────→ RecruitScreen ─→ recruit_pibe RPC
       │                    │
       ├─["Trabajar"]────→ ProfessionAssign ─→ assign_profession RPC
       │                    │                                │
       ├─["Cobrar"]──────→ collect_idle RPC ──┐              │
       │                    │                 │              │
       ├─["Hacer turno"]──→ TurnoModal ──→ submit_turno RPC  │
       │                    │ (only if window open|live)     │
       │                    │                                │
       ├─["Aguantadero"]──→ AguantaderoScreen ─→ upgrade_aguantadero RPC
       │                    │                                │
       └─["Tutorial"]─────→ TutorialScreen ─→ complete_tutorial RPC
                          │                                │
                          └───────┬───────────────────────┘
                                  │ RPC (HTTPS, Nakama session token)
                          ┌───────▼────────────────────────────────────┐
                          │           NAKAMA TS RUNTIME (Goja IIFE)     │
                          │                                              │
                          │  ┌──────────────── RPCs ────────────────┐   │
                          │  │ Player:                              │   │
                          │  │   get_roster, get_aguantadero,       │   │
                          │  │   get_barra_state, get_recruit_pool, │   │
                          │  │   assign_profession, collect_idle,   │   │
                          │  │   recruit_pibe, upgrade_aguantadero, │   │
                          │  │   submit_turno, complete_tutorial    │   │
                          │  │ Admin:                               │   │
                          │  │   admin_force_recruit_refresh,       │   │
                          │  │   admin_grant_rep,                   │   │
                          │  │   admin_seed_ai_baseline             │   │
                          │  └──────────────┬───────────────────────┘   │
                          │                 │                            │
                          │  ┌──────────────▼───────────────────────┐   │
                          │  │ shared/laboral helpers (NOT RPCs):   │   │
                          │  │  - lazy_accrue_idle(pibe, now)       │   │
                          │  │  - lazy_regen_energia(pibe, now)     │   │
                          │  │  - check_rank_transition(profile)    │   │
                          │  │  - recompute_mesa(club_id)           │   │
                          │  │  - generate_pibe(seed, club_id)      │   │
                          │  └──────────────┬───────────────────────┘   │
                          │                 │                            │
                          │  ┌──────────────▼───────────────────────┐   │
                          │  │ Scheduler (cron via leaderboards):   │   │
                          │  │  bb_tick_15m / bb_tick_6h (Phase 2)  │   │
                          │  │  bb_recruit_05_art (NEW Phase 3)     │   │
                          │  │  bb_mesa_recompute (NEW, 1/h)        │   │
                          │  │  seasons.ts hooks Líder election     │   │
                          │  └──────────────┬───────────────────────┘   │
                          └─────────────────┼────────────────────────────┘
                                            │
                          ┌─────────────────▼────────────────────────────┐
                          │           POSTGRES (via Nakama Storage)      │
                          │                                              │
                          │  COL_PIBES         (per-user, multi-record)  │
                          │  COL_PLAYERS       (per-user singleton)      │
                          │  COL_AGUANTADEROS  (per-user singleton)      │  NEW
                          │  COL_BARRA_STATE   (system-owned per club)   │  NEW
                          │  COL_RECRUIT_POOL  (system-owned per club)   │  NEW
                          │  COL_TURNOS        (per-user, append-only)   │  NEW
                          │  COL_MATCH_WINDOWS (Phase 2 — read for turno)│
                          │  COL_META          (system; KEY_CURRENT_SEASON, recruit_lock, etc.) │
                          └──────────────────────────────────────────────┘
```

**Trace the primary use case (player makes a turno on match day):**

1. Player opens app → HomeScreen `_ready` → `get_current_window` returns `{state: "open"}`.
2. HomeScreen shows "Hacer turno" button. Press → `TurnoModal.tscn`.
3. Modal calls `get_roster` → server runs `lazy_accrue_idle` + `lazy_regen_energia` for each pibe, returns updated state.
4. User picks 3 pibes with `energia ≥ 30`. Confirms.
5. Client calls `submit_turno({fixture_id, pibe_ids:[...]})`.
6. Server: re-reads `match_windows/{fixture_id}` (must be `open|live`), re-reads pibes (must have energy), writes idempotency marker `turnos/{userId}_{fixture_id}` → 200 if already submitted (returns prior result); else atomic update of pibes (energy -40, status="en_turno") + idempotent credit to `barra_state.aguante_pool` (+50/pibe) + `players/profile.reputacion` (+20/pibe).
7. `check_rank_transition` runs inline; if Rep crossed threshold, writes new rank + queues `mesa_recompute_pending=true` on `barra_state`.
8. Response returns `{aguante_credited, rep_credited, new_rank?: "soldado", pibes_left_en_turno: [...]}` → HomeScreen refreshes widgets.

---

## Storage Schema

> **WR-08 / CR-01 invariant:** Every new collection added in `storage_keys.ts` MUST be mirrored in `scripts/autoloads/StorageKeys.gd` for any collection the **client reads directly**. Server-internal collections (locks, audit logs, recruit pool internals) may be omitted from the GD mirror — keep mirror tight (Phase 2 lesson).

### Constants to Add

**`nakama/src/storage_keys.ts` additions:**

```typescript
// Phase 3: Core Loop Laboral
export const COL_AGUANTADEROS = 'aguantaderos';
export const COL_BARRA_STATE = 'barra_state';      // system-owned per-club
export const COL_RECRUIT_POOL = 'recruit_pool';    // system-owned per-club
export const COL_TURNOS = 'turnos';                // per-user, append-only

// KEY_PIBE_MAIN already exists (Phase 1 single-pibe slot).
// Phase 3 multi-pibe: keys = pibe.id (UUID v4) directly.

export const KEY_AGUANTADERO_MAIN = 'main';        // singleton per user
export const KEY_RECRUIT_LOCK = 'recruit_lock';    // meta key for cron mutex
export const KEY_MESA_DEBOUNCE_PREFIX = 'mesa_debounce_';  // meta:mesa_debounce_{club_id}
export const KEY_AI_SEED_VERSION = 'ai_seed_version';      // meta key — idempotent AI seed marker (analog to CLUBS_SEED_VERSION)
```

**`scripts/autoloads/StorageKeys.gd` mirror additions** (only client-read collections):

```gdscript
# Phase 3 additions
const COL_AGUANTADEROS := "aguantaderos"
const COL_BARRA_STATE := "barra_state"
const COL_RECRUIT_POOL := "recruit_pool"
# COL_TURNOS — client never reads directly (goes via submit_turno + get_roster), skip mirror.
const KEY_AGUANTADERO_MAIN := "main"
```

### Collection: `pibes` (Phase 1 → Phase 3 extension)

**Migration:** Phase 1 stored ONE pibe at fixed key `main`. Phase 3 multi-pibe stores at key = `pibe.id` (UUID). The Phase 1 record at key `main` needs migration — proposed: on first `get_roster` call post-deploy, if `pibes/main` exists for the user, copy it to `pibes/{its.id}` and delete `pibes/main`. Mark migrated via `players/profile.pibes_migrated_at`. Idempotent.

**Per-pibe value shape:**

```json
{
  "id": "uuid-v4",
  "name": "El Tano Russo",
  "club_id": "boca_juniors",
  "rol": "trompada",
  "trait_1": "Cabezon",
  "trait_2": "Aguantador",
  "avatar": {
    "pelo": "rapado",
    "remera": "tricolor_3",
    "accesorio": "gorra"
  },
  "stats": {
    "aguante": 50,
    "velocidad": 50,
    "astucia": 50,
    "carisma": 50
  },
  "energia": 100,
  "energia_last_tick_at": 1747584000000,
  "profession": "trapito",
  "profession_started_at": 1747584000000,
  "last_collected_at": 1747584000000,
  "skills": {
    "trapito_hours": 0,
    "vendedor_hours": 0,
    "patovica_hours": 0,
    "remisero_hours": 0,
    "hablar_cana_hours": 0
  },
  "en_turno_until": null,
  "created_at": 1747584000000
}
```

- **permissionRead: 1** (owner only) — Phase 3 keeps roster private; Phase 5 may flip to public for "Top Boys".
- **permissionWrite: 0** (server-only via RPC).
- **Energy regen is independent from profession** — pibe in "rest" mode (`profession: null`) still regens. The `last_tick_at` lives on the pibe for energy; `last_collected_at` is profession-specific (Plata).
- **`en_turno_until`** non-null while pibe is locked in an active match window. Energy regen continues but pibe cannot be assigned a new turno.

### Collection: `players` (Phase 1 → extension)

Phase 1 stored `{display_name, club_id, pibe_id, created_at}`. Phase 3 adds resource fields.

```json
{
  "display_name": "Lucas",
  "club_id": "boca_juniors",
  "faccion": "zona_sur",
  "pibe_id": "<DEPRECATED — use pibes list>",
  "created_at": 1747584000000,
  "rank": "pibe",
  "rank_changed_at": 1747584000000,
  "plata": 0,
  "reputacion": 0,
  "vbc": 0,
  "aguante_contributed_total": 0,
  "tutorial_done": false,
  "tutorial_step": 0,
  "pibes_migrated_at": null,
  "pibes_recruited_total": 1
}
```

- **rank ∈ `"pibe" | "soldado" | "capo" | "mesa" | "lider"`** — single string, server-authoritative.
- **`pibes_recruited_total`** is the lifetime counter for D-12 rank gate (max 2/5/10/20).
- **`aguante_contributed_total`** is purely cosmetic for v1.1 "Top Boys" leaderboard; tracked from Phase 3 so the history exists when needed.
- **`pibe_id` field deprecated** — kept null for migration safety; never read by Phase 3 RPCs.
- **permissionRead: 2** (public — required for Mesa Chica display, "Top Boys" v1.1, and inter-player feed Phase 5). **No secrets in this blob.**
- **permissionWrite: 0** (server-only).

### Collection: `aguantaderos` (NEW)

**Key:** `KEY_AGUANTADERO_MAIN = "main"` (singleton per user).

```json
{
  "user_id": "<uuid>",
  "club_id": "boca_juniors",
  "barrio_hq": "La Boca",
  "level": 1,
  "roster_cap": 5,
  "almacen_cap": 1000,
  "bandera_room_slots": 0,
  "defensa_rating": 0,
  "upgraded_at": null,
  "created_at": 1747584000000,
  "trapos_robados": []
}
```

- **Level table** (Phase 3 dial): `{1: {roster:5, almacen:1000, bandera:0, defensa:0, cost:0}, 2: {roster:8, almacen:2500, bandera:1, defensa:10, cost:5000}, 3: {roster:12, almacen:6000, bandera:3, defensa:25, cost:15000}, 4: {roster:16, almacen:12000, bandera:6, defensa:50, cost:40000}, 5: {roster:20, almacen:25000, bandera:12, defensa:100, cost:100000}}`. Tuning is a planner concern; the table above is starting point.
- **`trapos_robados`** is a placeholder array (empty in Phase 3; Phase 4 raids populate it).
- **`barrio_hq`** is denormalized from `clubs/{club_id}.barrio_hq` at aguantadero creation — saves a join on every read. AGT-01.
- **permissionRead: 1** (owner). Phase 5 may flip to 2 for public bandera-room display.
- **permissionWrite: 0**.

### Collection: `barra_state` (NEW — system-owned per club)

**`userId: SYSTEM_USER_ID`** (analog to `clubs`, `match_windows`).
**Key:** `club_id` (e.g., `boca_juniors`).

```json
{
  "club_id": "boca_juniors",
  "aguante_pool": 12450,
  "aguante_pool_last_tick_at": 1747584000000,
  "mesa_chica": [
    { "kind": "human", "player_id": "uuid-1", "display_name": "Lucas", "reputacion": 3200 },
    { "kind": "ai",    "ai_id": "ai_boca_juniors_2", "reputacion": 2900 },
    { "kind": "ai",    "ai_id": "ai_boca_juniors_3", "reputacion": 2700 },
    { "kind": "ai",    "ai_id": "ai_boca_juniors_4", "reputacion": 2500 },
    { "kind": "ai",    "ai_id": "ai_boca_juniors_5", "reputacion": 2300 }
  ],
  "lider": {
    "kind": "ai",
    "ai_id": "ai_boca_juniors_1",
    "display_name": null,
    "reputacion": 3500,
    "elected_at": 1747584000000,
    "season_id": 2025
  },
  "barra_age_days": 0,
  "ai_seeded_at": 1747584000000,
  "mesa_recompute_pending": false,
  "mesa_recompute_last_at": 1747584000000,
  "lider_vbc_balance": 0,
  "lider_vbc_last_tick_at": 1747584000000
}
```

- **`aguante_pool`** is the **grupal Aguante** (AGT-04). Passive `+5/h × max(aguantadero_level_in_club)` is **deferred** in Phase 3 — focus on turno-driven Aguante only (D-06: +50/pibe/turno-exitoso). The `aguante_pool_last_tick_at` field reserves the slot for v1.1 if passive needed.
- **`mesa_chica`** is the embedded array of 5. Order is by Rep DESC. Recompute logic §AI Population Strategy.
- **`lider`** singleton — either AI or human. `season_id` ties election to season so we can detect "needs re-election" on `seasons.ts` transitions.
- **`barra_age_days`** drives AI baseline Rep curve (D-14). Set at seed time, advances passively on each tick (computed `floor((now - ai_seeded_at) / 86400000)` on read).
- **`lider_vbc_balance`** holds Líder's VBC when Líder is AI (D-07: AI Líder accumulates club VBC for Phase 4 heat distribution).
- **permissionRead: 2** (public — RosterScreen "Mesa Chica" tab + clubdir).
- **permissionWrite: 0**.

### Collection: `recruit_pool` (NEW — system-owned per club)

**`userId: SYSTEM_USER_ID`**.
**Key:** `club_id`.

```json
{
  "club_id": "boca_juniors",
  "generated_at": 1747584000000,
  "generated_date_art": "2026-05-18",
  "expires_at": 1747670400000,
  "picks": [
    {
      "pick_id": "uuid-v4-1",
      "name": "El Tano Russo",
      "rol": "aguantador",
      "trait_1": "Cabezon",
      "trait_2_hidden": "Buchon",
      "avatar": { "pelo": "largo", "remera": "tricolor_1", "accesorio": "ninguno" },
      "stats_preview": { "aguante": 60, "velocidad": 45, "astucia": 50, "carisma": 50 }
    },
    { "pick_id": "...", "...": "..." },
    { "pick_id": "...", "...": "..." }
  ]
}
```

- **`generated_date_art`** is the canonical idempotency key for daily refresh. Cron computes "today in ART" once at top of run, then for each club: skip-write if existing record's `generated_date_art` equals today. This means the cron can re-run safely (e.g., admin force-refresh) without regenerating.
- **`trait_2_hidden`** — server returns this on `get_recruit_pool` AS `trait_2_hidden: true` (boolean flag, not the value). On `recruit_pibe`, the server materializes the actual trait value into the pibe record. **Never send the actual value in `get_recruit_pool` response** (anti-cheat — D-10 trait reveal must be server-authoritative).
- **`pick_id`** is independent from final `pibe.id` (which is minted on recruit). Prevents "select this pick" race attacks across the daily refresh boundary.
- **permissionRead: 2** (public — same pool for all players of the club).
- **permissionWrite: 0**.

### Collection: `turnos` (NEW — per-user append-only)

**`userId: ctx.userId`**.
**Key:** `{fixture_id}` — one record per user per fixture (idempotency marker; double-submit returns prior result).

```json
{
  "fixture_id": "afa_2025_fecha_12_boca_river",
  "user_id": "uuid",
  "submitted_at": 1747584000000,
  "pibe_ids": ["pibe-uuid-1", "pibe-uuid-2", "pibe-uuid-3"],
  "energia_consumed_per_pibe": 40,
  "aguante_credited": 150,
  "reputacion_credited": 60,
  "status": "submitted",
  "claimed_at": null
}
```

- **`status ∈ "submitted" | "claimed" | "voided"`**. `submit_turno` writes `submitted`; on window close (or first read post-close), `claimed_at` stamps and `status → "claimed"` and the reward is finalized (energy already deducted at submit; this is the moment we attribute the final reward in case a Phase 5 modifier wants to retroactively boost based on match result).
- **`voided`** reserved for admin reversal (e.g., AFA cancels match after turno submission). Phase 3 doesn't auto-void; admin RPC can.
- **Key = fixture_id** means a user can only submit ONE turno per match. Re-submitting returns the prior result via the standard "exists check first" pattern in `submit_turno`.
- **permissionRead: 1** (owner). v1.1 may add public for replays.
- **permissionWrite: 0**.

### Collection: `meta` (Phase 2 → extension)

**New keys under `userId: SYSTEM_USER_ID`:**

| Key | Purpose | TTL semantics |
|-----|---------|---------------|
| `KEY_RECRUIT_LOCK` = `recruit_lock` | Mutex for daily refresh cron (analog to `KEY_TICK_LOCK`) | 5 min TTL via `acquired_at` check |
| `KEY_MESA_DEBOUNCE_PREFIX + club_id` | Per-club debounce stamp for Mesa recompute | 5 min debounce |
| `KEY_AI_SEED_VERSION` = `ai_seed_version` | Idempotent AI baseline seed marker (`{seeded: true, version: "v1", at: ms}`) | persistent |

---

## RPC Surface

> **Goja AST constraint:** Every `initializer.registerRpc(...)` MUST be an inline ExpressionStatement in `InitModule`'s body. No wrapper functions. Phase 3 adds 11 RPCs — all 11 lines are inline-registered in `main.ts` immediately after the Phase 2 block.

### Player RPCs (10)

| RPC | Input | Output | Side effects | Idempotency |
|-----|-------|--------|--------------|-------------|
| `get_roster` | `{}` | `{ok, pibes: PibeView[], pibes_count, roster_cap}` | Lazy compute idle accrual + energy regen on each pibe; writes pibes back if any state changed; runs `check_rank_transition`. | Pure read on second call within 1 second (idle_delta ≈ 0). |
| `get_aguantadero` | `{}` | `{ok, aguantadero, next_level_cost?}` | None (read-only). | Pure read. |
| `get_barra_state` | `{club_id?: string}` (defaults to caller's club) | `{ok, barra_state}` | Updates `barra_age_days` if Mesa recompute is due (debounce 5min). | Idempotent within debounce window. |
| `get_recruit_pool` | `{}` | `{ok, picks: PickView[], expires_at}` | None. **Filters `trait_2` to `trait_2_hidden: true`** — never leaks value. | Pure read. |
| `assign_profession` | `{pibe_id, profession: "trapito"|"vendedor"|"patovica"|"remisero"|"hablar_cana"|null}` | `{ok, pibe}` | Lazy-accrues current profession (writes `last_collected_at`) BEFORE switching. Validates Líder gate for "hablar_cana". | Switching to same profession is no-op + returns current state. |
| `collect_idle` | `{pibe_id?: string}` (omit → collect all) | `{ok, plata_credited, vbc_credited?, per_pibe: [{pibe_id, plata, hours_worked}]}` | Atomically reads pibes, computes accrual, stamps `last_collected_at = now`, increments `players/profile.plata` + `vbc`, increments `skills.{profession}_hours` on each pibe. | Re-collect within seconds = ≈ 0 because `last_collected_at` was stamped. |
| `recruit_pibe` | `{pick_id}` | `{ok, pibe}` | Validates: pick exists in today's pool, player has Plata + Rep minimum (D-12), player hasn't exceeded lifetime cap (D-12), roster size < `roster_cap`. Mints `pibe.id = nk.uuidv4()`. Materializes `trait_2`. Atomically deducts Plata. Increments `pibes_recruited_total`. **Removes pick from pool** (write back recruit_pool with pick removed — prevents second player from grabbing same pick in race). | Critical race: see §Common Pitfalls. Uses optimistic concurrency on recruit_pool write. |
| `upgrade_aguantadero` | `{target_level}` | `{ok, aguantadero}` | Validates `target_level == current+1`, sufficient Plata, deducts atomically, writes new level + capacities. | Returns current state if target == current (no-op). |
| `submit_turno` | `{fixture_id, pibe_ids: string[]}` | `{ok, aguante_credited, reputacion_credited, pibes_left_en_turno, new_rank?}` | Validates window state `open|live`, validates pibes have `energia ≥ 30` AND not already `en_turno`. **Writes `turnos/{fixture_id}` FIRST** (idempotency marker). Then atomically: pibes (-40 energia, en_turno_until = window.closes_at) + barra_state.aguante_pool (+50 × N) + players.profile.reputacion (+20 × N). Triggers `check_rank_transition`. | Re-submit returns prior result from `turnos/{fixture_id}`. |
| `complete_tutorial` | `{step: int}` | `{ok, reward?: {trapo, cantico}}` | If `step == FINAL_STEP` and `tutorial_done == false`: sets `tutorial_done = true`, grants reward (writes first-trapo to `aguantaderos.trapos_robados[]` placeholder + first-cántico flag on profile). | Re-complete returns prior reward state, no double-grant. |

### Admin RPCs (3)

| RPC | Input | Effect | Used for |
|-----|-------|--------|----------|
| `admin_force_recruit_refresh` | `{club_id?: string}` (omit → all clubs) | Forces immediate recruit pool regen for one/all clubs, bypasses cron schedule. Resets `generated_date_art`. | Testing recruit invariants. |
| `admin_grant_rep` | `{user_id, delta_rep, reason}` | Adds Rep to a specific user, triggers `check_rank_transition`. Audited in `admin_actions`. | Tutorial reward backstop, balance testing, AI displacement tests. |
| `admin_seed_ai_baseline` | `{force?: bool}` | Idempotent: seeds AI Mesa+Líder for every club. With `force=true` re-seeds even if marker present. | One-time bootstrap after Phase 3 deploy; testing. |

All admin RPCs gated by `requireAdmin(ctx, logger)` (Phase 2 pattern). All write to `COL_ADMIN_ACTIONS` audit log.

### `main.ts` Registration Block (inline, AST-safe)

```typescript
// inside InitModule, immediately after Phase 2 block — each MUST be a direct
// ExpressionStatement at the InitModule body level (Goja AST extractor walks
// ONLY top-level statements; do not wrap in helper).
initializer.registerRpc('get_roster', rpcGetRoster);
initializer.registerRpc('get_aguantadero', rpcGetAguantadero);
initializer.registerRpc('get_barra_state', rpcGetBarraState);
initializer.registerRpc('get_recruit_pool', rpcGetRecruitPool);
initializer.registerRpc('assign_profession', rpcAssignProfession);
initializer.registerRpc('collect_idle', rpcCollectIdle);
initializer.registerRpc('recruit_pibe', rpcRecruitPibe);
initializer.registerRpc('upgrade_aguantadero', rpcUpgradeAguantadero);
initializer.registerRpc('submit_turno', rpcSubmitTurno);
initializer.registerRpc('complete_tutorial', rpcCompleteTutorial);
initializer.registerRpc('admin_force_recruit_refresh', rpcAdminForceRecruitRefresh);
initializer.registerRpc('admin_grant_rep', rpcAdminGrantRep);
initializer.registerRpc('admin_seed_ai_baseline', rpcAdminSeedAiBaseline);

// NEW cron leaderboards — same Phase 2 pattern, MUST be inline-registered:
ensureLaboralLeaderboards(nk, logger);  // creates bb_recruit_05_art + bb_mesa_recompute_1h
// The single onSchedulerLeaderboardReset hook in Phase 2 already dispatches by
// lb.id, so we extend it to recognize 'bb_recruit_05_art' and 'bb_mesa_recompute_1h'.
// No second registerLeaderboardReset call needed.
```

**Critical:** Phase 2's `onSchedulerLeaderboardReset` already exists and dispatches by `lb.id`. Phase 3 EXTENDS it with two new `if (lb.id === 'bb_recruit_05_art')` / `=== 'bb_mesa_recompute_1h'` branches. We do NOT call `registerLeaderboardReset` again — the existing single registration handles all cron leaderboards.

---

## Lazy Compute Patterns

> Every lazy compute follows the **read-modify-write w/ optimistic concurrency** pattern from `nakama/src/scheduler/windows.ts`: read with version, mutate, write back with `version: existing.version`, swallow `concurrent_update` errors (will retry next read).

### Idle Plata Accrual

**Trigger:** every `get_roster` / `collect_idle` / `assign_profession` call iterates pibes.

```typescript
// nakama/src/laboral/idle_accrual.ts (NEW)
const IDLE_CAP_MS = 12 * 3600 * 1000; // D-02: 12h
const PROFESSION_RATES_PER_HOUR: { [k: string]: { plata: number; vbc: number } } = {
  trapito:     { plata: 10, vbc: 0 },
  vendedor:    { plata: 15, vbc: 0 },
  patovica:    { plata: 20, vbc: 0 },
  remisero:    { plata: 25, vbc: 0 },
  hablar_cana: { plata: 0,  vbc: 1 },
};

export function accrueIdleForPibe(pibe: PibeRecord, now: number): {
  plata_delta: number;
  vbc_delta: number;
  hours_worked: number;
} {
  if (!pibe.profession) return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  const last = pibe.last_collected_at || pibe.profession_started_at || now;
  const elapsed_ms_uncapped = now - last;
  if (elapsed_ms_uncapped <= 0) return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  const elapsed_ms = Math.min(elapsed_ms_uncapped, IDLE_CAP_MS);  // D-02 cap
  const hours = elapsed_ms / 3600000;
  const rates = PROFESSION_RATES_PER_HOUR[pibe.profession];
  if (!rates) return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  const skillKey = pibe.profession + '_hours';
  const skillHours = pibe.skills[skillKey] || 0;
  const multiplier = Math.min(6, 1 + skillHours / 100); // D-05 clamp
  const plata = Math.floor(rates.plata * hours * multiplier);
  const vbc = Math.floor(rates.vbc * hours * multiplier);
  return { plata_delta: plata, vbc_delta: vbc, hours_worked: hours };
}
```

**Invariants this guarantees:**

1. **Idempotency:** calling `accrueIdleForPibe` twice within the same millisecond returns ≈ 0 the second time (`elapsed_ms ≈ 0`).
2. **Cap enforcement:** No matter how long offline, max 12h × rate × multiplier per check-in.
3. **Skill grind ties to actual hours_worked** (not capped hours). This is intentional: leaving the app off for 24h gives you 12h of Plata but you'd argue 24h of "experience" — Phase 3 chooses to credit skill only for collected hours to prevent skill-farm exploits. **Decision: skill increments use `hours` (post-cap), so skill grind matches Plata earnings.**
4. **Clock skew:** All `now` comes from `Date.now()` (server). Client clock irrelevant.

### Energía Regen

**Trigger:** same as accrual — every read.

```typescript
const ENERGIA_REGEN_PER_HOUR = 5; // D-04
const ENERGIA_MAX = 100;

export function regenEnergia(pibe: PibeRecord, now: number): number {
  const last = pibe.energia_last_tick_at || now;
  const elapsed_h = (now - last) / 3600000;
  if (elapsed_h <= 0) return pibe.energia;
  const regenerated = Math.min(ENERGIA_MAX, pibe.energia + Math.floor(elapsed_h * ENERGIA_REGEN_PER_HOUR));
  return regenerated;
}
```

Note: Energía regens for ALL pibes (independent of profession). Pibe `en_turno` still regenerates passively until `en_turno_until` clears — design choice to keep things simple.

### Rank Threshold Check

Inline after every Rep-mutating RPC:

```typescript
// nakama/src/laboral/rank.ts (NEW)
const THRESHOLDS = { soldado: 500, capo: 2500 };

export function checkRankTransition(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  profile: PlayerProfile,
  userId: string,
): { transitioned: boolean; new_rank?: string } {
  const rep = profile.reputacion;
  let target = profile.rank;
  if (profile.rank === 'pibe' && rep >= THRESHOLDS.soldado) target = 'soldado';
  if ((profile.rank === 'pibe' || profile.rank === 'soldado') && rep >= THRESHOLDS.capo) target = 'capo';
  // Mesa/Líder transitions are NOT decided here — they live in mesa recompute + season-end hook.
  if (target === profile.rank) return { transitioned: false };
  profile.rank = target;
  profile.rank_changed_at = Date.now();
  // Write happens in the caller's atomic block — don't write here (avoids double-writes).
  // Mark club's barra_state.mesa_recompute_pending so the next mesa cron picks it up.
  markMesaRecomputePending(nk, logger, profile.club_id);
  return { transitioned: true, new_rank: target };
}
```

**Demote** (Mesa → Capo when displaced) happens in `recompute_mesa` exclusively, never in `checkRankTransition`. Avoids race conditions.

### Mesa Chica Recompute (Debounced)

**Trigger:** marked `mesa_recompute_pending=true` by any Rep-mutating path. Recomputed by:
- `bb_mesa_recompute_1h` cron (every hour walks all `barra_state` records and drains pending flags).
- On every `get_barra_state` read, if `mesa_recompute_pending && now - mesa_recompute_last_at > 5min`, recompute inline.

**Algorithm:**

```typescript
// nakama/src/laboral/mesa.ts (NEW)
export function recomputeMesa(nk, logger, clubId: string): void {
  // 1. Read existing barra_state.
  // 2. Build candidate list: all humans of this club (storageList COL_PLAYERS + filter club_id) + 5 AI ids.
  //    AI Rep curve: ai_baseline_rep(slot, barra_age_days).
  // 3. Sort by reputacion DESC.
  // 4. Take top 5. If a human enters, displace lowest AI (or another human with lower Rep).
  // 5. For HUMAN demote (Mesa → Capo): write players/profile.rank = "capo" + rank_changed_at = now.
  // 6. For HUMAN promote (Capo → Mesa): write profile.rank = "mesa".
  // 7. Update barra_state.mesa_chica + mesa_recompute_last_at + mesa_recompute_pending=false.
}
```

**Cost analysis:** for a club with 0-10 humans, walking `players` filtered by club_id is cheap (storageList page of 100, expect 1 page). 153 clubs × ~10 humans worst case = 1530 reads on hourly cron — well within budget. Phase 5 may add a per-club index if humans/club exceed 100.

---

## Daily Cron — Recruit Pool Refresh

**Cadence:** Once daily at ~05:00 ART (`-03:00` UTC = `08:00 UTC`). Cron string: `0 8 * * *` (UTC).

**Why 05:00 ART:** Matches AFA daily reset folklore (after night-life winds down). Outside peak hours so cron load doesn't fight match-window 15m polls.

### Leaderboard Registration (Goja AST-safe)

Append to `nakama/src/scheduler/leaderboard_cron.ts`:

```typescript
// (in addition to existing bb_tick_15m / bb_tick_6h)
export function ensureLaboralLeaderboards(nk, logger): void {
  try {
    nk.leaderboardCreate('bb_recruit_05_art', true, undefined, undefined,
      '0 8 * * *',  // 05:00 ART = 08:00 UTC
      { purpose: 'recruit_pool_refresh' });
  } catch (e) { /* already exists */ }
  try {
    nk.leaderboardCreate('bb_mesa_recompute_1h', true, undefined, undefined,
      '0 * * * *',  // hourly on the hour UTC
      { purpose: 'mesa_chica_recompute' });
  } catch (e) { /* already exists */ }
  logger.info('Laboral leaderboards ensured (bb_recruit_05_art, bb_mesa_recompute_1h)');
}
```

**Extend** the existing `onSchedulerLeaderboardReset`:

```typescript
export function onSchedulerLeaderboardReset(ctx, logger, nk, lb, _reset): void {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id);
  } else if (lb.id === 'bb_recruit_05_art') {
    runRecruitRefresh(ctx, logger, nk);
  } else if (lb.id === 'bb_mesa_recompute_1h') {
    runMesaRecomputeAll(ctx, logger, nk);
  }
}
```

This single export keeps the AST-safe `initializer.registerLeaderboardReset(onSchedulerLeaderboardReset)` line in `main.ts` unchanged.

### `runRecruitRefresh` (Idempotent Daily Cron)

```typescript
// nakama/src/scheduler/recruit_cron.ts (NEW)
export function runRecruitRefresh(ctx, logger, nk): void {
  // 1. Acquire KEY_RECRUIT_LOCK (5-min TTL) — same pattern as KEY_TICK_LOCK.
  // 2. Compute today_art = "YYYY-MM-DD" in America/Argentina/Buenos_Aires.
  //    Use new Date(now - 3*3600*1000).toISOString().slice(0,10) since AR is UTC-3 year-round (no DST since 2009).
  // 3. storageList COL_CLUBS (paginated, S2 pattern: 50 pages × 100 = 5000 cap).
  // 4. For each club: read existing recruit_pool/{club_id}. If existing.generated_date_art === today_art → SKIP.
  //    Otherwise call generatePool(nk, club_id) → write back.
  // 5. Release lock.
}

function generatePool(nk, clubId): RecruitPool {
  const picks: PickValue[] = [];
  for (let i = 0; i < 3; i++) {
    picks.push(generatePick(nk, clubId));
  }
  return { club_id: clubId, generated_at: Date.now(), generated_date_art: today_art,
           expires_at: Date.now() + 25 * 3600 * 1000, picks };
}
```

**Idempotency proof:**

1. Lock prevents two concurrent cron firings.
2. `generated_date_art` short-circuit means re-running the cron on the same UTC day is a no-op.
3. Admin force-refresh bypasses #2 by deleting the record first.
4. Race with `recruit_pibe` consuming a pick: `recruit_pibe` uses `version`-based optimistic concurrency on `recruit_pool` write; cron uses `version: '*'` (write unconditionally if scheduled refresh) which is OK because the refresh REPLACES the entire value.

### Cron Hot-Path Cost

- 153 clubs × 1 read + 1 conditional write = at most 306 storage ops.
- Each `generatePick` is pure compute (no I/O).
- Expected duration: < 1 second.
- Lock TTL of 5 min is wildly generous.

---

## AI Population Strategy

**Goal:** Day 1 — every club has populated Mesa Chica (5 entries) + Líder. Humans displace AI when their Rep crosses the floor.

### Seed Mechanism

**Idempotent boot-time seed** (analog to `seedClubs` in `main.ts`):

```typescript
// nakama/src/laboral/ai_seed.ts (NEW)
export function seedAiBaseline(nk, logger): void {
  const seedKey = 'ai_seed_version';
  const SEED_VERSION = 'v1';
  const existing = nk.storageRead([{ collection: COL_META, key: seedKey, userId: SYSTEM_USER_ID }]);
  if (existing.length > 0 && (existing[0].value as any).version === SEED_VERSION) {
    logger.info('AI baseline already seeded (version=%s); skipping', SEED_VERSION);
    return;
  }
  // For each club: write barra_state with 5 AI Mesa slots + 1 AI Líder.
  const now = Date.now();
  let cursor = '';
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_CLUBS, 100, cursor);
    for (const obj of page.objects || []) {
      const clubId = obj.key;
      const club = obj.value as Club;
      const ageDays = 0; // brand-new barra at seed time; ages naturally
      const mesa = [1, 2, 3, 4, 5].map(slot => ({
        kind: 'ai' as const,
        ai_id: 'ai_' + clubId + '_' + slot,
        reputacion: aiBaselineRep(slot, ageDays, club.division_rank),
      }));
      mesa.sort((a, b) => b.reputacion - a.reputacion); // DESC
      const lider = {
        kind: 'ai' as const,
        ai_id: 'ai_' + clubId + '_lider',
        reputacion: Math.floor(mesa[0].reputacion * 1.2),
        elected_at: now,
        season_id: 0,
      };
      nk.storageWrite([{
        collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID,
        value: { club_id: clubId, aguante_pool: 0, mesa_chica: mesa, lider,
                 barra_age_days: 0, ai_seeded_at: now,
                 mesa_recompute_pending: false, mesa_recompute_last_at: now,
                 lider_vbc_balance: 0, lider_vbc_last_tick_at: now },
        permissionRead: 2, permissionWrite: 0,
      }]);
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  nk.storageWrite([{ collection: COL_META, key: seedKey, userId: SYSTEM_USER_ID,
                     value: { seeded: true, version: SEED_VERSION, at: now },
                     permissionRead: 0, permissionWrite: 0 }]);
  logger.info('AI baseline seeded for all clubs (version=%s)', SEED_VERSION);
}
```

Invoke from `InitModule` after `seedClubs`:

```typescript
seedClubs(nk, logger);
seedAiBaseline(nk, logger);   // NEW — must run after clubs are seeded
ensureSchedulerLeaderboards(nk, logger);
ensureLaboralLeaderboards(nk, logger);  // NEW
initializer.registerLeaderboardReset(onSchedulerLeaderboardReset);
```

### Baseline Rep Curve (D-14)

```typescript
// Proposed — TUNABLE in plan. Designed so a human with average grind reaches Mesa within
// ~30 days, Líder within ~60 days of dedicated play.
function aiBaselineRep(slot: number, ageDays: number, divisionRank: number): number {
  // Division weight: Primera (rank=1) has tougher AI; C Metro (rank=5) easier.
  const divisionMultiplier = { 1: 1.0, 2: 0.8, 3: 0.6, 4: 0.5, 5: 0.4 }[divisionRank] ?? 0.6;
  // Slot decay: slot 1 (top) starts highest, slot 5 (bottom) is the entry floor.
  const slotBase = [3000, 2500, 2000, 1500, 1000][slot - 1];
  // Age growth: AI grows ~30 Rep/day to simulate the barra's own progress.
  const ageGrowth = ageDays * 30 * divisionMultiplier;
  return Math.floor((slotBase + ageGrowth) * divisionMultiplier);
}
```

**Tunability:** these constants are GAME-DESIGN DIALS, not technical constraints. Plan should expose them as exported constants (analog to `WINDOW_PRE_MS` in `windows.ts`) for one-line tweaks.

### Displacement Rules (recompute_mesa)

1. Combine all humans of the club + 5 AI entries into a candidate pool of size N (5 + humans_count).
2. Sort by Rep DESC.
3. Take top 5 → new Mesa Chica.
4. For each entry that left Mesa:
   - If human: write `players/profile.rank = "capo"` + `rank_changed_at = now`.
5. For each entry that entered Mesa:
   - If human: write `players/profile.rank = "mesa"` + `rank_changed_at = now`.
6. AI entries that left Mesa simply disappear from the array (no per-AI storage to update — they're embedded).
7. Líder election: ONLY at season-end (`seasons.ts` hook). The Mesa cron does NOT change Líder mid-season — JER-04 stretch (challenge directo) is v1.1.

### AI Naming Convention

- AI ids: `ai_{club_id}_{slot}` where slot ∈ `1..5` for Mesa, `lider` for Líder.
- AI display names: NOT stored. Public RosterScreen "Mesa Chica" tab renders AI entries as `"Capo de la Barra #N"` (canned label) — no risk of accidentally generating a real barra name. Phase 5 may give AI generated names via Cronista LLM.

---

## Procedural Pibe Generation

> Server-side, seed-driven via `nk.uuidv4()`. Output must be deterministic given the same seed (for replay-ability in v1.1).

### Recipe

**Inputs:** `club_id` (for affinity), `pick_id` (= seed). All RNG derived from `pick_id` (hash-based).

**Steps:**

1. **Name composition:** `${apodo} ${nombre}` from two hardcoded lists.
2. **Rol:** weighted random from `ROL_WEIGHTS`.
3. **Trait 1 (visible):** random pick from `TRAIT_POOL`.
4. **Trait 2 (hidden):** random pick from `TRAIT_POOL` excluding trait 1.
5. **Avatar:** composite from `AVATAR_PARTS` (pelo × remera × accesorio).
6. **Stats preview:** base 50 ± 10 per stat (50 ± rol-affinity bonus).

### Lists (initial values — planner refines)

**Apodos lunfardo** (CONTEXT spec line 71 + research-amplified):
```typescript
const APODOS = [
  "El Tano", "El Negro", "El Pibe", "Cabezón", "Ruso", "Toto",
  "Mauri", "Lucho", "Pichón", "El Chino", "Lalo", "Wachín",
  "Cordobés", "El Tincho", "Coquito",
  "El Gordo", "El Flaco", "El Petiso", "El Rubio", "El Colorado",
  "Pocho", "Coco", "Beto", "Nacho", "Toti",
  "El Lobo", "El Mono", "El Loco", "El Sapo", "El Cabe",
];
```

**Nombres pibe** (regional Argentine + lunfardo-friendly):
```typescript
const NOMBRES = [
  "Russo", "Acosta", "Pereira", "Gomez", "Martinez",
  "Lopez", "Romero", "Sosa", "Diaz", "Suarez",
  "Benitez", "Vargas", "Aguero", "Cabrera", "Torres",
  "Cruz", "Molina", "Rios", "Castro", "Ortega",
];
```

**Result:** 30 × 20 = 600 unique combos before collisions. Collisions OK (Argentine football has plenty of "El Tano Russo").

**Trait pool** (CONTEXT line 74 + PIB-03 + research-amplified, with positive/negative balance):
```typescript
const TRAIT_POOL = [
  { id: "cabezon",    sign: "negative", label: "Cabezón" },      // peleador impulsivo
  { id: "pies_plomo", sign: "negative", label: "Pies de plomo" }, // velocidad reducida
  { id: "camorrero",  sign: "positive", label: "Camorrero" },     // bonus en turnos
  { id: "buchon",     sign: "negative", label: "Buchón" },        // riesgo de filtrar info (Phase 4)
  { id: "pichon",     sign: "negative", label: "Pichón" },        // baja energía base
  { id: "cordobes",   sign: "neutral",  label: "Cordobés" },      // afinidad regional
  { id: "porteno",    sign: "neutral",  label: "Porteño" },       // afinidad regional
  { id: "aguantador", sign: "positive", label: "Aguantador" },    // +energía max
  { id: "picaro",     sign: "positive", label: "Pícaro" },        // +Plata mult
  { id: "pendejo",    sign: "neutral",  label: "Pendejo" },       // joven, skill grind +
  { id: "veterano",   sign: "neutral",  label: "Veterano" },      // experiencia bonus
  { id: "loco",       sign: "mixed",    label: "Loco" },          // unpredictable buff/debuff
];
```

**Roles + weights** (D-11 spec):
```typescript
const ROL_WEIGHTS: Array<[string, number]> = [
  ["trompada", 25],
  ["aguantador", 20],
  ["corredor", 15],
  ["vigia", 10],
  ["pirotecnico", 10],
  ["lider", 10],
  ["abogado", 5],
  ["viejo", 5],
];  // sum = 100
```

**Avatar parts** (paramétrico decision — D-11 says "reusa pattern Phase 1 PibeCreator si existe; sino seed-driven random hasta tener illustration system"):

Phase 1 used static stat-pool stats — there is no existing PibeCreator avatar-composition code. **Phase 3 ships placeholder avatars**: 3 pelos × 4 remeras × 3 accesorios = 36 combinations stored as field tuples. Godot renders by stacking 3 sprites (or 3 colored ColorRects in Phase 3 as ultra-minimal). Real illustrations land Phase 5 or Phase 7 polish.

```typescript
const AVATAR_PARTS = {
  pelo: ["rapado", "corto", "largo"],
  remera: ["tricolor_1", "tricolor_2", "tricolor_3", "negra"],
  accesorio: ["ninguno", "gorra", "capucha"],
};
```

### Determinism

Seed = `pick_id` (UUID v4). Hash to integer via simple djb2 over the UUID string, then advance state per-roll. Pure function; no RNG cache. Verified by writing the same `pick_id` twice → same pibe (used in test invariants).

---

## Rank Transition System

### Threshold Table

| From | To | Trigger | Source |
|------|-----|---------|--------|
| `pibe` | `soldado` | `reputacion >= 500` | Phase 3 D-13 |
| `soldado` | `capo` | `reputacion >= 2500` | Phase 3 D-13 |
| `capo` | `mesa` | top-5 by Rep in club | mesa cron |
| `mesa` | `lider` | highest Rep at season-end | seasons.ts hook |
| `mesa` | `capo` | falls out of top 5 | mesa cron (demote) |
| `lider` | `mesa` | new season starts and lost re-election | seasons.ts hook |

### Atomic Writes

Every rank change is written to `players/profile.rank` in the SAME `storageWrite` batch as the trigger:

- `pibe → soldado/capo`: written in `submit_turno` or `admin_grant_rep` writeback batch.
- `mesa ↔ capo`: written in `recompute_mesa` batch.
- `lider ↔ mesa`: written in `seasons.ts` hook batch.

This avoids the inconsistency where rank-change crashes mid-flight and Rep is incremented but rank stale.

### Push Notification

**Phase 3 decision: DEFER push on rank transition to Phase 5.** Rationale:
1. FCM token infra exists from Phase 2, but per-user push (not topic) wasn't wired (Phase 2 D-10).
2. Phase 5 is when narrative push payloads (Cronista crónica, faction drama) will need per-user sending — design the per-user push system once, comprehensive, then.
3. Phase 3 keeps rank changes silent except in HomeScreen banner the next time the player opens the app.

**However:** the rank transition record IS surfaced in `get_roster` response as a one-shot `recent_rank_change: {from, to, at}` field that the client can use to show a celebratory toast. Cleared by the client via `complete_tutorial`-style ack RPC or the next `get_roster` after 24h (whichever first). This gives the "ascendiste" feel without push infra.

---

## Turno de Barra Mechanic

### Submit Flow

```
Client: TurnoModal lists pibes with energia >= 30 (filtered client-side from get_roster output).
        User selects N pibes (1..min(roster_size, 10)).
        Confirms.

Client → submit_turno({fixture_id, pibe_ids: [...]})
    │
    ▼
Server: rpcSubmitTurno():
  1. Validate not_authenticated, JSON parse.
  2. Read match_windows/{fixture_id} → must exist + state ∈ {"open","live"}.
  3. Read turnos/{fixture_id} for this user → if exists, return prior {ok:true, ...}.
  4. Read all pibe records (storageRead batch).
  5. Validate: for each pibe_id:
        - belongs to user
        - energia_after_regen >= 30
        - en_turno_until == null OR < now
        - matches player's club (defensive)
  6. Read players/profile, barra_state/{club_id}.
  7. Compute deltas: per-pibe energy -40, en_turno_until = window.closes_at.
     barra_state.aguante_pool += 50 * N.
     players/profile.reputacion += 20 * N.
  8. Run check_rank_transition on profile (may mutate profile.rank).
  9. Write turnos/{fixture_id} FIRST with full deltas (idempotency marker; if step 10 fails, the marker persists and a re-submit returns the failed state).
 10. Write batch: pibes (all updated), barra_state, profile. Optimistic concurrency on each.
 11. If barra_state write conflicts → retry mesa_recompute_pending flag flip.
 12. Return {ok, aguante_credited: 50*N, reputacion_credited: 20*N, new_rank?, pibes_left_en_turno}.
```

### Idempotency Critical Path

The `turnos/{fixture_id}` write at step 9 happens BEFORE the pibe/barra writes. If step 10 fails partially:
- Client retries with same fixture_id.
- Server reads `turnos/{fixture_id}` at step 3 → returns stored result.
- No double-credit possible.

**Edge case:** If step 9 fails (turnos write fails), no rewards are credited — safe. The client retries cleanly.

### Lazy Claim on Window Close

`turnos.status` is `"submitted"` at write. The window closes 2h after kickoff. When does `status → "claimed"` happen?

**Option A:** Cron scans all `turnos` records hourly and claims expired ones. Heavy.

**Option B (chosen):** Lazy — the next time the player calls `get_roster`, the RPC checks each `en_turno_until` field. If `now > en_turno_until` and the corresponding turno record is still `"submitted"`, the RPC stamps `claimed_at = now` + `status = "claimed"`. Cheap, idempotent, single-write per pibe.

**Implication:** the `aguante_credited` and `reputacion_credited` happen at SUBMIT time, not claim time. The "claim" is just a status flip. This means if a Phase 5/6 modifier wants to retroactively boost based on match outcome, that work belongs Phase 5/6 (not Phase 3 — confirmed D-06 says output is flat).

---

## Tutorial Scripting (ONB-05, ONB-06)

### Architecture

**Godot client owns the state machine.** Server stores ONE flag (`profile.tutorial_done`) + ONE step counter (`profile.tutorial_step`). All scene transitions, animations, callouts are client-side.

### Steps (≤ 10 min target)

| Step | Screen / Action | Server RPC | Validation |
|------|-----------------|------------|-----------|
| 0 | Post-onboarding splash: "Tu club te espera." | — | `profile.tutorial_done == false` |
| 1 | TutorialScreen: "Reclutá tu primer pibe." Forced go to RecruitScreen w/ overlay arrow. | `get_recruit_pool` | At least 1 pick exists. |
| 2 | User taps a pick → `recruit_pibe` | `recruit_pibe` | First pibe added; `pibes_recruited_total == 1`. |
| 3 | Overlay: "Asigná una profesión." Routes to ProfessionAssign. | `assign_profession(pibe_id, "trapito")` | `pibe.profession != null`. |
| 4 | Time-skip simulation: server grants 1h of fake idle (admin_grant_rep-style helper, or just adjust client timer). For Phase 3 simplicity: client shows "El pibe está laburando..." for 5 seconds, then "¡Cobraste 10 Plata!" — but server actually grants 10 Plata via a tutorial-only RPC step. | `collect_idle({pibe_id, tutorial: true})` (optional tutorial bypass flag) | `+10 Plata` credited. |
| 5 | Simulated turno: server injects a "tutorial fixture" via existing `admin_inject_test_fixture` pattern OR a NEW tutorial-specific path: just credits the turno reward without needing a real fixture. **Cleaner approach: complete_tutorial(step=5) grants tutorial turno reward directly (+20 Rep, +50 club Aguante) bypassing submit_turno.** | `complete_tutorial({step: 5})` | Rep, Aguante credited. |
| 6 | Final reward unlocked: first trapo + first cántico. | `complete_tutorial({step: 6})` | `tutorial_done = true`, `aguantaderos.trapos_robados[]` gets first placeholder entry, `profile.cantico_unlocked = "primer_cantico"`. |
| 7 | Drop player into HomeScreen with normal flow. | — | `profile.tutorial_done == true` blocks re-entry. |

### FlowRouter Integration

```gdscript
# scripts/autoloads/FlowRouter.gd additions
func go_post_pibe_create() -> void:
  if PlayerStore.tutorial_done:
    go_home()
  else:
    go_tutorial()

func tutorial_advance(step: int) -> void:
  # Calls complete_tutorial RPC + updates PlayerStore + routes to next scene
  pass
```

`go_pibe_creator()` post-Phase-2 already exists. Phase 3 replaces the implicit `go_home()` after pibe creation with `go_post_pibe_create()` which gates on `tutorial_done`.

### Atomicity of Final Reward

`complete_tutorial({step: FINAL})` MUST:
1. Read profile.
2. If `tutorial_done == true` → return current reward state (idempotent).
3. Otherwise write atomically: profile + aguantaderos (with trapo entry).
4. Return `{ok, reward: {trapo, cantico}}`.

A crash between step 3 writes (profile written, aguantaderos failed) leaves a recoverable state: re-call → `tutorial_done == true`, but `trapos_robados[]` is empty. Recovery: idempotency key on the trapo entry (`tutorial_trapo`) — if not present in array AND `tutorial_done == true`, append on next read. Belt-and-suspenders.

---

## Godot Roster + Aguantadero UI

> UI-SPEC is a separate gate. Phase 3 plan should reference this section for component reuse but defer pixel-level decisions to the planner.

### Screens to Build (7)

| Screen | Purpose | Reuses |
|--------|---------|--------|
| `RosterScreen.tscn` | Lists pibes with cards (PibeCard) showing energia, profession, plata-this-cycle. | `ClubCard.tscn` pattern |
| `RecruitScreen.tscn` | Shows 3 daily picks; tap to recruit. Asymmetric trait reveal animation. | `ClubCard.tscn` pattern |
| `PibeDetailScreen.tscn` | Pibe stats, profession, skill progress, traits reveal. | — |
| `ProfessionAssignScreen.tscn` | 5 profession options (4 visible, 1 Líder-locked). | NavButton.tscn |
| `AguantaderoScreen.tscn` | Shows current level + 4 upgrade slots (capacity/almacén/bandera/defensa) + cost. Bandera-room shows placeholder grid. | — |
| `TurnoModal.tscn` | Modal popup from HomeScreen when ventana open. Lists pibes with energy ≥ 30. | — |
| `TutorialScreen.tscn` | Overlay-based step machine (1 scene, 7 sub-states). | FlowRouter |

### HomeScreen Extension (existing)

```gdscript
# scripts/screens/HomeScreen.gd additions
@onready var plata_label: Label = $TopBar/Plata
@onready var aguante_label: Label = $TopBar/Aguante
@onready var rep_label: Label = $TopBar/Reputacion
@onready var vbc_label: Label = $TopBar/VBC
@onready var hacer_turno_button: Button = $Content/HacerTurnoButton  # visible only when window open|live
@onready var laburar_button: Button = $Content/LaburarButton
@onready var reclutar_button: Button = $Content/ReclutarButton
@onready var aguantadero_button: Button = $Content/AguantaderoButton
```

`_refresh_window` extends to call `get_roster` + `get_aguantadero` in parallel and update PlayerStore + emit `resources_updated` signal.

### PlayerStore Extension

```gdscript
# scripts/autoloads/PlayerStore.gd additions

signal roster_updated
signal resources_updated
signal aguantadero_updated

var rank: String = "pibe"
var plata: int = 0
var reputacion: int = 0
var vbc: int = 0
var tutorial_done: bool = false
var tutorial_step: int = 0

var pibes: Array = []           # Array[Dictionary] — parsed PibeView
var aguantadero: Dictionary = {}
var recruit_pool: Dictionary = {}
var roster_cap: int = 5
```

### NakamaService Extension

```gdscript
# scripts/autoloads/NakamaService.gd additions — 10 new wrappers
func get_roster() -> Dictionary: ...
func get_aguantadero() -> Dictionary: ...
func get_barra_state(club_id := "") -> Dictionary: ...
func get_recruit_pool() -> Dictionary: ...
func assign_profession(pibe_id: String, profession: String) -> Dictionary: ...
func collect_idle(pibe_id := "") -> Dictionary: ...
func recruit_pibe(pick_id: String) -> Dictionary: ...
func upgrade_aguantadero(target_level: int) -> Dictionary: ...
func submit_turno(fixture_id: String, pibe_ids: Array) -> Dictionary: ...
func complete_tutorial(step: int) -> Dictionary: ...
```

All wrappers follow the existing `get_current_window` pattern: assert auth, build payload, await `rpc_async`, parse response with `typeof != TYPE_DICTIONARY` guard (WR-09 lesson).

### Project Skills Applicable

From `.claude/skills/`:
- **`interface-design`** + **`component-spec`** — RosterScreen/RecruitScreen layout.
- **`information-architecture`** — order of HomeScreen widgets.
- **`onboarding-design`** — TutorialScreen scripted flow.
- **`error-handling-ux`** — "no energy", "roster full", "not enough plata" feedback.
- **`micro-interaction-spec`** — trait reveal animation (D-10).
- **`ux-writing`** — lunfardo copy invariant (CLAUDE.md tone).
- **`hooked-ux`** — daily recruit refresh + once-per-fixture turno align with this pattern (variable reward + ritual).
- **`state-machine`** — TutorialScreen + rank transitions.

Not applicable: `responsive-design`, `dark-mode-design`, `accessibility-test-plan` (Phase 7).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Daily cron at 05:00 ART | `setInterval` (doesn't exist in Goja) or roll own time-tracking | `nk.leaderboardCreate` w/ cron string `0 8 * * *` + `registerLeaderboardReset` hook | This is the ONE Nakama TS-runtime cron mechanism. Goja has no setTimeout/setInterval. Phase 2 confirmed. |
| Distributed lock | Postgres advisory locks via raw SQL (no SQL access in TS runtime) | `COL_META[KEY_RECRUIT_LOCK]` w/ TTL check (acquired_at + 5min > now) | Phase 2 pattern. Storage IS the DB. |
| Idempotency on RPC | Client-generated request IDs | Server-derived key: `turnos/{fixture_id}` per user, `recruit_pool/{club_id}.generated_date_art` | Server picks the natural key. Client can't lie. |
| Constant-time bearer compare | Raw `===` (timing oracle T-2-ADM-01) | `nakama/src/util/admin_auth.ts:requireAdmin` (already exists) | Reuse. |
| Storage version conflict | Lock-and-retry loops | Optimistic concurrency with `version: existing.version` + swallow conflict + retry next read | `windows.ts` pattern. Reads happen often enough to converge. |
| Daily date stamp in ART (UTC-3, no DST since 2009) | Timezone library | `new Date(now - 3*3600*1000).toISOString().slice(0,10)` | AR has no DST. `Intl.DateTimeFormat` exists in Goja but is heavier. Hand-roll is fine here. |
| Push notification per-user | Custom token routing | Defer to Phase 5 (per CONTEXT). FCM topic broadcast is fine for "ventana abre"; per-user lands w/ rest of social. | Don't build half a system; finish Phase 5's design. |
| Avatar illustration system | Procedural 2D illustration | 3-part sprite stack (pelo + remera + accesorio) OR ColorRect placeholders | Real art = Phase 7 polish. Phase 3 just needs the slot structure. |
| AI per-record storage | One record per AI pibe × 153 clubs × 5 = 765 records | Embed AI in `barra_state.mesa_chica` array (5 entries per club) | 153 reads vs 765 reads on full scan. Embed wins until AI gains personal state Phase 4. |

**Key insight:** Nakama TS runtime has a sparse API surface (storage + scheduler + RPC + leaderboards + notifications + HTTP). Every Phase 3 "system" must be expressed in those primitives. The constraint is Phase 3's friend: it forces simple, observable patterns.

---

## Runtime State Inventory

Phase 3 is **not** a rename or refactor phase — it's net-new feature work. No legacy runtime state to migrate beyond the single `pibes/main` → `pibes/{uuid}` micro-migration described in §Storage Schema (which is one-shot, idempotent, lazy on first `get_roster` call per user).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | One existing record per Phase 1 user: `pibes/main` (single-pibe slot). | Lazy migration on first `get_roster`: copy `pibes/main` to `pibes/{value.id}`, delete old key, stamp `profile.pibes_migrated_at`. Idempotent. |
| Live service config | None — Phase 3 reuses Railway env vars from Phase 2 (`ADMIN_BEARER`, `ADMIN_TEST_MODE`). No new env vars required. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — Phase 3 adds zero new env vars. Reuses Phase 2 admin bearer for admin RPCs. | None. |
| Build artifacts | `nakama/build.mjs` IIFE bundle will grow ~3-5KB; Railway auto-redeploy handles via webhook. | None. |

---

## Common Pitfalls

### Pitfall 1: Recruit Pool Race — Two Players, One Pick

**What goes wrong:** Players A and B both call `recruit_pibe(pick_id="X")` simultaneously. Both read `recruit_pool/{club_id}` showing pick X. Both deduct Plata. Both create pibes from X.

**Why it happens:** No optimistic concurrency on the pool read.

**How to avoid:**
- `recruit_pibe` MUST do storageRead with version capture, then storageWrite of the updated pool (pick X removed) with `version: <captured>`.
- On `concurrent_update` error: re-read pool, check if pick X still present. If yes (the other write was for a different pick), retry once. If no, return `{ok: false, error: "pick_already_taken"}`.
- Plata deduction happens ONLY after successful pool write.

**Warning signs:** Two pibes with same name/rol/traits in roster across two users. Test invariant: spawn 100 concurrent recruit_pibe calls for same pick_id; exactly one succeeds.

### Pitfall 2: Idle Accrual Double-Compute

**What goes wrong:** `get_roster` accrues; client immediately calls `collect_idle`; that accrues AGAIN.

**Why it happens:** `get_roster` writes `last_collected_at = now` for skill-time tracking, then `collect_idle` reads the FRESH `last_collected_at` and computes 0 — but if `get_roster` ONLY computed deltas without stamping, the second call would re-compute.

**How to avoid:**
- `get_roster` is **READ-ONLY for skill_hours and last_collected_at** — it only DISPLAYS the projected accrual (does not stamp).
- `collect_idle` is the ONLY write path for Plata + skill + last_collected_at.
- Document this clearly in `idle_accrual.ts`: `getProjectedAccrual()` (pure) vs `commitAccrual()` (mutates).

**Warning signs:** Players report doubled Plata. Test: call `get_roster` 10 times in a row, then `collect_idle` — credited amount == 1× rate × hours, not 10×.

### Pitfall 3: Goja AST Misses RPC Registration

**What goes wrong:** Server boot crashes with `failed to find InitModule function` or `function key could not be extracted: not found`.

**Why it happens:** Phase 2 paid this 3 times. Wrapping `initializer.registerRpc(...)` calls in helper functions like `registerLaboralRpcs(initializer)` causes Nakama's AST walker (`server/runtime_javascript_init.go::findInitModuleFn`) to skip them.

**How to avoid:**
- Every `initializer.registerRpc('name', handlerFn)` MUST be an inline ExpressionStatement in `InitModule`'s body.
- Handler reference MUST be a top-level named function declaration in the bundle (function declarations preferred over arrow assignments).
- Same rule for `registerLeaderboardReset` (but Phase 3 doesn't need a new call — reuse existing).
- Same rule for `nk.leaderboardCreate` — Phase 3's `ensureLaboralLeaderboards` helper IS called from InitModule, but it's NOT a registration call; only registrations need the inline rule. Creation helpers are fine to wrap.

**Warning signs:** Build succeeds; Railway boot fails with cryptic Goja error. Pre-flight: `node -e "console.log(require('./dist/index.js'))"` to sanity-check IIFE shape.

### Pitfall 4: Storage Key Mirror Drift (CR-01 Repeat)

**What goes wrong:** Server adds `COL_RECRUIT_POOL`; `StorageKeys.gd` doesn't mirror. Client reads from `"recruit_pool"` literal string, server reads same string — fine! But if either side typos, the OTHER side silently sees empty results.

**Why it happens:** Phase 1 CR-01 was exactly this — pibe was keyed `<uuid>` on server, `main` on client.

**How to avoid:**
- Single PR (or single plan task) MUST add the constant on both sides simultaneously.
- Plan task: "Update storage_keys.ts + StorageKeys.gd mirror" as ONE atomic step.
- Invariant test: walk constants in both files; assert match.

**Warning signs:** "Storage read returned 0 objects" with no error. Smoke test post-deploy.

### Pitfall 5: Clock Skew on Energía / Plata

**What goes wrong:** Player sets device clock forward 24h → server stamps `last_tick_at = device_now`, then on next read 24h of fake elapsed credits accrue.

**Why it happens:** If server ever uses `ctx.userTime` or client-supplied timestamp.

**How to avoid:**
- All time math uses `Date.now()` (server clock) — never accept timestamps from client.
- Validated by code review + grep for any client-supplied time field in inputs.

**Warning signs:** A single player generates 10x normal Plata. Anti-cheat alert: client tampering.

### Pitfall 6: Mesa Chica Thrash (Oscillating Displacement)

**What goes wrong:** Human A with Rep 2900 and AI 5 with Rep 2900 oscillate every Mesa recompute (Phase 5 design problem too).

**Why it happens:** Sort tie-breaker is unstable; debounce too short.

**How to avoid:**
- Tie-breaker: human always wins over AI at equal Rep (deterministic AI displacement direction).
- Debounce: 5 minutes minimum between Mesa recomputes per club (`mesa_recompute_last_at`).
- Audit log every Mesa write: `admin_actions` collection rows `{kind: "mesa_change", club_id, before, after, at}`.

**Warning signs:** Audit log shows 100+ Mesa changes/hour for same club. Test invariant: with Rep frozen, two consecutive recomputes are identical.

### Pitfall 7: Pibe Migration Race

**What goes wrong:** First `get_roster` post-deploy for a Phase 1 user migrates `pibes/main` → `pibes/{uuid}`. If client makes 2 parallel calls, both attempt the migration; one fails partway.

**Why it happens:** Migration is read-modify-write without atomic guard.

**How to avoid:**
- Migration uses `players/profile.pibes_migrated_at` as the idempotency marker.
- First step in `get_roster`: read profile + check marker. If `pibes_migrated_at == null`, attempt migration. Use optimistic concurrency: write profile with `pibes_migrated_at = now` BEFORE deleting `pibes/main`. If profile write conflicts, abort — the other thread will complete.
- After migration: subsequent calls see marker, skip.

**Warning signs:** Users report "where's my pibe?". Test: pre-Phase-3 user account, call get_roster 5x concurrently.

### Pitfall 8: Lunfardo Drift / App Store Risk

**What goes wrong:** Plan introduces combat-coded copy like "ataque", "raid", "pelea" in UI strings.

**Why it happens:** Forgetting that Phase 3 is NOT combat (Phase 4 is). App Store reviewers will see "raid" in screenshots.

**How to avoid:**
- Phase 3 vocabulary list (planner enforces): "hacer turno", "estar en la cancha", "aguantar", "laburar", "reclutar", "ascender".
- BANNED in Phase 3 copy: ataque, raid, robar, pelear, asalto, emboscar, golpe.
- Verification: grep `nakama/src/` and `scripts/screens/` for banned terms before deploy.

**Warning signs:** Reviewer feedback "appears to glorify gang violence." Mitigation in v1.

---

## Project Constraints (from CLAUDE.md)

The planner MUST verify each task against:

- **Solo dev bandwidth:** 4 plans estimate, 3-4 weeks total. Plans MUST be ≤ 5 tasks each (Phase 2 calibration).
- **Budget ~$40/mo:** No new external services in Phase 3. Cron via Nakama leaderboards (free). No API-Football paid tier (Phase 6).
- **Server-authoritative for resources:** Every Plata/Aguante/Rep/VBC delta server-only. No client computes. Confirmed in every RPC §RPC Surface.
- **No free-text chat:** Phase 3 has zero text input from players except `players/profile.display_name` (already validated Phase 1). No new free-text surface.
- **No gacha / loot boxes:** Recruit pool is **transparent** — D-10 asymmetric trait reveal is "open one trait now, see other when recruit". Not randomized purchase; deterministic pool. Costs visible pre-recruit.
- **Cosmetic-only monetization:** Phase 3 has zero IAP. Plata is soft currency. Energy NOT Plata-buyable (D-04). No bypass mechanism.
- **5 AFA divisions:** AI baseline scales with `division_rank` so all clubs viable. Lower divisions get gentler AI (D-14 + §AI Population Strategy).
- **AI barras pilar v1:** Phase 3 seeds AI Mesa+Líder for all 153 clubs day 1. Confirmed §AI Population Strategy.
- **Tone: lunfardo, caricaturesco, apolítico, sin nombres reales:** AI display names are canned ("Capo de la Barra #N"), no LLM until Phase 5. Procedural pibe names use safe lunfardo apodos. NO real barra leader names anywhere.
- **App Store-safe framing:** Phase 3 = laboral + turno + recruit + tutorial. NO combat copy. §Pitfall 8.

---

## Code Examples

### Pattern 1: Lazy Compute on Read (storage write-back w/ optimistic concurrency)

```typescript
// nakama/src/rpc/get_roster.ts (NEW — sketch)
import { COL_PIBES, COL_PLAYERS } from '../storage_keys';
import { accrueIdleForPibe, regenEnergia } from '../laboral/idle_accrual';

export function rpcGetRoster(ctx, logger, nk, _payload): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  // Read all user's pibes via storageList (cap 50 pages × 100 = 5000 — overkill for 20-pibe cap).
  const pibes: PibeRecord[] = [];
  let cursor = '';
  const versionByKey: { [key: string]: string } = {};
  for (let pg = 0; pg < 5; pg++) {
    const page = nk.storageList(userId, COL_PIBES, 100, cursor);
    for (const obj of page.objects || []) {
      pibes.push(obj.value as PibeRecord);
      versionByKey[obj.key] = obj.version;
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  // For each pibe: regen energy + project Plata accrual (DO NOT stamp last_collected_at here).
  const pibeViews = pibes.map(p => {
    const projected = accrueIdleForPibe(p, now);  // pure compute
    const projectedEnergia = regenEnergia(p, now);
    return {
      ...p,
      energia: projectedEnergia,
      projected_plata: projected.plata_delta,
      projected_vbc: projected.vbc_delta,
    };
  });

  // Energy regen IS persisted (cheap; protects against double-count if cap reached).
  const writes = pibes.map(p => {
    const newEnergia = regenEnergia(p, now);
    if (newEnergia !== p.energia) {
      return {
        collection: COL_PIBES, key: p.id, userId,
        value: { ...p, energia: newEnergia, energia_last_tick_at: now },
        version: versionByKey[p.id],
        permissionRead: 1, permissionWrite: 0,
      };
    }
    return null;
  }).filter(w => w !== null);
  if (writes.length > 0) {
    try { nk.storageWrite(writes); } catch (e) {
      logger.warn('[get_roster] energy write conflict; will retry next call');
    }
  }

  // Read profile for roster_cap context.
  const profileRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  // ... (compute roster_cap from aguantadero level, etc.) ...

  return JSON.stringify({ ok: true, pibes: pibeViews, pibes_count: pibes.length, roster_cap: 5 /* placeholder */ });
}
```

**Source:** Derived from `nakama/src/scheduler/windows.ts` (storage write w/ version) + `nakama/src/rpc/get_current_window.ts` (storageList paginated pattern).

### Pattern 2: Idempotent Submit w/ Marker

```typescript
// nakama/src/rpc/submit_turno.ts (NEW — sketch)
import { COL_TURNOS, COL_MATCH_WINDOWS, COL_PIBES, COL_PLAYERS, COL_BARRA_STATE, SYSTEM_USER_ID } from '../storage_keys';

export function rpcSubmitTurno(ctx, logger, nk, payload): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  let input: any; try { input = JSON.parse(payload); } catch (e) {
    return JSON.stringify({ ok: false, error: 'invalid_json' });
  }
  if (typeof input.fixture_id !== 'string' || !Array.isArray(input.pibe_ids)) {
    return JSON.stringify({ ok: false, error: 'invalid_input' });
  }

  // IDEMPOTENCY CHECK FIRST — before any other work.
  const existing = nk.storageRead([{ collection: COL_TURNOS, key: input.fixture_id, userId }]);
  if (existing.length > 0) {
    const prior = existing[0].value as any;
    return JSON.stringify({ ok: true, ...prior, idempotent_replay: true });
  }

  // Validate window state.
  const winRead = nk.storageRead([{ collection: COL_MATCH_WINDOWS, key: input.fixture_id, userId: SYSTEM_USER_ID }]);
  if (winRead.length === 0) return JSON.stringify({ ok: false, error: 'no_window' });
  const win = winRead[0].value as any;
  if (win.state !== 'open' && win.state !== 'live') {
    return JSON.stringify({ ok: false, error: 'window_not_active', state: win.state });
  }

  // Validate pibes (energy check + ownership + en_turno check).
  // ... (read pibes, compute deltas) ...

  // WRITE TURNO MARKER FIRST.
  const turnoRecord = {
    fixture_id: input.fixture_id, user_id: userId, submitted_at: Date.now(),
    pibe_ids: input.pibe_ids, energia_consumed_per_pibe: 40,
    aguante_credited: 50 * input.pibe_ids.length,
    reputacion_credited: 20 * input.pibe_ids.length,
    status: 'submitted', claimed_at: null,
  };
  nk.storageWrite([{
    collection: COL_TURNOS, key: input.fixture_id, userId,
    value: turnoRecord, permissionRead: 1, permissionWrite: 0,
  }]);

  // Now apply the rest atomically (pibes, profile, barra_state).
  // ... (with optimistic concurrency, swallow conflicts, retry once) ...

  return JSON.stringify({ ok: true, ...turnoRecord });
}
```

**Source:** Idempotency marker pattern from `nakama/src/scheduler/windows.ts` (`notified_open_at` write-first); auth pattern from `nakama/src/rpc/create_pibe.ts`.

### Pattern 3: Cron Helper Hook Extension (Goja AST-safe)

```typescript
// nakama/src/scheduler/leaderboard_cron.ts — EXTENSION ONLY
// (DO NOT add a second initializer.registerLeaderboardReset — reuse the existing one).

export function ensureLaboralLeaderboards(nk, logger): void {
  try { nk.leaderboardCreate('bb_recruit_05_art', true, undefined, undefined, '0 8 * * *', { purpose: 'recruit' }); }
  catch (e) { /* already exists */ }
  try { nk.leaderboardCreate('bb_mesa_recompute_1h', true, undefined, undefined, '0 * * * *', { purpose: 'mesa' }); }
  catch (e) { /* already exists */ }
}

// Extend the existing hook:
export function onSchedulerLeaderboardReset(ctx, logger, nk, lb, _reset): void {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id);
  } else if (lb.id === 'bb_recruit_05_art') {
    runRecruitRefresh(ctx, logger, nk);
  } else if (lb.id === 'bb_mesa_recompute_1h') {
    runMesaRecomputeAll(ctx, logger, nk);
  }
}
```

**Source:** Direct extension of `nakama/src/scheduler/leaderboard_cron.ts:onSchedulerLeaderboardReset`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-pibe slot at `pibes/main` (Phase 1) | Multi-pibe at `pibes/{uuid}` (Phase 3) | Phase 3 migration | Lazy migration on first `get_roster`. CR-01 lesson applied. |
| Phase 1 `players/profile` minimal shape | Extended w/ rank, plata, reputacion, vbc, tutorial state | Phase 3 | Single profile record absorbs all per-user economy state. Avoids second collection. |
| Mesa/Líder existed only conceptually | Embedded array `barra_state.mesa_chica[5]` per club | Phase 3 | 153 read scans for global Mesa; per-club read is O(1). |
| `setTimeout/setInterval` (assumed available, isn't) | `registerLeaderboardReset` w/ cron schedule | Phase 2 D-09 | Locked-in via Phase 2 hot-fixes. |
| Goja AST descends into helpers (assumed, doesn't) | Inline `initializer.registerRpc` ExpressionStatements only | Phase 2 D-01 (lesson) | Hot-fixed 3 times in Phase 2; cardinal rule now. |

**Deprecated / out of scope for Phase 3:**
- Push notification per-user on rank transition (defer Phase 5).
- LLM-generated AI names (defer Phase 5 Cronista).
- Passive Aguante pool generation (`aguante_pool` only grows via turnos in Phase 3; passive is reserved for v1.1).

---

## Assumptions Log

All claims tagged `[ASSUMED]` in this research that the planner / discuss-phase MAY want to verify with the user before locking. Most are game-design dials.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AI baseline Rep curve constants (`slotBase = [3000, 2500, 2000, 1500, 1000]`, `ageGrowth = 30/day`) make human catch-up feasible in ~30 days. `[ASSUMED]` | §AI Population | Too high → humans never reach Mesa. Too low → AI trivially displaced day 1. **Tunable dial — plan exposes as exported constants.** |
| A2 | Aguantadero level cost ladder `0/5000/15000/40000/100000` paces upgrades to ~1/week for active players. `[ASSUMED]` | §Storage Schema | Cheap → no upgrade pressure. Expensive → wall. **Tunable dial.** |
| A3 | Roster cap by aguantadero level `5/8/12/16/20` matches D-12 spec. `[VERIFIED: CONTEXT D-12]` | §Storage Schema | None. |
| A4 | Energía cost of 40/turno × max 10 pibes = 400 Energía/match window. With +5/h regen, that's 80h to refill 10 pibes — too slow? `[ASSUMED]` | §Turno Mechanic | Too slow → players hate it. Too fast → no scarcity. **Plan should pilot with smaller squad sizes (3-5).** |
| A5 | Tutorial 7 steps complete in <10 min. `[ASSUMED]` | §Tutorial Scripting | Too long → drop-off. Plan should playtest step duration. |
| A6 | Phase 3 ships placeholder avatars (3×4×3 = 36 combos via ColorRect or sprite stack) deferring real art to Phase 7. `[ASSUMED]` | §Procedural Pibe Generation | Looks ugly in pre-launch screenshots; mitigation: stylized minimalism, lunfardo + parodia carries identity. |
| A7 | Mesa recompute debounce of 5 minutes is sufficient anti-thrash. `[ASSUMED]` | §Lazy Compute / §Pitfalls | Too long → players don't see promotion fast; too short → thrash. Audit log catches thrash; tune in Phase 4 testing. |
| A8 | Cron `bb_mesa_recompute_1h` walks all 153 clubs hourly without performance issue (estimated < 1 sec/run). `[ASSUMED]` | §Lazy Compute | Slow → cron overlaps. Mitigation: lock TTL 5 min protects; admin can suspend cron. |
| A9 | AR timezone is UTC-3 year-round (no DST since 2009). `[VERIFIED: Argentina has had no DST since 2009, last DST attempt 2007-2009 was abandoned]` | §Daily Cron | None — confirmed in widely-cited public sources. |
| A10 | Push notification on rank transition deferred to Phase 5 (not Phase 3). `[VERIFIED: CONTEXT D-13 + Specifics]` | §Rank Transition | None — matches user-stated intent to avoid noisy notifs Phase 3. |
| A11 | Trait pool: 12 traits with mixed positive/negative signs. `[ASSUMED — CONTEXT lists ~10, research amplifies to 12]` | §Procedural Pibe Generation | Too few → repetitive recruit pool. Too many → unbalanced. Plan refines. |
| A12 | Apodos list ~30 entries, Nombres list ~20 entries (600 combos, allows duplicates). `[ASSUMED — CONTEXT lists 15 apodos, research amplifies]` | §Procedural Pibe Generation | Too small → repetitive names. Plan refines. |

**A1, A2, A4, A7 are all game-design tuning dials — they will be revisited in Phase 7 balance pass and Phase 6 analytics-driven tuning. The Phase 3 plan should expose them as exported `const` values in dedicated tuning files so post-launch tweaks are one-line PRs.**

---

## Open Questions

1. **Phase 3 Aguante passive generation (AGT-04)?**
   - What we know: AGT-04 says "Generación pasiva de Aguante según nivel de aguantadero + turnos". CONTEXT does NOT explicitly include passive — D-06 only specifies turno-driven +50.
   - What's unclear: Is the passive Aguante pool grow rate part of Phase 3, or deferred?
   - Recommendation: Phase 3 ships turno-driven Aguante only (D-06). Passive rate exists in schema (`aguante_pool_last_tick_at` slot reserved) but not computed. Plan can confirm — low-risk to add later.

2. **AI Líder VBC accumulation distribution**
   - What we know: D-07 says AI Líder accumulates club VBC for Phase 4 heat system.
   - What's unclear: Does Phase 3 compute the AI Líder VBC accrual? Or just leave the field reserved?
   - Recommendation: Phase 3 accrues `lider_vbc_balance` on the `barra_state` record (lazy, on read). Phase 4 will consume it. Cost: 1 lazy compute per `get_barra_state` call. Cheap.

3. **Tutorial reward concrete payload**
   - What we know: CONTEXT D-18 (implicit via ONB-06): "primer trapo de barra + primer cántico desbloqueado".
   - What's unclear: Is the cántico a string ID stored on profile, or a separate `canticos` collection?
   - Recommendation: Phase 3 stores `players/profile.cantico_unlocked = "primer_cantico"` (single field). Phase 6 (shop/unlock catalog) extends to multi-cántico.

4. **Cron timezone correctness**
   - What we know: Nakama leaderboard cron expressions are interpreted as UTC.
   - What's unclear: Verified by inspection of `bb_tick_15m` (`*/15 * * * *`) which is hour-agnostic; need to confirm Nakama treats `0 8 * * *` as UTC 08:00 = ART 05:00.
   - Recommendation: Plan task includes a one-off log statement at cron entry to confirm timezone interpretation in production. Easy to verify post-deploy.

5. **Plata starting balance**
   - What we know: CONTEXT discretion says "probable 0/0/0 with tutorial reward chiquito".
   - What's unclear: Does the player start with enough Plata to make a meaningful first recruit during tutorial?
   - Recommendation: Tutorial grants the first pibe FREE (bypass recruit cost) at step 2. Plata starting balance = 0. After tutorial, player has 1 pibe assigned to "trapito"; first `collect_idle` post-tutorial yields ~10-50 Plata; next recruit (full price 500) is the first meaningful economic decision.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js (build) | esbuild bundle for Nakama TS runtime | ✓ | Phase 1+2 verified | — |
| esbuild | nakama/build.mjs | ✓ | bundled | — |
| Nakama server (Railway) | Production runtime | ✓ | 3.21.x live | — |
| Postgres | Storage backend | ✓ | bundled w/ Nakama | — |
| Godot 4.3 | Client builds | ✓ | Phase 1+2 verified | — |
| Nakama GDScript SDK | Client RPC calls | ✓ | 3.4.0 vendored | — |
| Railway env vars (ADMIN_BEARER, ADMIN_TEST_MODE) | Admin RPCs + test fixtures | ✓ | Phase 2 verified | — |
| jq (test harness) | invariants test bash | ✓ | already used by `heartbeat-test.sh` | — |
| curl (test harness) | invariants test bash | ✓ | always | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Conclusion:** Phase 3 inherits a fully-provisioned environment from Phases 1-2. No new infra requests, no env var additions.

---

## Validation Architecture

> `workflow.nyquist_validation = true` confirmed in `.planning/config.json`. Section MANDATORY.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bash + curl + jq (continues Phase 2 pattern — `nakama/test/heartbeat-test.sh`) |
| Config file | `nakama/test/laboral-test.sh` (NEW — parallel to `heartbeat-test.sh`) |
| Quick run command | `bash nakama/test/laboral-test.sh --invariant 1` (run single invariant) |
| Full suite command | `NAKAMA_HOST=... NAKAMA_KEY=... ADMIN_BEARER=... bash nakama/test/laboral-test.sh` |

**Rationale:** Phase 2 established the bash+curl pattern. Adding a Phase 3 sibling script (rather than a JS/TS test framework) keeps Wave 3 simple and consistent with existing CI/CD-deferred (Phase 7) infrastructure. Tests run against live Railway environment OR a local Nakama (developer's choice).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AGT-01 | Aguantadero created with `barrio_hq` from club | smoke | `bash nakama/test/laboral-test.sh --invariant AGT-01-barrio` | ❌ Wave 0 |
| AGT-02 | upgrade_aguantadero validates Plata cost + writes level | invariant | `bash nakama/test/laboral-test.sh --invariant AGT-02-upgrade` | ❌ Wave 0 |
| AGT-03 | Resources persist + read correctly via get_aguantadero / get_roster | smoke | `--invariant AGT-03-resources` | ❌ Wave 0 |
| AGT-04 | Aguante credited from turno (Phase 3: turno-only, passive deferred) | invariant | `--invariant AGT-04-turno-credit` | ❌ Wave 0 |
| AGT-05 | bandera_room_slots field exists; trapos_robados array exists (placeholder) | smoke | `--invariant AGT-05-bandera-placeholder` | ❌ Wave 0 |
| PIB-01 | Roster cap by aguantadero level (recruit blocks at cap) | invariant | `--invariant PIB-01-cap` | ❌ Wave 0 |
| PIB-02 | Generated pibe has valid `rol` from weight table | invariant | `--invariant PIB-02-rol-distribution` (run 100 recruits, χ²) | ❌ Wave 0 |
| PIB-03 | Pibe has trait_1 visible + trait_2 hidden in pool; revealed on recruit | invariant | `--invariant PIB-03-trait-reveal` | ❌ Wave 0 |
| PIB-04 | "hablar_cana" profession only assignable when rank=="lider" | invariant | `--invariant PIB-04-lider-gate` | ❌ Wave 0 |
| PIB-05 | Idle accrual: pibe with trapito for 1h → +10 Plata (mocked time via admin_grant_rep analog) | invariant | `--invariant PIB-05-accrual-rate` | ❌ Wave 0 |
| PIB-06 | submit_turno credits +50 Aguante/pibe + +20 Rep/pibe + consumes 40 energy | invariant | `--invariant PIB-06-turno-output` | ❌ Wave 0 |
| PIB-07 | After N hours of trapito, skill_hours bumps + multiplier applies | invariant | `--invariant PIB-07-skill-grind` | ❌ Wave 0 |
| JER-01 | rank field present on profile + valid value | smoke | `--invariant JER-01-rank-field` | ❌ Wave 0 |
| JER-02 | Rep crossing 500 auto-promotes pibe → soldado | invariant | `--invariant JER-02-threshold-promote` | ❌ Wave 0 |
| JER-03 | Mesa Chica = top 5 by Rep; human displaces AI when Rep exceeds | invariant | `--invariant JER-03-mesa-displacement` | ❌ Wave 0 |
| JER-04 | Líder elected at season-end (test via admin_set_season_window ended) | invariant | `--invariant JER-04-lider-election` | ❌ Wave 0 |
| ONB-05 | Tutorial state machine: complete_tutorial advances steps | smoke | `--invariant ONB-05-tutorial-steps` | ❌ Wave 0 |
| ONB-06 | Tutorial reward (trapo + cántico) granted atomically | invariant | `--invariant ONB-06-reward-atomic` | ❌ Wave 0 |

### Additional Invariants (Phase 3 internal correctness)

| Invariant ID | Test |
|--------------|------|
| LAB-IDLE-IDEMPOTENT | `collect_idle` twice in 1 sec → second returns ≈ 0. |
| LAB-IDLE-CAP | After 24h offline, collected Plata == 12 × rate (cap). |
| LAB-RECRUIT-RACE | 100 concurrent `recruit_pibe` calls with same pick_id → exactly 1 success. |
| LAB-RECRUIT-DAILY | Calling `admin_force_recruit_refresh` twice on same day → second is no-op (same generated_date_art). |
| LAB-TURNO-IDEMPOTENT | `submit_turno` twice for same fixture → second returns prior result, no double-credit. |
| LAB-TURNO-WINDOW-GATE | `submit_turno` outside window state `open|live` → 400 error. |
| LAB-TURNO-ENERGY-GATE | Pibe with energy < 30 cannot participate. |
| LAB-MESA-DEBOUNCE | Two consecutive `get_barra_state` calls within 5 min → mesa_recompute_last_at unchanged. |
| LAB-MESA-DETERMINISTIC | With Rep frozen, two consecutive recomputes produce identical Mesa order. |
| LAB-AI-SEED-IDEMPOTENT | Booting server twice → AI Mesa not re-seeded; baseline Rep unchanged. |
| LAB-RANK-DOWN | Rep loss + recompute → mesa member demoted to capo correctly. |
| LAB-VBC-LIDER-ONLY | Non-Líder cannot assign pibe to "hablar_cana". |
| LAB-CLOCK-SKEW | Test attempts to pass client timestamp; server ignores it (verified via abnormally large delta input). |
| LAB-PIBE-MIGRATION | Pre-Phase-3 user (with `pibes/main` only) → first get_roster migrates to `pibes/{uuid}`. |
| LAB-TUTORIAL-FREE-PIBE | Tutorial step 2: recruit_pibe bypasses 500 Plata cost. |
| LAB-COPY-VOCABULARY | grep -r "ataque\|raid\|robo\|pelea" nakama/src scripts/screens returns zero matches (Phase 3 banned words). |

### Sampling Rate

- **Per task commit:** `bash nakama/test/laboral-test.sh --quick` (LAB-IDLE-IDEMPOTENT, LAB-TURNO-IDEMPOTENT, LAB-RECRUIT-DAILY — the 3 highest-value smoke tests, < 30s total).
- **Per wave merge:** Full `bash nakama/test/laboral-test.sh` suite + Phase 2 `bash nakama/test/heartbeat-test.sh` to ensure no regression.
- **Phase gate:** Full suite green + manual playthrough of tutorial on Godot dev build (Android via `workflow_dispatch` if available, else Linux/Mac local).

### Wave 0 Gaps

- [ ] `nakama/test/laboral-test.sh` — new file, ~18 invariants. Mirror `heartbeat-test.sh` structure (bootstrap test user, run invariants serially, exit code on FAIL).
- [ ] Tutorial playthrough script (manual) — checklist in `nakama/test/laboral-test.md` for tasks no bash can verify (tutorial UX, copy vocabulary review).
- [ ] `nakama/test/admin-curl-examples-laboral.md` — sibling to `admin-curl-examples.md`; documents `admin_force_recruit_refresh`, `admin_grant_rep`, `admin_seed_ai_baseline` curl flows.
- [ ] No new test framework install (bash + curl + jq already proven).

---

## Security Domain

> `security_enforcement` not explicitly set in config (treated as enabled). Phase 3 inherits Phase 1-2 security posture; this section enumerates Phase-3-specific surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (inherited) | Nakama session token (Phase 1) — every RPC checks `ctx.userId`. |
| V3 Session Management | yes (inherited) | Nakama session lifecycle (Phase 1). |
| V4 Access Control | **yes (new surface)** | Phase 3 introduces rank-gated profession ("hablar_cana" — Líder only), recruit cost gates by rank (D-12), Mesa visibility (public read OK; permissionRead:2 confirmed). |
| V5 Input Validation | **yes (new surface)** | New inputs: `pibe_id` (UUID format), `pick_id` (UUID), `target_level` (1..5), `fixture_id` (string format), `profession` (enum), `pibe_ids[]` (array bounds + element format). |
| V6 Cryptography | yes (inherited) | Constant-time bearer compare from `admin_auth.ts`. No new crypto in Phase 3. |
| V11 Business Logic | **yes (new surface)** | Idempotency markers prevent double-spend, anti-replay on turno + recruit, server-authoritative time. |

### Known Threat Patterns for Phase 3 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side time manipulation → fake idle accrual | Tampering | Server `Date.now()` only; never accept client timestamps. §Pitfall 5. |
| Recruit pool race → multiple players grab same pick | Elevation of privilege (Plata economy) | Optimistic concurrency on `recruit_pool` write; first-wins. §Pitfall 1. |
| Turno replay → double-credit Rep | Tampering | `turnos/{fixture_id}` idempotency marker, write-FIRST pattern. §Code Examples Pattern 2. |
| Skill-grind exploit via fake collect | Tampering | `last_collected_at` server-stamped; only `collect_idle` mutates skill_hours. §Pitfall 2. |
| Energía buy-back (D-04 forbids) | Elevation | No energy-buyable RPC exists Phase 3. Verified absence by grep `energia` in Phase 3 RPC sources. |
| Profession privilege escalation ("hablar_cana" by non-Líder) | Elevation | `assign_profession` validates `profile.rank == "lider"` before accepting "hablar_cana". §RPC Surface. |
| Recruit cost bypass | Tampering | Server reads profile.plata + profile.rank + profile.pibes_recruited_total; never trusts client-supplied cost. |
| AI baseline manipulation | Tampering | `seedAiBaseline` writes are server-only (permissionWrite:0); only `admin_seed_ai_baseline` RPC mutates, gated by `requireAdmin`. |
| Mesa displacement gaming via fake Rep | Tampering | Rep deltas server-computed only (turno output, admin grant). No client-supplied Rep. |
| Tutorial reward replay | Tampering | `complete_tutorial` checks `tutorial_done` flag; returns prior reward state on replay. |
| Banner/copy regulatory risk | Information disclosure (regulatory) | Phase 3 vocabulary gate §Pitfall 8 — banned word grep in test harness. |

### Phase-3-Specific Threat Notes

1. **Plata is the only currency mutated by RPCs that touch player input.** Audit trail: write a one-line `logger.info('[plata] user=%s delta=%d source=%s now=%d after=%d', ...)` on every Plata mutation. Cheap, observable, debuggable.

2. **Reputación is server-authored only** (no direct client input). Mutated by: `submit_turno` (turno output) and `admin_grant_rep` (testing). No third path.

3. **VBC is Líder-only.** Tests must confirm: if a non-Líder calls `assign_profession("hablar_cana")` it MUST fail with `error: "lider_only"`. Edge case: what if player WAS Líder but lost re-election? `assign_profession` re-reads rank each call → safe. Pibes currently assigned to "hablar_cana" when rank lost: kept assigned (no auto-reassignment), but accrual computes 0 VBC because rate is `vbc:1` × `multiplier` × `effectiveRate` — Phase 3 simplification: keep accruing as if Líder; document as known caveat. Cleaner: `accrueIdleForPibe` re-validates rank, zero-out if non-Líder. **Recommendation: zero-out.**

4. **No new secret material.** No new env vars, no new bearer tokens. Phase 3 ships with zero secret rotation.

---

## Sources

### Primary (HIGH confidence)

- `nakama/src/scheduler/leaderboard_cron.ts` - Goja AST constraint, cron-via-leaderboard pattern, dispatch-by-id idiom. `[VERIFIED]`
- `nakama/src/scheduler/tick.ts` - Distributed lock pattern (`KEY_TICK_LOCK`, 5-min TTL), state machine read/modify/write. `[VERIFIED]`
- `nakama/src/scheduler/windows.ts` - Optimistic concurrency on storage write (version field), idempotency marker before side-effect pattern. `[VERIFIED]`
- `nakama/src/scheduler/seasons.ts` - Singleton record write-only-on-change pattern (avoid write churn). `[VERIFIED]`
- `nakama/src/util/admin_auth.ts` - Constant-time bearer compare. `[VERIFIED]`
- `nakama/src/rpc/create_pibe.ts` - Server-side validation + permissionRead/Write idiom + atomic batch write. `[VERIFIED]`
- `nakama/src/rpc/get_current_window.ts` - Paginated storageList pattern (50 × 100), filter-on-read. `[VERIFIED]`
- `nakama/src/storage_keys.ts` + `scripts/autoloads/StorageKeys.gd` - Mirror invariant, single source of truth. `[VERIFIED]`
- `.planning/phases/02-heartbeat-afa/02-CONTEXT.md` - Phase 2 decisions D-01..D-27 (state machine, FCM, Goja AST hot-fixes). `[VERIFIED]`
- `.planning/phases/03-core-loop-laboral/03-CONTEXT.md` - All 16 Phase 3 decisions D-01..D-16. `[VERIFIED]`
- `.planning/REQUIREMENTS.md` - AGT-01..05, PIB-01..07, JER-01..04, ONB-05..06 verbatim. `[VERIFIED]`
- `.planning/ROADMAP.md` - Phase 3 goal + success criteria + outputs. `[VERIFIED]`
- `.planning/STATE.md` - Phase 2 complete-with-deferral, Plan 02-07 (Android FCM) deferred to Phase 7. `[VERIFIED]`
- `CLAUDE.md` - Solo dev, $40/mo budget, lunfardo tone, server-auth, no chat, no gacha, App Store framing. `[VERIFIED]`
- `nakama/data/clubs.json` - 153 clubs across 5 divisions, ID format snake_case slugs. `[VERIFIED: ran node -e]`
- `nakama/test/heartbeat-test.sh` - bash+curl+jq pattern for invariants suite. `[VERIFIED]`

### Secondary (MEDIUM confidence)

- Nakama TypeScript runtime docs (referenced in Phase 2 RESEARCH) - storage API behavior, version-based optimistic concurrency. `[CITED: heroiclabs.com/docs/nakama/server-framework/typescript-runtime — full reference page truncated in fetch but storage behavior confirmed by working windows.ts implementation]`
- Argentina timezone (UTC-3 year-round, no DST since 2009) - widely cited public knowledge. `[CITED: public sources, no DST in AR since 2009]`

### Tertiary (LOW confidence — assumed dials, see Assumptions Log)

- AI baseline Rep curve constants A1 - game-design tuning dial, no external source. `[ASSUMED]`
- Aguantadero cost ladder A2 - game-design dial. `[ASSUMED]`
- Energía cost calibration A4 - game-design dial. `[ASSUMED]`
- Mesa debounce window A7 - tunable. `[ASSUMED]`
- Avatar placeholder strategy A6 - art deferred Phase 7. `[ASSUMED]`
- Trait pool expansion to 12 entries A11 - exceeds CONTEXT minimum. `[ASSUMED]`
- Apodos/Nombres list amplification A12 - exceeds CONTEXT minimum. `[ASSUMED]`

---

## Dependencies & Sequencing

Phase 3 plan structure recommendation (planner finalizes):

**Wave 0: Foundations & Seeding (no inter-task deps)**
- Plan 03-01: Storage constants (server + client mirror) + admin RPCs (`admin_force_recruit_refresh`, `admin_grant_rep`, `admin_seed_ai_baseline`) + AI baseline seed wired in InitModule + cron leaderboard creation (`bb_recruit_05_art`, `bb_mesa_recompute_1h`) + extend `onSchedulerLeaderboardReset` dispatcher.

**Wave 1: Server Logic (depends on Wave 0)**
- Plan 03-02: Read-side player RPCs (`get_roster` w/ migration + lazy energy regen, `get_aguantadero`, `get_barra_state`, `get_recruit_pool`) + helpers (`accrueIdleForPibe`, `regenEnergia`, `generatePick`).
- Plan 03-03: Write-side player RPCs (`assign_profession`, `collect_idle`, `recruit_pibe`, `upgrade_aguantadero`, `submit_turno`, `complete_tutorial`) + helpers (`checkRankTransition`, `recomputeMesa`) + cron handlers (`runRecruitRefresh`, `runMesaRecomputeAll`) + season-end Líder hook (extend `seasons.ts`).

**Wave 2: Godot Client (depends on Wave 1 RPCs deployed)**
- Plan 03-04: 7 new Godot screens + PlayerStore extension + NakamaService 10 new wrappers + FlowRouter tutorial integration + HomeScreen widgets.

**Wave 3: Validation (depends on Wave 2)**
- Plan 03-05: `nakama/test/laboral-test.sh` invariants suite + admin-curl-examples-laboral.md + INFRA-NOTES Phase 3 sections + Phase 3 closing checklist.

This is a 5-plan estimate, sized similarly to Phase 2 (8/9 plans where some were tiny). Planner may collapse 03-02 + 03-03 if RPCs feel cohesive, or split 03-04 if Godot UI work exceeds plan budget.

**Critical path:** Wave 0 (storage + AI seed) → Wave 1 (RPCs) → Wave 2 (UI) → Wave 3 (validation). No parallel work between waves; within a wave, tasks can be parallelized.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all reused from Phases 1-2 (verified).
- Storage schema: HIGH — patterns directly mirror Phase 2 verified code; mirror invariant well-understood.
- RPC surface: HIGH — every RPC follows verified Phase 2 idempotency + auth + atomic-write pattern.
- Lazy compute algorithms: HIGH for math (deterministic functions, verified pattern); MEDIUM for constants (game-design dials).
- Daily cron: HIGH — direct extension of Phase 2 `leaderboard_cron.ts` verified pattern.
- AI population: HIGH on mechanism (embedded array, seed marker); MEDIUM on baseline curve constants (dials).
- Procedural pibe: HIGH on architecture; MEDIUM on list content (game-design refinable).
- Rank transitions: HIGH — pure state machine with debounce + idempotent writeback.
- Turno mechanic: HIGH — direct Phase 2 idempotency pattern.
- Tutorial: MEDIUM — Godot client-side state machine; depends on UX-SPEC details that don't exist yet.
- Godot UI: MEDIUM — screen count + reuse patterns clear; pixel/layout details defer to UI-SPEC gate.
- Validation: HIGH — direct extension of Phase 2 `heartbeat-test.sh` pattern, 18 invariants enumerated.
- Security: HIGH — surface area enumerated; no new crypto; well-understood threat patterns.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days — stable codebase, no fast-moving external dependencies that would invalidate Phase 3 patterns)

---

## RESEARCH COMPLETE

1. **Architecture is a direct extension of Phase 2 — no new infra, no new external services.** All 13 new RPCs and 2 new cron leaderboards plug into the existing Goja IIFE + Nakama Storage + leaderboard-cron primitives that Phase 2 hardened.
2. **Storage schema locked:** 4 new collections (`aguantaderos`, `barra_state`, `recruit_pool`, `turnos`) + extensions to existing `pibes` (multi-record migration) and `players` (resource fields). Mirror invariant rules unchanged from CR-01 lesson.
3. **Lazy compute is the universal pattern:** Plata accrual + Energía regen + rank transitions + AI baseline Rep all compute on read with idempotency markers — zero per-user cron, scales with reads.
4. **Game-design dials are isolated:** AI baseline Rep curve, aguantadero cost ladder, energy/turno calibration are all exported `const` values in dedicated tuning files for post-launch one-line tweaks (12 assumption tags in Assumptions Log).
5. **Recommended sequencing: 5 plans across 4 waves** — Wave 0 (storage + AI seed + admin), Wave 1a/1b (read RPCs / write RPCs), Wave 2 (Godot UI), Wave 3 (laboral-test.sh invariants + INFRA-NOTES). Critical Goja AST and idempotency rules carried over from Phase 2 hot-fixes are codified in §Common Pitfalls so Phase 3 doesn't re-pay the same cost.
