# Phase 3: Core Loop Laboral — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** ~32 new/modified files (13 Nakama RPCs/helpers, 4 storage/schema additions, 1 main.ts edit, 1 leaderboard_cron extend, 1 seasons.ts extend, 12 Godot screens/components, 3 Godot autoload extensions, 1 test script)
**Analogs found:** 30 / 32 (2 brand-new with no analog — see §No Analog Found)

> Stack reminders: Backend = Nakama 3.x TypeScript (Goja IIFE) at `nakama/src/`. Client = Godot 4.3 (`scripts/` + `scenes/`). Storage = Nakama schemaless KV. Skills available at `.agents/skills/` (use `hooked-ux`, `onboarding-design`, `state-machine`, `ux-writing` as referenced in RESEARCH §Project Skills Applicable).

---

## File Classification

### Backend — Nakama TypeScript (`nakama/src/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `nakama/src/storage_keys.ts` (EXTEND) | constants module | n/a | `nakama/src/storage_keys.ts` itself (Phase 2 additions block) | exact (extend existing file) |
| `nakama/src/main.ts` (EXTEND) | runtime entrypoint | n/a | `nakama/src/main.ts` itself (Phase 2 inline `registerRpc` block) | exact (extend existing file) |
| `nakama/src/laboral/idle_accrual.ts` (NEW) | shared helper (pure compute) | transform | `nakama/src/scheduler/windows.ts` `upsertOrTransitionWindow` (read-modify-write idem) | role-match |
| `nakama/src/laboral/rank.ts` (NEW) | shared helper (pure compute) | transform | `nakama/src/scheduler/windows.ts` `markWindowCancelled` (small idem mutator) | role-match |
| `nakama/src/laboral/mesa.ts` (NEW) | shared helper (storage walk + write) | batch | `nakama/src/scheduler/tick.ts` `findNextKickoffWithin24h` (paginated `storageList` over system collection) | role-match |
| `nakama/src/laboral/pibe_factory.ts` (NEW) | shared helper (pure compute) | transform | `nakama/src/util/validation.ts` (pure module, constants + small functions) | role-match |
| `nakama/src/laboral/ai_seed.ts` (NEW) | boot-time seeder | batch write | `nakama/src/main.ts` `seedClubs` (idempotent system-owned seed w/ version marker) | exact |
| `nakama/src/rpc/get_roster.ts` (NEW) | player RPC | request-response (read + lazy compute) | `nakama/src/rpc/get_current_window.ts` (player read + system-collection scan + lunfardo error copy) | exact |
| `nakama/src/rpc/get_aguantadero.ts` (NEW) | player RPC | request-response (pure read) | `nakama/src/rpc/get_current_window.ts` (profile read + storage lookup) | exact |
| `nakama/src/rpc/get_barra_state.ts` (NEW) | player RPC | request-response (read + debounced recompute) | `nakama/src/rpc/get_current_window.ts` (system-owned read, public permission) | exact |
| `nakama/src/rpc/get_recruit_pool.ts` (NEW) | player RPC | request-response (read with field redaction) | `nakama/src/rpc/get_clubs.ts` (paginated read of system-owned collection w/ filtering) | role-match |
| `nakama/src/rpc/assign_profession.ts` (NEW) | player RPC | CRUD (read-modify-write per-pibe) | `nakama/src/rpc/create_pibe.ts` (input validation + storage write per-user) | role-match |
| `nakama/src/rpc/collect_idle.ts` (NEW) | player RPC | CRUD (atomic batch write) | `nakama/src/rpc/create_pibe.ts` (multi-collection atomic write block) | role-match |
| `nakama/src/rpc/recruit_pibe.ts` (NEW) | player RPC | CRUD (optimistic concurrency on shared pool) | `nakama/src/scheduler/windows.ts` `upsertOrTransitionWindow` (`version`-based optimistic write) | role-match |
| `nakama/src/rpc/upgrade_aguantadero.ts` (NEW) | player RPC | CRUD (validate + write) | `nakama/src/rpc/create_pibe.ts` (validation cascade + atomic write) | role-match |
| `nakama/src/rpc/submit_turno.ts` (NEW) | player RPC | CRUD (idempotency marker FIRST, then atomic batch) | `nakama/src/scheduler/windows.ts` `upsertOrTransitionWindow` (anti-double-push marker pattern via `notified_open_at`) | exact (pattern, not file) |
| `nakama/src/rpc/complete_tutorial.ts` (NEW) | player RPC | CRUD (idempotent reward grant) | `nakama/src/rpc/register_fcm_token.ts` (singleton per-user write, idem on re-call) | role-match |
| `nakama/src/rpc/admin_force_recruit_refresh.ts` (NEW) | admin RPC | request-response | `nakama/src/rpc/admin_close_window.ts` (admin auth + audit log + state mutation) | exact |
| `nakama/src/rpc/admin_grant_rep.ts` (NEW) | admin RPC | CRUD (per-user write w/ side effects) | `nakama/src/rpc/admin_postpone_fixture.ts` (admin auth + state mutation + audit) | exact |
| `nakama/src/rpc/admin_seed_ai_baseline.ts` (NEW) | admin RPC | batch write | `nakama/src/rpc/admin_inject_test_fixture.ts` (admin auth + batch storage write + audit) | exact |
| `nakama/src/scheduler/leaderboard_cron.ts` (EXTEND) | scheduler registration | event-driven | `nakama/src/scheduler/leaderboard_cron.ts` itself (`ensureSchedulerLeaderboards` + dispatcher) | exact (extend existing file) |
| `nakama/src/scheduler/recruit_cron.ts` (NEW) | scheduled job | batch | `nakama/src/scheduler/tick.ts` `runHeartbeatTick` (distributed lock + paginated work loop + finally-release) | exact |
| `nakama/src/scheduler/mesa_cron.ts` (NEW) | scheduled job | batch | `nakama/src/scheduler/tick.ts` `runHeartbeatTick` (lock + walk + write loop) | exact |
| `nakama/src/scheduler/seasons.ts` (EXTEND) | scheduler — season-end Líder hook | event-driven | `nakama/src/scheduler/seasons.ts` itself (`detectSeasonState` status transition writeback) | exact (extend existing file) |

### Client — Godot (`scripts/` + `scenes/`)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/autoloads/StorageKeys.gd` (EXTEND) | constants autoload | n/a | `scripts/autoloads/StorageKeys.gd` itself (Phase 2 additions) | exact (extend existing file) |
| `scripts/autoloads/NakamaService.gd` (EXTEND) | RPC wrapper autoload | request-response | `scripts/autoloads/NakamaService.gd` `get_current_window` + `register_fcm_token` | exact (extend existing file) |
| `scripts/autoloads/PlayerStore.gd` (EXTEND) | cache + signals autoload | event-driven | `scripts/autoloads/PlayerStore.gd` `load_from_server` + Phase 2 fields | exact (extend existing file) |
| `scripts/autoloads/FlowRouter.gd` (EXTEND) | navigation autoload | event-driven | `scripts/autoloads/FlowRouter.gd` `confirm_club_pick` | exact (extend existing file) |
| `scripts/screens/HomeScreen.gd` (EXTEND) + `.tscn` | screen | event-driven | `scripts/screens/HomeScreen.gd` (Phase 2 banner + `_notification(NOTIFICATION_APPLICATION_RESUMED)`) | exact (extend existing file) |
| `scripts/screens/RosterScreen.gd` + `.tscn` (NEW) | screen | request-response | `scripts/screens/ClubPickerScreen.gd` (scroll + filter chips + card pool reuse + RPC paginated load) | exact |
| `scripts/screens/RecruitScreen.gd` + `.tscn` (NEW) | screen | CRUD (read pool + write recruit) | `scripts/screens/ClubPickerScreen.gd` (card list + selection + CTA gate) | role-match |
| `scripts/screens/PibeDetailScreen.gd` + `.tscn` (NEW) | screen | CRUD | `scripts/screens/PibeCreatorScreen.gd` (single-entity edit form + RPC + error label) | role-match |
| `scripts/screens/ProfessionAssignScreen.gd` + `.tscn` (NEW) | screen | CRUD | `scripts/screens/PibeCreatorScreen.gd` (gated CTA + RPC + lunfardo error mapping) | role-match |
| `scripts/screens/AguantaderoScreen.gd` + `.tscn` (NEW) | screen | CRUD | `scripts/screens/PibeCreatorScreen.gd` (single-entity view + upgrade CTA + error inline) | role-match |
| `scripts/screens/TutorialScreen.gd` (EXTEND, multi-step) + `.tscn` | screen — state machine | event-driven | `scripts/screens/TutorialScreen.gd` itself (single-step Phase 1 — extend to N steps); `scripts/screens/ClubPickerScreen.gd` (chip state pattern) | exact (extend existing file) |
| `scripts/components/TurnoModal.gd` + `scenes/TurnoModal.tscn` (NEW) | component (modal) | CRUD | `scripts/screens/HomeScreen.gd` `_on_delete` + `_perform_delete` (ConfirmationDialog overlay + disable-CTA-during-RPC + error AcceptDialog) | role-match |
| `scripts/components/PibeCard.gd` + `.tscn` (NEW) | component | event-driven | `scripts/components/ClubCard.gd` + `scenes/components/ClubCard.tscn` (PanelContainer + HBox/VBox + `tapped` signal + `set_*` setters) | exact |
| `scripts/components/RecruitCard.gd` + `.tscn` (NEW) | component | event-driven | `scripts/components/ClubCard.gd` (same card template; bigger + with CTA) | exact |
| `scripts/components/ResourceWidget.gd` + `.tscn` (NEW) | component (read-only) | display | `scripts/components/NavButton.gd` (small fixed-size composite VBox w/ ColorRect + Label, `AppTheme` color tokens) | role-match |
| `scripts/components/RankBadge.gd` + `.tscn` (NEW) | component | display | `scripts/components/ChipButton.gd` (PanelContainer + StyleBoxFlat cached + label color toggle) | role-match |
| `scripts/components/TraitChip.gd` + `.tscn` (NEW) | component | display | `scripts/components/ChipButton.gd` (small chip w/ cached StyleBoxFlat + sentiment border color) | exact |
| `scripts/components/EnergiaBar.gd` + `.tscn` (NEW) | component | display | `scripts/components/ChipButton.gd` (`StyleBoxFlat` w/ threshold-driven `bg_color` swap) + `scripts/autoloads/AppTheme.gd` (token lookup) | role-match |
| `scripts/components/ProfessionIcon.gd` + `.tscn` (NEW) | component | display | `scripts/components/NavButton.gd` (icon-+-label composite w/ tint via `modulate`) | role-match |
| `scripts/components/SkillProgressRing.gd` + `.tscn` (NEW) | component (custom-drawn) | display | (none — see §No Analog Found) | none |
| `scripts/autoloads/AppTheme.gd` (EXTEND) | theme constants | n/a | `scripts/autoloads/AppTheme.gd` itself (RES_PLATA/AGUANTE/REP/VBC tokens + rank/profession palettes) | exact (extend existing file) |
| `nakama/data/clubs.json` (touched, optional) | JSON data | n/a | `nakama/data/clubs.json` itself | exact |

### Test

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `nakama/test/laboral-test.sh` (NEW) | shell invariants test | request-response (curl-driven) | `nakama/test/heartbeat-test.sh` (bash + curl + jq, ADMIN_BEARER, basic_auth/console_auth, pass/fail/skip helpers, RPC test pattern) | exact |

---

## Pattern Assignments

### `nakama/src/storage_keys.ts` (EXTEND — constants)

**Analog:** `nakama/src/storage_keys.ts` itself (Phase 2 extension block at lines 27-39).

**Pattern — append-only constants block with explanatory header:**
```typescript
// nakama/src/storage_keys.ts:27-39 — Phase 2 additions pattern
// Phase 2: AFA scheduler + push + admin.
export const COL_FIXTURES = 'fixtures';
export const COL_MATCH_WINDOWS = 'match_windows';
export const COL_FCM_TOKENS = 'fcm_tokens';
export const COL_ADMIN_ACTIONS = 'admin_actions';

// COL_RESET_TOKENS already exists at line 14 — Phase 2 starts writing to it.
// COL_META reused for scheduler/season/oauth/league-id state under keyed entries.
export const KEY_TICK_LOCK = 'tick_lock';
export const KEY_SCHEDULER_STATE = 'scheduler_state';
export const KEY_CURRENT_SEASON = 'current_season';
```

**Copy verbatim for Phase 3 additions (RESEARCH §Storage Schema lines 270-284):**
- Append a `// Phase 3: Core Loop Laboral` divider comment, then `COL_AGUANTADEROS`, `COL_BARRA_STATE`, `COL_RECRUIT_POOL`, `COL_TURNOS`, `KEY_AGUANTADERO_MAIN`, `KEY_RECRUIT_LOCK`, `KEY_MESA_DEBOUNCE_PREFIX`, `KEY_AI_SEED_VERSION`.
- Reuse `SYSTEM_USER_ID` constant (already exported line 25) for all system-owned writes.

---

### `scripts/autoloads/StorageKeys.gd` (EXTEND — client mirror)

**Analog:** `scripts/autoloads/StorageKeys.gd` itself (Phase 2 additions lines 22-28).

**Pattern — selective mirror (only client-read collections):**
```gdscript
# scripts/autoloads/StorageKeys.gd:22-28 — Phase 2 mirror pattern
# Phase 2 additions — mirror nakama/src/storage_keys.ts.
# Only collections the CLIENT reads are mirrored (CR-01 lesson: keep mirror tight to avoid drift).
# Server-internal collections (admin_actions, fcm_oauth_token, tick_lock, etc.) are omitted.
const COL_MATCH_WINDOWS := "match_windows"
# COL_FIXTURES — client never reads directly (goes via get_current_window RPC), skip mirror.
```

**Copy pattern for Phase 3:** add `COL_AGUANTADEROS`, `COL_BARRA_STATE`, `COL_RECRUIT_POOL`, `KEY_AGUANTADERO_MAIN`. Explicitly comment-out / skip `COL_TURNOS` (client never reads — only writes via `submit_turno` RPC and reads back via `get_roster`).

---

### `nakama/src/main.ts` (EXTEND — runtime entrypoint)

**Analog:** `nakama/src/main.ts` itself (Phase 2 inline registration block at lines 141-160).

**Pattern — inline `registerRpc` calls inside `InitModule` body (Goja AST gotcha):**
```typescript
// nakama/src/main.ts:125-162 — Goja AST safety + Phase 2 inline registration
// MUST be a function declaration (or `var InitModule = function() {}`), NOT an
// arrow function. Nakama parses the bundle AST looking for either pattern in
// findInitModuleFn (server/runtime_javascript_init_module.go) — arrow functions
// are ignored, causing `failed to find InitModule function` from registerRpc.
export function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  logger.info('BarraBrava runtime starting...');

  seedClubs(nk, logger);

  ensureSchedulerLeaderboards(nk, logger);
  // NOTE: registerLeaderboardReset MUST be invoked directly here as an
  // ExpressionStatement in InitModule body — Nakama's AST walker does not
  // descend into helper functions. See scheduler/leaderboard_cron.ts comment.
  initializer.registerLeaderboardReset(onSchedulerLeaderboardReset);

  initializer.registerRpc('get_clubs', rpcGetClubs);
  initializer.registerRpc('create_pibe', rpcCreatePibe);
  // ...
}
```

**Copy pattern for Phase 3 (RESEARCH §RPC Surface lines 542-567):**
1. `import` each new `rpc*` function at top of file (mirror lines 14-30 import style).
2. Call `seedAiBaseline(nk, logger)` immediately after `seedClubs(nk, logger)` (idempotent).
3. Call `ensureLaboralLeaderboards(nk, logger)` immediately after `ensureSchedulerLeaderboards`.
4. DO NOT add a second `initializer.registerLeaderboardReset(...)` — the single existing one dispatches by `lb.id` (Phase 2 pattern — see leaderboard_cron.ts §Pattern below).
5. Append each `initializer.registerRpc('<name>', rpc<Fn>)` as a top-level `ExpressionStatement` inside `InitModule` body. No helper wrappers.
6. Update the final `logger.info('BarraBrava runtime ready: N RPCs registered + scheduler armed')` count.

---

### `nakama/src/rpc/get_roster.ts` (NEW — player RPC, read + lazy compute)

**Analog:** `nakama/src/rpc/get_current_window.ts` (lines 1-93).

**Imports pattern** (lines 16-17):
```typescript
import { COL_PLAYERS, COL_MATCH_WINDOWS, COL_META, SYSTEM_USER_ID } from '../storage_keys';
```

**Auth + JSON parse + profile-lookup pattern** (lines 21-37):
```typescript
export function rpcGetCurrentWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');

  const profileRead = nk.storageRead([{
    collection: COL_PLAYERS, key: 'profile', userId,
  }]);
  if (profileRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });

  const profile = profileRead[0].value as { club_id?: string };
  const clubId = profile.club_id;
  if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });
```

**Paginated storageList + logger.info return pattern** (lines 53-93):
```typescript
let cursor = '';
for (let i = 0; i < 50; i++) {
  const page = nk.storageList(SYSTEM_USER_ID, COL_MATCH_WINDOWS, 100, cursor);
  for (const obj of (page.objects || [])) {
    // process obj.value
  }
  if (!page.cursor) break;
  cursor = page.cursor;
}
// ...
logger.info('[get_window] user=%s club=%s team_id=%d state=%s', ...);
return JSON.stringify({ ok: true, window: earliest });
```

**Apply to `get_roster.ts`:**
- Read all `COL_PIBES` records owned by `userId` via `nk.storageList(userId, COL_PIBES, 100, cursor)` (S2 cap 50 pages × 100).
- For each pibe, call `accrueIdleForPibe(pibe, now)` and `regenEnergia(pibe, now)` from `nakama/src/laboral/idle_accrual.ts`.
- Write back any pibe whose state changed in a single `nk.storageWrite([...])` batch (atomic).
- Run `checkRankTransition(nk, logger, profile, userId)` after Rep credits; include `recent_rank_change` in response (per RESEARCH §Push Notification line 1009).
- Return `{ ok: true, pibes: PibeView[], pibes_count, roster_cap, recent_rank_change? }`.
- Log line: `logger.info('[get_roster] user=%s pibes=%d cap=%d', userId, pibes.length, rosterCap)`.

---

### `nakama/src/rpc/get_aguantadero.ts` (NEW — player RPC, pure read)

**Analog:** `nakama/src/rpc/get_current_window.ts` (same header pattern; degenerate to single `storageRead`).

**Pattern — single owner-keyed read:**
```typescript
// Adapt nakama/src/rpc/get_current_window.ts lines 21-37 (auth + profile read).
// Then a second storageRead for COL_AGUANTADEROS / KEY_AGUANTADERO_MAIN keyed to userId.
const aguRead = nk.storageRead([{
  collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
}]);
if (aguRead.length === 0) {
  // Auto-bootstrap on first read — see admin_inject_test_fixture style for storageWrite shape.
}
```

**Copy from:** `nakama/src/rpc/create_pibe.ts:100-122` for the `permissionRead: 1, permissionWrite: 0` defaults of an owner-only blob.

---

### `nakama/src/rpc/get_barra_state.ts` (NEW — system-owned read, public permission)

**Analog:** `nakama/src/rpc/get_current_window.ts` lines 39-44 for system-collection lookup.

**Pattern — read from `SYSTEM_USER_ID` collection:**
```typescript
// nakama/src/rpc/get_current_window.ts:39-44 — system-owned read pattern
const mapRead = nk.storageRead([{
  collection: COL_META, key: 'club_team_map', userId: SYSTEM_USER_ID,
}]);
const teamMap: Record<string, number> = mapRead.length > 0
  ? (mapRead[0].value as Record<string, number>)
  : {};
```

**Apply to `get_barra_state.ts`:** read `{ collection: COL_BARRA_STATE, key: clubId, userId: SYSTEM_USER_ID }`. If `mesa_recompute_pending && now - mesa_recompute_last_at > 5min`, call `recomputeMesa(nk, logger, clubId)` inline (RESEARCH §Mesa Chica Recompute lines 672-693).

---

### `nakama/src/rpc/get_recruit_pool.ts` (NEW — read with field redaction)

**Analog:** `nakama/src/rpc/get_clubs.ts` lines 22-98 (paginated system-owned read with filtering).

**Pattern — `get_clubs` storage walk + filter + response shape:**
```typescript
// nakama/src/rpc/get_clubs.ts:47-60 — paginated storageList + aggregate
let cursor = '';
const all: any[] = [];
for (let i = 0; i < 50; i++) {
  const result = nk.storageList(SYSTEM_USER_ID, COL_CLUBS, 100, cursor);
  if (result.objects && result.objects.length > 0) {
    for (let j = 0; j < result.objects.length; j++) {
      all.push(result.objects[j].value);
    }
  }
  if (!result.cursor) break;
  cursor = result.cursor;
}
```

**Apply to `get_recruit_pool.ts`:** simpler — single `storageRead({ collection: COL_RECRUIT_POOL, key: profile.club_id, userId: SYSTEM_USER_ID })`. CRITICAL: server MUST redact `trait_2` per pick before serializing — return `{ trait_2_hidden: true }` (RESEARCH §Storage Schema line 471, D-10 anti-cheat). Never leak the value.

---

### `nakama/src/rpc/assign_profession.ts` + `collect_idle.ts` + `recruit_pibe.ts` + `upgrade_aguantadero.ts` (NEW — CRUD)

**Analog:** `nakama/src/rpc/create_pibe.ts` (lines 1-127) — cascade validation + storage write block.

**Imports + payload parse + validation cascade pattern** (lines 14-77):
```typescript
// nakama/src/rpc/create_pibe.ts:42-77 — validation cascade
export function rpcCreatePibe(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('not_authenticated');
  }

  let input: CreatePibeInput;
  try {
    input = (payload ? JSON.parse(payload) : {}) as CreatePibeInput;
  } catch (e) {
    throw new Error('invalid_json_payload');
  }

  // Name validation (server-side — T-1-RT-03, T-1-RT-04).
  const nameCheck = validatePibeName(input.name);
  if (!nameCheck.ok) {
    return JSON.stringify({ ok: false, error: nameCheck.error });
  }
```

**Atomic multi-collection write pattern** (lines 100-122):
```typescript
nk.storageWrite([
  {
    collection: COL_PIBES,
    key: KEY_PIBE_MAIN,
    userId,
    value: pibe,
    permissionRead: 1, // owner read
    permissionWrite: 0, // never client-write — server only via RPC
  },
  {
    collection: COL_PLAYERS,
    key: KEY_PLAYER_PROFILE,
    userId,
    value: {
      display_name: name,
      club_id: clubId,
      pibe_id: pibeId,
      created_at: now,
    },
    permissionRead: 2, // public — used by club roster screens in later phases
    permissionWrite: 0,
  },
]);
```

**Apply to Phase 3 CRUD RPCs:**
- `assign_profession.ts`: validate `pibe_id` belongs to `userId`, validate profession enum (incl. Líder gate for `hablar_cana`), call `accrueIdleForPibe` first to stamp `last_collected_at` BEFORE switching, then write pibe back.
- `collect_idle.ts`: walk owner's pibes, sum `plata_delta`/`vbc_delta`, atomic write of pibes + profile in single `storageWrite([...])` batch.
- `recruit_pibe.ts`: must use optimistic concurrency on `recruit_pool` write (see windows.ts pattern below) to prevent two players grabbing same pick.
- `upgrade_aguantadero.ts`: validate `target_level == current+1`, validate Plata cost, atomic write of `aguantaderos` + `players/profile` (deduct Plata).

---

### `nakama/src/rpc/submit_turno.ts` (NEW — idempotency marker FIRST)

**Analog:** `nakama/src/scheduler/windows.ts` `upsertOrTransitionWindow` (lines 85-176) — the `notified_open_at` anti-double-fire pattern.

**Pattern — write idempotency marker FIRST, then side-effects (lines 125-176):**
```typescript
// nakama/src/scheduler/windows.ts:125-152 — anti-double-fire marker pattern
const shouldNotify =
  (!prev || prev.state === 'scheduled') &&
  desiredState !== 'scheduled' &&
  !next.notified_open_at;

// Write FIRST with the notification marker — atomic anti-double-send.
if (shouldNotify) next.notified_open_at = now;

try {
  nk.storageWrite([
    {
      collection: COL_MATCH_WINDOWS,
      key: f.fixture_id,
      userId: SYSTEM_USER_ID,
      value: next as unknown as { [key: string]: unknown },
      version: existing.length > 0 ? existing[0].version : '*', // optimistic
      permissionRead: 2,
      permissionWrite: 0,
    },
  ]);
} catch (e) {
  logger.warn(
    '[window] concurrent update for %s; will retry next tick',
    f.fixture_id,
  );
  return;
}

// Send push AFTER successful write — failure here is acceptable (logged).
if (shouldNotify) {
  // ...
}
```

**Apply to `submit_turno.ts`:**
1. Read `match_windows/{fixture_id}` (must be `open|live`) — copy `get_current_window.ts:39-51` pattern.
2. Read `turnos/{fixture_id}` for this user. If exists, return prior `{ok: true, ...result}` directly.
3. Read all pibe records (storageRead batch), validate energy ≥ 30 and not `en_turno`.
4. Read `players/profile` and `barra_state/{club_id}`.
5. **Write `turnos/{fixture_id}` FIRST** with full deltas (idempotency marker — RESEARCH §Idempotency Critical Path line 1046).
6. Then atomic batch: pibes (energy -40, `en_turno_until`), barra_state (+50×N Aguante), profile (+20×N Rep + rank transition).
7. Use `version` optimistic concurrency on barra_state write (windows.ts pattern). On `concurrent_update` exception → `logger.warn` + return same result the next retry will see.

---

### `nakama/src/rpc/complete_tutorial.ts` (NEW — idempotent reward grant)

**Analog:** `nakama/src/rpc/register_fcm_token.ts` (lines 17-50) — small payload-driven singleton write.

**Pattern — minimal validation + single-shot write (lines 22-50):**
```typescript
// nakama/src/rpc/register_fcm_token.ts:22-50
export function rpcRegisterFcmToken(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');

  let input: { token?: unknown; platform?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_json_payload' }); }

  if (typeof input.token !== 'string' || input.token.length === 0)
    return JSON.stringify({ ok: false, error: 'token_required' });
  // ...

  nk.storageWrite([{
    collection: COL_FCM_TOKENS,
    key: 'token',
    userId,
    value: { ... },
    permissionRead: 0,
    permissionWrite: 0,
  }]);

  logger.info('[register_fcm] user=%s platform=%s', userId, input.platform);
  return JSON.stringify({ ok: true, registered: true });
}
```

**Apply to `complete_tutorial.ts`:**
- Read profile. If `tutorial_done == true`, return current `reward` state (idempotent).
- Otherwise atomic write: profile (`tutorial_done = true`, `tutorial_step = FINAL`) + aguantaderos (append `tutorial_trapo` placeholder to `trapos_robados[]`). Follow `create_pibe.ts:100-122` multi-collection batch shape.

---

### `nakama/src/rpc/admin_*.ts` (NEW — 3 admin RPCs)

**Analog:** `nakama/src/rpc/admin_close_window.ts` (lines 1-56) — admin auth + audit log + state mutation. Also `admin_inject_test_fixture.ts` for batch-write admin pattern.

**Auth gate + audit log pattern** (admin_close_window.ts lines 13-56):
```typescript
// nakama/src/rpc/admin_close_window.ts:13-56 — admin auth + audit pattern
import { requireAdmin } from '../util/admin_auth';
import { COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';

export function rpcAdminCloseWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { fixture_id?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (typeof input.fixture_id !== 'string' || input.fixture_id.length === 0)
    return JSON.stringify({ ok: false, error: 'fixture_id_required' });

  // ... do mutation ...

  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: { action: 'admin_close_window', fixture_id: fixtureId, caller_ip: auth.callerIp, at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[admin] close_window fixture=%s by ip=%s', fixtureId, auth.callerIp);
  return JSON.stringify({ ok: true });
}
```

**Apply to Phase 3 admin RPCs:**
- `admin_force_recruit_refresh.ts`: gate w/ `requireAdmin`, optionally accept `{club_id}`. If absent, run `runRecruitRefresh(ctx, logger, nk)` for all clubs. Write audit action `'admin_force_recruit_refresh'`.
- `admin_grant_rep.ts`: gate, accept `{user_id, delta_rep, reason}`. Read target's profile, increment `reputacion`, call `checkRankTransition`, atomic write profile. Audit action `'admin_grant_rep'` with `user_id` + `delta` + `reason`.
- `admin_seed_ai_baseline.ts`: gate, accept `{force?: bool}`. If `force == true`, delete `meta/ai_seed_version`. Call `seedAiBaseline(nk, logger)`. Audit `'admin_seed_ai_baseline'`.

For `admin_seed_ai_baseline.ts` batch-write style, also see `admin_inject_test_fixture.ts:42-78` for the multi-storage-write block + immediate audit row pattern.

---

### `nakama/src/laboral/ai_seed.ts` (NEW — boot-time seeder)

**Analog:** `nakama/src/main.ts` `seedClubs` (lines 47-119) — idempotent system-owned seed with version marker.

**Idempotency marker pattern** (main.ts lines 47-62, 107-118):
```typescript
// nakama/src/main.ts:47-62 — idempotent seed check
function seedClubs(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  const seedKey = 'clubs_seeded_' + CLUBS_SEED_VERSION;

  // Idempotency check — if we already wrote the seed marker, skip.
  try {
    const existing = nk.storageRead([
      { collection: COL_META, key: seedKey, userId: SYSTEM_USER_ID },
    ]);
    if (existing.length > 0) {
      logger.info('Clubs already seeded (version=%s), skipping', CLUBS_SEED_VERSION);
      return;
    }
  } catch (e) {
    // First run — Storage may not yet contain the meta object. Fall through to seeding.
  }
  // ... seed ...
  // Mark as seeded.
  nk.storageWrite([
    {
      collection: COL_META,
      key: seedKey,
      userId: SYSTEM_USER_ID,
      value: { seeded: true, count: clubs.length, at: Date.now() },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info('Clubs seeded: %d (version=%s)', clubs.length, CLUBS_SEED_VERSION);
}
```

**Apply to `ai_seed.ts`:** see RESEARCH §AI Population Strategy lines 789-836 for the full body. Walk `COL_CLUBS` via paginated `storageList(SYSTEM_USER_ID, COL_CLUBS, 100, cursor)`, write one `barra_state/{club_id}` per club with 5 AI Mesa slots + 1 AI Líder. Use `seedKey = 'ai_seed_version'` and write `{seeded: true, version: SEED_VERSION, at: now}` marker at end.

---

### `nakama/src/scheduler/leaderboard_cron.ts` (EXTEND — dispatcher)

**Analog:** `nakama/src/scheduler/leaderboard_cron.ts` itself (lines 17-74).

**Pattern — `ensureSchedulerLeaderboards` + dispatcher (lines 18-74):**
```typescript
// nakama/src/scheduler/leaderboard_cron.ts:18-74 — dummy leaderboard + dispatcher
export function ensureSchedulerLeaderboards(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
): void {
  try {
    nk.leaderboardCreate(
      'bb_tick_15m',
      true,
      undefined,
      undefined,
      '*/15 * * * *',
      { purpose: 'scheduler_tick' },
    );
  } catch (e) {
    // already exists — expected on every boot after the first
  }
  // ... bb_tick_6h ...
  logger.info('Scheduler leaderboards ensured (bb_tick_15m, bb_tick_6h)');
}

export function onSchedulerLeaderboardReset(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  lb: nkruntime.Leaderboard,
  _reset: number,
): void {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id as 'bb_tick_15m' | 'bb_tick_6h');
  }
}
```

**Apply Phase 3 extensions:**
- Add `ensureLaboralLeaderboards(nk, logger)` exported function that calls `nk.leaderboardCreate('bb_recruit_05_art', true, undefined, undefined, '0 8 * * *', {...})` and `'bb_mesa_recompute_1h'` with `'0 * * * *'` (RESEARCH lines 707-721).
- Extend `onSchedulerLeaderboardReset` `if`-cascade with `else if (lb.id === 'bb_recruit_05_art') runRecruitRefresh(ctx, logger, nk)` and `else if (lb.id === 'bb_mesa_recompute_1h') runMesaRecomputeAll(ctx, logger, nk)` (RESEARCH lines 727-735).
- DO NOT duplicate `initializer.registerLeaderboardReset(...)` — the single existing line in main.ts dispatches all (RESEARCH line 569).

---

### `nakama/src/scheduler/recruit_cron.ts` + `mesa_cron.ts` (NEW — scheduled jobs)

**Analog:** `nakama/src/scheduler/tick.ts` `runHeartbeatTick` (lines 37-151) — distributed lock + paginated work loop + `finally` release.

**Distributed lock acquire/release pattern** (tick.ts lines 45-73, 136-150):
```typescript
// nakama/src/scheduler/tick.ts:45-73 — lock acquire (TTL'd)
const now = Date.now();
const lockRead = nk.storageRead([
  { collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID },
]);
if (lockRead.length > 0) {
  const lock = lockRead[0].value as { acquired_at: number; epoch: string };
  if (lock.acquired_at + TICK_LOCK_TTL_MS > now) {
    logger.info(
      '[tick] previous tick still active (acquired %dms ago); skipping',
      now - lock.acquired_at,
    );
    return;
  }
  logger.warn(
    '[tick] previous tick lock expired (stale by %dms) — proceeding',
    now - lock.acquired_at - TICK_LOCK_TTL_MS,
  );
}
const epoch = nk.uuidv4();
nk.storageWrite([
  {
    collection: COL_META,
    key: KEY_TICK_LOCK,
    userId: SYSTEM_USER_ID,
    value: { acquired_at: now, epoch },
    permissionRead: 0,
    permissionWrite: 0,
  },
]);

try {
  // ... do work ...
} finally {
  // Release lock if it's still ours (epoch match)
  const finalLockRead = nk.storageRead([
    { collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID },
  ]);
  if (
    finalLockRead.length > 0 &&
    (finalLockRead[0].value as { epoch?: string }).epoch === epoch
  ) {
    nk.storageDelete([
      { collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID },
    ]);
  }
}
```

**Paginated cluster walk pattern** (tick.ts lines 157-179):
```typescript
let cursor = '';
for (let i = 0; i < 50; i++) {
  const page = nk.storageList(SYSTEM_USER_ID, COL_MATCH_WINDOWS, 100, cursor);
  for (const obj of page.objects || []) {
    // process obj.value
  }
  if (!page.cursor) break;
  cursor = page.cursor;
}
```

**Apply to `recruit_cron.ts`:**
- Acquire `KEY_RECRUIT_LOCK` (5-min TTL).
- Compute `today_art = "YYYY-MM-DD"` (RESEARCH line 747 — `new Date(now - 3*3600*1000).toISOString().slice(0,10)`).
- Walk `COL_CLUBS` via paginated list. For each club: read `recruit_pool/{club_id}`; skip if `generated_date_art === today_art`; else write fresh pool via `generatePool(nk, clubId)`.
- Release lock in `finally`.

**Apply to `mesa_cron.ts`:**
- Acquire lock (use `KEY_MESA_DEBOUNCE_PREFIX` or own lock key).
- Walk `COL_BARRA_STATE` system-owned records. For each with `mesa_recompute_pending == true`, call `recomputeMesa(nk, logger, clubId)`.
- Drain pending flags + stamp `mesa_recompute_last_at = now`.

---

### `nakama/src/scheduler/seasons.ts` (EXTEND — Líder election hook)

**Analog:** `nakama/src/scheduler/seasons.ts` itself (lines 31-119).

**Pattern — read existing → compute new state → write only on change (lines 82-118):**
```typescript
// nakama/src/scheduler/seasons.ts:82-118 — status-transition writeback
const r = nk.storageRead([
  {
    collection: COL_META,
    key: KEY_CURRENT_SEASON,
    userId: SYSTEM_USER_ID,
  },
]);
const existing: Partial<SeasonState> =
  r.length > 0 ? (r[0].value as SeasonState) : {};

// Only write if status changed or not yet initialized.
if (
  r.length === 0 ||
  existing.status !== newStatus ||
  existing.season_id !== maxSeason
) {
  const state: SeasonState = { /* ... */ };
  nk.storageWrite([
    {
      collection: COL_META,
      key: KEY_CURRENT_SEASON,
      userId: SYSTEM_USER_ID,
      value: state as unknown as { [key: string]: unknown },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info('[season] status=%s season=%d', newStatus, maxSeason);
}
```

**Apply to Phase 3 extension:** detect transition `existing.status !== 'ended' && newStatus === 'ended'` → walk `COL_BARRA_STATE`, for each club compute new Líder (highest Rep humano si supera AI top, sino AI Líder), write `barra_state.lider` with `season_id = maxSeason` + `elected_at = now`. Mirror seasons.ts log line: `logger.info('[season] lider_elected club=%s season=%d', clubId, maxSeason)`.

---

### `nakama/src/laboral/idle_accrual.ts` + `rank.ts` + `pibe_factory.ts` (NEW — pure helpers)

**Analog:** `nakama/src/util/validation.ts` (lines 1-110) — pure constants + small exported functions.

**Pattern — top-of-file constants + ValidationResult-style return type (lines 14-72):**
```typescript
// nakama/src/util/validation.ts:14-72 — pure helper module pattern
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
const ALLOWED_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 _-]+$/;
// ...
export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePibeName(raw: unknown): ValidationResult {
  // ... cascade of guard clauses returning {ok: false, error: '...'} ...
  return { ok: true };
}
```

**Apply to laboral helpers:** see RESEARCH §Lazy Compute Patterns lines 582-690 for ready-to-use bodies. Top-of-file constants (`IDLE_CAP_MS`, `PROFESSION_RATES_PER_HOUR`, `THRESHOLDS`, `APODOS`, `NOMBRES`, `TRAIT_POOL`, `ROL_WEIGHTS`, `AVATAR_PARTS`) + small exported pure functions (`accrueIdleForPibe`, `regenEnergia`, `checkRankTransition`, `generatePick`).

---

### `scripts/autoloads/NakamaService.gd` (EXTEND — RPC wrappers)

**Analog:** `scripts/autoloads/NakamaService.gd` itself (lines 64-111) — Phase 2 RPC wrappers.

**Pattern — auth guard + rpc_async + WR-09 dict guard (lines 99-111):**
```gdscript
# scripts/autoloads/NakamaService.gd:99-111 — RPC wrapper pattern
# Phase 2 — Server returns the next/current active match window for the
# authenticated player's club. HomeScreen calls this on _ready + on app resume.
func get_current_window() -> Dictionary:
	if not AuthManager.is_authenticated():
		return {"ok": false, "error": "not_authenticated"}
	var session = AuthManager.session
	var resp = await client.rpc_async(session, "get_current_window", "{}")
	if resp.is_exception():
		return {"ok": false, "error": str(resp.get_exception().message)}
	var data = JSON.parse_string(resp.payload)
	if typeof(data) != TYPE_DICTIONARY:
		return {"ok": false, "error": "invalid_response"}
	return {"ok": true, "data": data}
```

**Payload-bearing variant** (lines 66-78):
```gdscript
# scripts/autoloads/NakamaService.gd:66-78 — payload-bearing wrapper
func register_fcm_token(token: String, platform: String) -> Dictionary:
	if not AuthManager.is_authenticated():
		return {"ok": false, "error": "not_authenticated"}
	var session = AuthManager.session
	var payload = JSON.stringify({"token": token, "platform": platform})
	var resp = await client.rpc_async(session, "register_fcm_token", payload)
	if resp.is_exception():
		push_warning("[NakamaService] register_fcm_token failed: " + str(resp.get_exception().message))
		return {"ok": false, "error": str(resp.get_exception().message)}
	var data = JSON.parse_string(resp.payload)
	if typeof(data) != TYPE_DICTIONARY:
		return {"ok": false, "error": "invalid_response"}
	return {"ok": true, "data": data}
```

**Apply for Phase 3 (RESEARCH §NakamaService Extension lines 1172-1185):** add 10 wrappers — `get_roster`, `get_aguantadero`, `get_barra_state`, `get_recruit_pool`, `assign_profession`, `collect_idle`, `recruit_pibe`, `upgrade_aguantadero`, `submit_turno`, `complete_tutorial`. Every wrapper MUST: guard `AuthManager.is_authenticated()`, build JSON payload with `JSON.stringify`, await `client.rpc_async(session, "<rpc_name>", payload)`, handle exception + `typeof != TYPE_DICTIONARY` (WR-09 lesson).

---

### `scripts/autoloads/PlayerStore.gd` (EXTEND — cache + signals)

**Analog:** `scripts/autoloads/PlayerStore.gd` itself (lines 1-78).

**Pattern — fields + signals + `load_from_server` (lines 14-78):**
```gdscript
# scripts/autoloads/PlayerStore.gd:14-44 — fields/signals/clear pattern
signal profile_loaded
signal profile_cleared

var pibe_id: String = ""
var pibe_name: String = ""
var club_id: String = ""
var club_name: String = ""
var club_division: String = ""

# Phase 2: push + heartbeat state.
var subscribed_topics: Array[String] = []
var current_window: Dictionary = {}

func has_profile() -> bool:
	return pibe_id != ""

func clear() -> void:
	pibe_id = ""
	pibe_name = ""
	# ... reset all fields ...
	profile_cleared.emit()
```

**Defensive parse pattern** (lines 56-77):
```gdscript
# WR-09 fix: defensa contra value corrupto / null
var profile_raw = JSON.parse_string(resp.objects[0].value)
if typeof(profile_raw) != TYPE_DICTIONARY:
	return {"ok": false, "error": "profile_corrupt"}
var profile: Dictionary = profile_raw
pibe_id = str(profile.get("pibe_id", ""))
```

**Apply Phase 3 (RESEARCH §PlayerStore Extension lines 1149-1167):** add signals `roster_updated`, `resources_updated`, `aguantadero_updated`. Add fields `rank`, `plata`, `reputacion`, `vbc`, `tutorial_done`, `tutorial_step`, `pibes: Array`, `aguantadero: Dictionary`, `recruit_pool: Dictionary`, `roster_cap: int = 5`. Extend `clear()` to reset all. Wire `load_from_server` to also call `get_roster` + `get_aguantadero` and emit corresponding signals.

---

### `scripts/autoloads/FlowRouter.gd` (EXTEND — navigation)

**Analog:** `scripts/autoloads/FlowRouter.gd` itself (lines 48-65).

**Pattern — `go_<screen>()` shorthand + `confirm_*` orchestration (lines 48-65):**
```gdscript
# scripts/autoloads/FlowRouter.gd:48-65 — nav helpers + orchestrator
# Convenience helpers — keep all scene paths in one place.
func go_splash() -> void: go_to("res://scenes/SplashScreen.tscn")
func go_auth() -> void: go_to("res://scenes/AuthScreen.tscn")
# ...
func go_home() -> void: go_to("res://scenes/HomeScreen.tscn")

# Phase 2: club confirmation entrypoint. ClubPickerScreen calls this instead of
# raw go_pibe_creator() so the FCM topic subscribe happens at exactly one place.
func confirm_club_pick(club_id: String) -> void:
	if club_id != "":
		NakamaService.subscribe_to_club_topic(club_id)
	go_pibe_creator()
```

**Apply Phase 3:** add `go_roster()`, `go_recruit()`, `go_pibe_detail(pibe_id)`, `go_profession_assign(pibe_id)`, `go_aguantadero()`. Add `go_post_pibe_create()` orchestrator gating on `PlayerStore.tutorial_done` (RESEARCH §FlowRouter Integration lines 1086-1101). Add `tutorial_advance(step: int)` that calls `complete_tutorial` RPC + updates PlayerStore + routes.

---

### `scripts/screens/HomeScreen.gd` + `.tscn` (EXTEND)

**Analog:** `scripts/screens/HomeScreen.gd` itself (lines 1-108) — Phase 2 banner + `_notification` handling.

**Pattern — `_ready` cache load + `_notification(NOTIFICATION_APPLICATION_RESUMED)` refresh (lines 15-43):**
```gdscript
# scripts/screens/HomeScreen.gd:15-43 — ready/resume refresh pattern
func _ready() -> void:
	if PlayerStore.pibe_name == "":
		await PlayerStore.load_from_server()
	pibe_label.text = PlayerStore.pibe_name if PlayerStore.pibe_name != "" else "Pibe"
	# ...
	window_banner.text = "Cargando..."
	_refresh_window()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED:
		if PlayerStore.club_id != "":
			NakamaService.subscribe_to_club_topic(PlayerStore.club_id)
		_refresh_window()

func _refresh_window() -> void:
	var resp := await NakamaService.get_current_window()
	if resp.get("ok", false):
		var data = resp.get("data", {})
		if typeof(data) == TYPE_DICTIONARY:
			var win = data.get("window", null)
			PlayerStore.current_window = win if typeof(win) == TYPE_DICTIONARY else {}
	_update_window_banner()
```

**Confirmation dialog + disable-CTA-during-RPC pattern** (lines 76-108):
```gdscript
# scripts/screens/HomeScreen.gd:76-108 — destructive action w/ confirmation + spinner
func _on_delete() -> void:
	var dlg = ConfirmationDialog.new()
	dlg.dialog_text = "¿Seguro? Esto borra todo tu progreso y no se puede deshacer."
	dlg.ok_button_text = "Sí, borrá todo"
	dlg.cancel_button_text = "Cancelar"
	add_child(dlg)
	dlg.confirmed.connect(_perform_delete)
	dlg.popup_centered()

func _perform_delete() -> void:
	# WR-05 fix: deshabilita el botón mientras el RPC está in-flight
	delete_button.disabled = true
	var session = AuthManager.session
	var resp = await NakamaService.client.rpc_async(session, "delete_account", "")
	if resp.is_exception():
		delete_button.disabled = false
		push_error("[HomeScreen] delete_account failed: %s" % resp.get_exception().message)
		var err_dlg = AcceptDialog.new()
		err_dlg.dialog_text = "No pudimos borrar la cuenta. Probá de nuevo en un rato."
		add_child(err_dlg)
		err_dlg.popup_centered()
		return
	# ...
```

**Apply Phase 3 (UI-SPEC §5.1):** extend `_ready` to also `await NakamaService.get_roster()` + `await NakamaService.get_aguantadero()` (parallel via two awaited calls), update `ResourceWidget`s, show/hide TurnoButton based on `PlayerStore.current_window.state`, render IdleNotice. Lunfardo banner copy already established (lines 60-74) — extend for new states.

---

### `scripts/screens/RosterScreen.gd` + `.tscn` (NEW)

**Analog:** `scripts/screens/ClubPickerScreen.gd` (lines 1-138).

**Pattern — chip filter + card list pool reuse + RPC load (lines 41-122):**
```gdscript
# scripts/screens/ClubPickerScreen.gd:41-65 — chip + search + debounce
func _build_chips() -> void:
	for div in DIVISIONS:
		var chip = ChipButtonScene.instantiate()
		chip.label_text = div
		chip.is_selected = (div == _current_division)
		chip.pressed.connect(_on_chip_pressed.bind(div, chip))
		chips_box.add_child(chip)

func _on_chip_pressed(div: String, chip: Node) -> void:
	_current_division = div
	for c in chips_box.get_children():
		c.is_selected = (c == chip)
	_render_clubs()

# WR-07 fix: pool de ClubCards reutilizables — evita queue_free+instantiate
# en cada filter/search change (con 133 clubs eran ~800 nodos por keystroke).
var _card_pool: Array = []
```

**Render-with-pool pattern (lines 88-123):**
```gdscript
# scripts/screens/ClubPickerScreen.gd:88-123 — pool grow + assign + hide-overflow
func _render_clubs() -> void:
	# Grow pool to match needed size.
	while _card_pool.size() < filtered.size():
		var new_card = ClubCardScene.instantiate()
		list_box.add_child(new_card)
		new_card.tapped.connect(_on_card_pool_tapped.bind(new_card))
		_card_pool.append(new_card)
	# Assign data + visibility to all pool entries.
	for i in range(_card_pool.size()):
		var card = _card_pool[i]
		if i < filtered.size():
			card.set_club(filtered[i])
			card.set_meta("club_data", filtered[i])
			card.visible = true
			card.set_selected(false)
		else:
			card.visible = false
```

**Apply to `RosterScreen.gd`:** build sort chips (`Por Rep` / `Por Energía` / `Por Rol` per UI-SPEC §5.2) instead of division chips. Card pool of `PibeCard` instances. On `_ready`: `await NakamaService.get_roster()`, populate `PlayerStore.pibes`, render. Empty state + loading skeletons per UI-SPEC.

---

### `scripts/screens/RecruitScreen.gd` + `.tscn` (NEW)

**Analog:** `scripts/screens/ClubPickerScreen.gd` (card list + selection + CTA gate).

**Apply:** simpler — 3 fixed `RecruitCard` instances. On `_ready`: `await NakamaService.get_recruit_pool()`. Recruit confirmation dialog mirrors `HomeScreen._on_delete` ConfirmationDialog pattern. Use error AcceptDialog for failed recruits (HomeScreen `_perform_delete` lines 92-101). RankGateLabel copy per UI-SPEC §5.3.

---

### `scripts/screens/PibeDetailScreen.gd` + `.tscn` (NEW)

**Analog:** `scripts/screens/PibeCreatorScreen.gd` (lines 1-65) — single-entity edit + lunfardo error mapping.

**Pattern — RPC call + lunfardo error mapping (lines 37-63):**
```gdscript
# scripts/screens/PibeCreatorScreen.gd:37-58 — RPC + error mapping pattern
func _on_submit() -> void:
	error_label.visible = false
	cta.disabled = true
	var session = AuthManager.session
	# T-1-UI-01: ONLY name + club_id — never stats.
	var payload = JSON.stringify({
		"name": name_input.text.strip_edges(),
		"club_id": PlayerStore.club_id,
	})
	var resp = await NakamaService.client.rpc_async(session, "create_pibe", payload)
	cta.disabled = false
	if resp.is_exception():
		var msg = str(resp.get_exception().message)
		var msg_lower = msg.to_lower()
		if "ese nombre" in msg_lower or "name" in msg_lower or "máximo" in msg_lower:
			error_label.text = "Ese nombre no va. Elegí otro."
		elif "already exists" in msg_lower:
			error_label.text = "Ya tenés un pibe creado, chabón."
		else:
			error_label.text = "Algo salió mal. Probá de nuevo."
		error_label.visible = true
		return
```

**Apply to `PibeDetailScreen.gd`:** load the pibe from `PlayerStore.pibes` by id (passed via FlowRouter). Render hero + traits + skills + actions per UI-SPEC §5.4. Three CTAs: "Asignar profesión" → FlowRouter, "Enviar a turno" → TurnoModal, "Liberar pibé" → ConfirmationDialog (destructive). Map lunfardo errors when RPC fails.

---

### `scripts/screens/ProfessionAssignScreen.gd` + `.tscn` (NEW)

**Analog:** `scripts/screens/PibeCreatorScreen.gd` (CTA gate + RPC + error mapping).

**Apply:** render 5 profession rows + 1 Líder-only row per UI-SPEC §5.5. Disabled-row pattern: `modulate.a = 0.4` + tooltip-like label. Confirmation modal on selection. Error inline.

---

### `scripts/screens/AguantaderoScreen.gd` + `.tscn` (NEW)

**Analog:** `scripts/screens/PibeCreatorScreen.gd` (single-entity view + upgrade CTA).

**Apply:** render hero + stats row + upgrade panel + bandera room placeholder per UI-SPEC §5.6. Upgrade confirmation dialog. Plata-insufficient disabled state.

---

### `scripts/screens/TutorialScreen.gd` (EXTEND — multi-step state machine) + `.tscn`

**Analog:** `scripts/screens/TutorialScreen.gd` itself (Phase 1 single-step at lines 1-13).

**Phase 1 minimal scaffolding** (the entire current file):
```gdscript
# scripts/screens/TutorialScreen.gd:1-13 — Phase 1 single-step pattern
extends Control

# Single-screen welcome per UI-SPEC §TutorialScreen (D-13 — no full tutorial).
@onready var cta: Button = $VBox/CTA

func _ready() -> void:
	cta.text = "Dale, empezamos"
	cta.pressed.connect(_on_cta)

func _on_cta() -> void:
	FlowRouter.go_home()
```

**Apply Phase 3 (UI-SPEC §5.8 + RESEARCH §Tutorial Scripting):** convert to N-step state machine. `var _step: int = 0`, `_render_step()` swaps title/body/illustration per step (table in RESEARCH lines 1075-1085). "Atrás" hidden on step 1. Skip button → ConfirmationDialog (HomeScreen `_on_delete` pattern). Each step's CTA awaits the relevant RPC (`get_recruit_pool`, `recruit_pibe`, `assign_profession`, `collect_idle`, `complete_tutorial`) via `NakamaService` wrappers. State machine reference skill: `.agents/skills/state-machine`.

---

### `scripts/components/TurnoModal.gd` + `scenes/TurnoModal.tscn` (NEW — modal)

**Analog:** `scripts/screens/HomeScreen.gd` `_on_delete` + `_perform_delete` (lines 76-108) — overlay add-child + disable-CTA + error AcceptDialog.

**Apply:** modal `add_child` from HomeScreen on TurnoButton press. Multi-select checkbox list (UI-SPEC §5.7). Confirm CTA disabled until ≥1 pibe checked. Calls `NakamaService.submit_turno(fixture_id, pibe_ids)`. On success: emit signal, close modal. On error: inline red label.

---

### `scripts/components/PibeCard.gd` + `.tscn` (NEW)

**Analog:** `scripts/components/ClubCard.gd` + `scenes/components/ClubCard.tscn` (lines 1-54 + tscn 1-35).

**Pattern — PanelContainer + H/V box + setters + tapped signal:**
```gdscript
# scripts/components/ClubCard.gd:1-54 — reusable card component pattern
extends PanelContainer

signal tapped

@onready var crest: ColorRect = $H/Crest
@onready var name_label: Label = $H/V/Name
@onready var division_label: Label = $H/V/Division

var club_data: Dictionary = {}

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	custom_minimum_size.y = 64

func set_club(club: Dictionary) -> void:
	club_data = club
	name_label.text = str(club.get("lunfardo_name", ""))
	division_label.text = str(club.get("division", ""))
	var colors = club.get("colors", {})
	var primary_hex = str(colors.get("primary", "#888888"))
	crest.color = Color(primary_hex)

func set_selected(sel: bool) -> void:
	# StyleBoxFlat duplicate + border toggle
	# ...

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		tapped.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		tapped.emit()
```

**TSCN structure** (ClubCard.tscn lines 1-35):
```
[node name="ClubCard" type="PanelContainer"]
custom_minimum_size = Vector2(0, 64)
mouse_filter = 1
script = ExtResource("1")

[node name="H" type="HBoxContainer" parent="."]
theme_override_constants/separation = 16

[node name="Crest" type="ColorRect" parent="H"]
custom_minimum_size = Vector2(40, 40)

[node name="V" type="VBoxContainer" parent="H"]
size_flags_horizontal = 3
size_flags_vertical = 4
theme_override_constants/separation = 4

[node name="Name" type="Label" parent="H/V"]
theme_override_font_sizes/font_size = 16

[node name="Division" type="Label" parent="H/V"]
theme_override_font_sizes/font_size = 14
```

**Apply to `PibeCard.gd` + `.tscn`:** copy structure. Set `custom_minimum_size.y = 120` (UI-SPEC §6.1). Replace Crest with 80x80 AvatarPlaceholder. Add nested HBox for Name + RankBadge. Add EnergiaBar mini child. Add TraitChip × 2 child HBox. `set_pibe(pibe: Dictionary)` setter mirrors `set_club`. `tapped` signal emits with `pibe_id`. Use `AppTheme.ACCENT` for in-turno left-edge stripe.

---

### `scripts/components/RecruitCard.gd` + `.tscn` (NEW)

**Analog:** `scripts/components/ClubCard.gd` (same pattern — bigger + CTA).

**Apply:** `custom_minimum_size.y = 180`. AvatarLarge 120×140. Includes "Reclutar" Button child (UI-SPEC §6.2). Gated state via `modulate.a = 0.4` (mirrors HomeScreen `_perform_delete` disabled-state).

---

### `scripts/components/ResourceWidget.gd` + `.tscn` (NEW)

**Analog:** `scripts/components/NavButton.gd` (lines 1-46) — small fixed VBox composite.

**Pattern — exported var + setter + `_refresh` (lines 8-40):**
```gdscript
# scripts/components/NavButton.gd:8-40 — exported var + active-state visual
@export var label_text: String = "" :
	set(v):
		label_text = v
		if is_inside_tree() and _label:
			_label.text = v

@export var is_active: bool = false :
	set(v):
		is_active = v
		if is_inside_tree():
			_refresh()

func _ready() -> void:
	custom_minimum_size = Vector2(64, 56)
	mouse_filter = Control.MOUSE_FILTER_STOP
	alignment = BoxContainer.ALIGNMENT_CENTER
	_dot = $Dot
	_icon = $Icon
	_label = $Label
	_label.text = label_text
	_refresh()

func _refresh() -> void:
	if _dot == null:
		return
	_dot.visible = is_active
	_dot.color = AppTheme.ACCENT
	_icon.color = AppTheme.TEXT_PRIMARY if is_active else AppTheme.TEXT_SECONDARY
```

**Apply to `ResourceWidget.gd`:** 80×60 fixed VBox (UI-SPEC §6.3). Icon ColorRect tinted by `AppTheme.RES_PLATA` / `RES_AGUANTE` / `RES_REPUTACION` / `RES_VBC` (Phase 3 token additions). `set_value(int)` setter writes Numeric Counter 20 Bold Label. `tooltip_text` for accessibility.

---

### `scripts/components/RankBadge.gd` + `TraitChip.gd` + `EnergiaBar.gd` + `ProfessionIcon.gd` (NEW)

**Analog:** `scripts/components/ChipButton.gd` (lines 1-75) — cached StyleBoxFlat + threshold/state-driven color swap.

**Pattern — cached StyleBoxFlat avoids per-tap GC (lines 22-68):**
```gdscript
# scripts/components/ChipButton.gd:22-68 — cached StyleBoxFlat pattern
var _label: Label
# WR-11 fix: cachear 2 StyleBoxFlat (selected + unselected) en lugar de
# crear uno nuevo en cada _refresh_style — evita basura de GC en cada tap.
var _style_selected: StyleBoxFlat
var _style_unselected: StyleBoxFlat

func _build_styles() -> void:
	_style_selected = StyleBoxFlat.new()
	_style_selected.corner_radius_top_left = 16
	_style_selected.corner_radius_top_right = 16
	_style_selected.corner_radius_bottom_left = 16
	_style_selected.corner_radius_bottom_right = 16
	_style_selected.content_margin_left = 8
	_style_selected.content_margin_right = 8
	_style_selected.content_margin_top = 8
	_style_selected.content_margin_bottom = 8
	_style_selected.bg_color = AppTheme.ACCENT
	# ...

func _refresh_style() -> void:
	if _style_selected == null:
		_build_styles()
	add_theme_stylebox_override("panel", _style_selected if is_selected else _style_unselected)
```

**Apply:**
- `RankBadge.gd`: cache 5 StyleBoxFlats keyed by rank, swap bg_color via the §4.2 palette tokens added to AppTheme.
- `TraitChip.gd`: cache 3 StyleBoxFlats (positive/negative/neutral border color from §4.4 palette).
- `EnergiaBar.gd`: ProgressBar with custom StyleBox; swap fill `bg_color` at thresholds 0/30/70 (§4.5).
- `ProfessionIcon.gd`: ColorRect background tinted via §4.3 profession palette + 24×24 monochrome glyph.

---

### `scripts/components/SkillProgressRing.gd` + `.tscn` (NEW — custom-drawn)

**Analog:** none (no `_draw()` override exists in current Phase 1/2 codebase — see §No Analog Found).

**Apply:** use `Control` with `_draw()` override calling `draw_arc()`. Reference Godot 4.3 docs. Refer to UI-SPEC §6.6 for stroke colors. Center Label uses Body 16 Bold per typography scale.

---

### `scripts/autoloads/AppTheme.gd` (EXTEND)

**Analog:** `scripts/autoloads/AppTheme.gd` itself (lines 1-46).

**Pattern — token block + `_ready` print:**
```gdscript
# scripts/autoloads/AppTheme.gd:5-32 — token block pattern
# Color tokens (UI-SPEC: hex → Godot Color)
const DOMINANT := Color(0.102, 0.102, 0.102, 1)       # #1A1A1A
const SECONDARY := Color(0.176, 0.176, 0.176, 1)      # #2D2D2D
const ACCENT := Color(0.839, 0.157, 0.157, 1)         # #D62828
# ...

# Spacing tokens (UI-SPEC px multiples of 4)
const SP_XS := 4
const SP_SM := 8
const SP_MD := 16
# ...

# Typography sizes (UI-SPEC)
const FONT_DISPLAY := 28
const FONT_HEADING := 22
const FONT_BODY := 16
const FONT_LABEL := 14
```

**Apply Phase 3 (UI-SPEC §4):** add resource tokens `RES_PLATA`, `RES_AGUANTE`, `RES_REPUTACION`, `RES_VBC`. Add rank palette `RANK_PIBE`, `RANK_SOLDADO`, `RANK_CAPO`, `RANK_MESA`, `RANK_LIDER`. Add profession palette `PROF_TRAPITO`, `PROF_VENDEDOR`, `PROF_PATOVICA`, `PROF_REMISERO`, `PROF_HABLAR_CANA`, `PROF_SIN_LABURO`. Add trait sentiment `TRAIT_POSITIVE`, `TRAIT_NEGATIVE`, `TRAIT_NEUTRAL`. Add Energía thresholds `ENERGIA_FULL`, `ENERGIA_MID`, `ENERGIA_LOW`, `ENERGIA_EMPTY`. **[OVERRIDE]** Per UI-SPEC §3b: drop `FONT_HEADING := 22` → replace with `FONT_HEADING := 20` (and add comment noting collapse with Numeric Counter role).

---

### `nakama/test/laboral-test.sh` (NEW)

**Analog:** `nakama/test/heartbeat-test.sh` (lines 1-115 read; full file is the template).

**Pattern — bash + curl + jq + ADMIN_BEARER + pass/fail/skip:**
```bash
# nakama/test/heartbeat-test.sh:10-23 — test harness scaffolding
set -euo pipefail

NAKAMA_HOST="${NAKAMA_HOST:-nakama-production-7ea8.up.railway.app}"
NAKAMA_KEY="${NAKAMA_KEY:-aee9c099d52a6c22f52fb8bc9f4b72d9}"
ADMIN_BEARER="${ADMIN_BEARER:-}"
HTTP_KEY="${HTTP_KEY:-defaulthttpkey}"
BASE="https://${NAKAMA_HOST}"
PASS=0; FAIL=0; SKIP=0

basic_auth() { printf '%s' "$(printf '%s:' "$NAKAMA_KEY" | base64 | tr -d '\n')"; }
console_auth() { printf '%s' "$(printf '%s:' "admin:" | base64 | tr -d '\n')"; }

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1 — $2"; FAIL=$((FAIL+1)); }
skip() { echo "  SKIP: $1"; SKIP=$((SKIP+1)); }
```

**RPC test pattern** (lines 96-115):
```bash
# Bearer-token admin RPC test
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  RESP=$(curl -fsS --max-time 15 -X POST \
    "$BASE/v2/rpc/<rpc_name>?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" \
    -d '{...payload...}')
  if echo "$RESP" | jq -e '.ok == true' > /dev/null 2>&1; then
    pass "<test description>"
  else
    fail "<test id>" "<failure detail>: $RESP"
  fi
fi
```

**Apply Phase 3 invariants** (from RESEARCH §Recommended Validation): idle accrual idempotency, turno output split, recruit refresh idempotency (`generated_date_art` short-circuit), rank threshold transition, Mesa displacement, Líder election on season-end, recruit pool trait_2 redaction, idle 12h cap, optimistic concurrency on recruit_pool race.

---

## Shared Patterns

### Goja AST Safety (CRITICAL — Phase 2 lesson, 3 hot-fixes paid)

**Source:** `nakama/src/main.ts:121-162` + `nakama/src/scheduler/leaderboard_cron.ts:53-74`.

**Apply to:** every new RPC + new scheduler hook registration.

```typescript
// nakama/src/main.ts:121-130 + leaderboard_cron.ts:53-74 — Goja AST gotcha
// MUST be a function declaration (or `var InitModule = function() {}`), NOT an
// arrow function. Nakama parses the bundle AST looking for either pattern in
// findInitModuleFn (server/runtime_javascript_init_module.go) — arrow functions
// are ignored, causing `failed to find InitModule function` from registerRpc.
export function InitModule(...) {
  // ...
  initializer.registerLeaderboardReset(onSchedulerLeaderboardReset);
  initializer.registerRpc('get_clubs', rpcGetClubs);
  // Every register call must be a top-level ExpressionStatement here.
  // No helper functions. No conditional wrappers. No loops.
}
```

**Rule:** every Phase 3 `initializer.registerRpc(...)` line goes directly in main.ts InitModule body. Helper modules (laboral/*.ts) may use any syntax — only InitModule top-level statements are subject to this constraint.

---

### Server-Authoritative Validation Cascade

**Source:** `nakama/src/rpc/create_pibe.ts:42-77`.

**Apply to:** every player RPC that accepts payload.

```typescript
// Standard guard ordering: auth → JSON parse → field type/range → business rule
const userId = ctx.userId;
if (!userId) throw new Error('not_authenticated');

let input: <InputType>;
try {
  input = (payload ? JSON.parse(payload) : {}) as <InputType>;
} catch (e) {
  throw new Error('invalid_json_payload');
}

if (typeof input.<field> !== '<expected_type>') {
  return JSON.stringify({ ok: false, error: '<field>_required' });
}
// ... continue cascade
```

**Error code style:** snake_case identifiers (`not_authenticated`, `invalid_payload`, `pibe_already_exists`, `window_not_found`). Client maps these to lunfardo copy (PibeCreatorScreen `_on_submit` mapping pattern).

---

### Optimistic Concurrency on Shared Records

**Source:** `nakama/src/scheduler/windows.ts:104-151` + `nakama/src/rpc/admin_close_window.ts:29-47`.

**Apply to:** all writes against `barra_state/{club_id}`, `recruit_pool/{club_id}`, and any other system-owned shared record.

```typescript
// Pattern: read first to get version, write with that version, catch concurrent_update
const existing = nk.storageRead([
  { collection: COL_<X>, key: <key>, userId: SYSTEM_USER_ID },
]);

const updated = { ...prev, /* mutations */ };

try {
  nk.storageWrite([{
    collection: COL_<X>, key: <key>, userId: SYSTEM_USER_ID,
    value: updated as unknown as { [key: string]: unknown },
    version: existing.length > 0 ? existing[0].version : '*',
    permissionRead: 2,
    permissionWrite: 0,
  }]);
} catch (e) {
  logger.warn('[<scope>] concurrent update for %s; will retry next tick', key);
  return;
}
```

**Rule:** `recruit_pibe` MUST use this pattern on the `recruit_pool/{club_id}` write — otherwise two simultaneous recruiters can both grab the same pick.

---

### Admin Auth Gate + Audit Log

**Source:** `nakama/src/util/admin_auth.ts:9-29` + `nakama/src/rpc/admin_close_window.ts:13-56`.

**Apply to:** all 3 new admin RPCs (`admin_force_recruit_refresh`, `admin_grant_rep`, `admin_seed_ai_baseline`).

```typescript
// 1. Gate first
const auth = requireAdmin(ctx, logger);
if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

// 2. Do the work...

// 3. Write audit row LAST
nk.storageWrite([{
  collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
  value: { action: '<rpc_name>', /* args */, caller_ip: auth.callerIp, at: Date.now() },
  permissionRead: 0, permissionWrite: 0,
}]);
logger.info('[admin] <rpc_name> <args> by ip=%s', auth.callerIp);
```

`requireAdmin` already provides constant-time compare for ADMIN_BEARER (T-2-ADM-01 mitigation).

---

### Lunfardo Error Copy on Client

**Source:** `scripts/screens/PibeCreatorScreen.gd:48-58` + `scripts/screens/HomeScreen.gd:60-74`.

**Apply to:** all new Godot screens that call RPCs.

```gdscript
# Pattern: catch RPC exception, lowercase, map to lunfardo string
if resp.is_exception():
	var msg = str(resp.get_exception().message)
	var msg_lower = msg.to_lower()
	if "<error_token>" in msg_lower:
		error_label.text = "<Lunfardo error copy>"
	# ...
	else:
		error_label.text = "Algo salió mal. Probá de nuevo."
	error_label.visible = true
	return
```

**Tone constraint (CLAUDE.md):** lunfardo, caricaturesco, apolítico. Phase 3 specifics from CONTEXT §specifics line 184: NO "ataque" / "raid" / "pelea" copy — Phase 3 = "hacer turno", "estar en la cancha", "aguantar", "laburar".

---

### Defensive JSON Parse (WR-09 lesson)

**Source:** `scripts/autoloads/PlayerStore.gd:56-77` + `scripts/autoloads/NakamaService.gd:75-78`.

**Apply to:** every place that parses server response or storage value.

```gdscript
# WR-09 fix: defensa contra value corrupto / null — JSON.parse_string puede
# devolver null (value vacío) o un tipo no-Dictionary (test fixture roto, etc.).
var parsed_raw = JSON.parse_string(resp.payload)  # or resp.objects[0].value
if typeof(parsed_raw) != TYPE_DICTIONARY:
	return {"ok": false, "error": "invalid_response"}  # or "profile_corrupt"
var parsed: Dictionary = parsed_raw
var field = str(parsed.get("field", ""))  # always default via .get(default)
```

---

### Phase 1 Mirror Drift (CR-01 lesson) — Storage Keys

**Source:** `nakama/src/storage_keys.ts:1-9` + `scripts/autoloads/StorageKeys.gd:1-7`.

**Rule:** whenever a constant is added to `nakama/src/storage_keys.ts` AND the **client reads** that collection or key directly, mirror to `scripts/autoloads/StorageKeys.gd`. If only server-internal (locks, audit, seed markers), comment-out / skip and document why. Phase 3 list documented in RESEARCH §Storage Schema lines 287-294.

---

### `_notification(NOTIFICATION_APPLICATION_RESUMED)` Refresh on Resume

**Source:** `scripts/screens/HomeScreen.gd:30-34`.

**Apply to:** any screen that displays time-sensitive resources (HomeScreen, RosterScreen, AguantaderoScreen).

```gdscript
func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED:
		# Re-fetch any time-sensitive state (idle accrual, window state, energy regen)
		_refresh_<state>()
```

Phase 3 idle accrual is computed server-side on every read — on-resume refresh triggers fresh accrual + state sync without explicit pull-to-refresh in Phase 3.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns or refer to project skills):

| File | Role | Data Flow | Reason / Fallback |
|------|------|-----------|-------------------|
| `scripts/components/SkillProgressRing.gd` + `.tscn` | component (custom-drawn) | display | No `_draw()` override exists in Phase 1/2 components — all use ColorRect / Label / StyleBoxFlat. Fallback: implement `_draw()` calling `draw_arc()` per UI-SPEC §6.6, reference Godot 4.3 docs. |
| `nakama/src/laboral/avatar_composer.ts` (if planner splits) | pure helper | transform | Phase 1 PibeCreatorScreen uses fixed-stat preview, not composite avatar. RESEARCH §Procedural Pibe Generation lines 960-971 documents the placeholder AVATAR_PARTS — no analog to copy. Use `validation.ts` module shape as fallback (constants + small pure functions). |

For the recruit/turno **client-side animation patterns** (trait reveal flash §4.1#7, rank-up flash §4.1#8, pulse animation §10, EnergiaBar value tween) there is no Phase 1/2 animation precedent beyond `scripts/utils/Tween.gd` (untracked in PATTERNS scan — verify path exists) and `FlowRouter`'s fade tween (`scripts/autoloads/FlowRouter.gd:36-43`). Planner should refer to `.agents/skills/design/animation-patterns/SKILL.md` if more sophisticated animations are needed.

---

## Project Skills (use as needed during planning)

From `.agents/skills/` (do NOT load fully — only load `rules/*.md` files inside if a pattern needs reinforcement):
- `.agents/skills/hooked-ux/SKILL.md` — daily recruit refresh + per-fixture turno align (variable reward + ritual).
- `.agents/skills/design/animation-patterns/SKILL.md` — for trait reveal, rank-up flash, pulse animation (UI-SPEC §10).
- `.agents/skills/ux-heuristics/SKILL.md` — gating copy ("Necesitás ser Soldado") + error messaging patterns.

Other skills referenced in RESEARCH §Project Skills Applicable (interface-design, component-spec, information-architecture, onboarding-design, error-handling-ux, micro-interaction-spec, ux-writing, state-machine) — verify paths exist under `.agents/skills/` if planner wants to load them; many are in alternate paths or subdirectories.

---

## Metadata

**Analog search scope:**
- `nakama/src/` (all 27 .ts files globbed)
- `scripts/` (all 20 .gd files globbed)
- `scenes/` (all 11 .tscn files globbed)
- `nakama/test/` (2 files)
- `.agents/skills/` (catalog enumerated via glob, no SKILL.md bodies loaded)

**Files scanned:** 60+ files glob-listed; ~15 read in full or targeted ranges. Stopped at 5+ strong analogs per role per RESEARCH cap.

**Pattern extraction date:** 2026-05-19
