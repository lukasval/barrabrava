# Phase 2: Heartbeat AFA — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 32 new/modified files across server, client, build/config, native plugin, tests, docs
**Analogs found:** 27 / 32 (5 have no analog — flagged below)

> Phase 2 is largely greenfield (scheduler, FCM, integrations, admin plane). Wherever an existing Phase 1 file matches the role + data flow, the planner MUST mirror that style. Where no analog exists, Phase 2 establishes the convention — flagged here so the planner knows it's first-mover.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `nakama/src/main.ts` (MODIFIED) | autoload/entrypoint | event-driven (boot hook) | self (extend in place) | exact |
| `nakama/src/storage_keys.ts` (MODIFIED) | config/constants | n/a | self (extend in place) | exact |
| `nakama/src/integrations/api_football.ts` (NEW) | integration adapter | request-response (HTTP fetch) | `nakama/src/util/email.ts` (Resend stub) | role-match |
| `nakama/src/integrations/fcm.ts` (NEW) | integration adapter | request-response (HTTP push) | `nakama/src/util/email.ts` | role-match |
| `nakama/src/integrations/resend.ts` (NEW) | integration adapter | request-response (HTTP email) | `nakama/src/util/email.ts` | exact (extracts + extends current stub) |
| `nakama/src/scheduler/tick.ts` (NEW) | scheduler/cron | event-driven (leaderboard reset) | NONE — first scheduler in repo | NO ANALOG |
| `nakama/src/scheduler/windows.ts` (NEW — implied) | scheduler/transform | batch transform on storage | `nakama/src/main.ts` `seedClubs` (storageList loop) | partial |
| `nakama/src/scheduler/seasons.ts` (NEW — implied) | scheduler/transform | batch transform on storage | `nakama/src/main.ts` `seedClubs` | partial |
| `nakama/src/scheduler/leaderboard_cron.ts` (NEW) | scheduler/registrar | event-driven (Init hook) | `nakama/src/main.ts:112` `InitModule` | role-match |
| `nakama/src/rpc/admin_postpone_fixture.ts` (NEW) | RPC controller | request-response (admin mutate) | `nakama/src/rpc/create_pibe.ts` | role-match (extends w/ admin guard) |
| `nakama/src/rpc/admin_close_window.ts` (NEW) | RPC controller | request-response (admin mutate) | `nakama/src/rpc/create_pibe.ts` | role-match |
| `nakama/src/rpc/admin_set_season_window.ts` (NEW) | RPC controller | request-response (admin mutate) | `nakama/src/rpc/create_pibe.ts` | role-match |
| `nakama/src/rpc/admin_force_repoll.ts` (NEW) | RPC controller | request-response (admin trigger) | `nakama/src/rpc/delete_account.ts` (no-payload pattern) | role-match |
| `nakama/src/rpc/admin_list_windows.ts` (NEW) | RPC controller | request-response (admin read) | `nakama/src/rpc/get_clubs.ts` | exact |
| `nakama/src/rpc/admin_inject_test_fixture.ts` (NEW) | RPC controller | request-response (admin mutate, test-only) | `nakama/src/rpc/create_pibe.ts` | role-match |
| `nakama/src/rpc/register_fcm_token.ts` (NEW) | RPC controller | request-response (user write) | `nakama/src/rpc/create_pibe.ts` | exact |
| `nakama/src/rpc/get_current_window.ts` (NEW) | RPC controller | request-response (user read) | `nakama/src/rpc/get_clubs.ts` | exact |
| `nakama/src/rpc/request_password_reset.ts` (REPLACES stub) | RPC controller | request-response (anti-enum) | `nakama/src/rpc/request_password_reset.ts` (Phase 1 stub) | exact (real impl) |
| `nakama/src/rpc/confirm_password_reset.ts` (REPLACES stub) | RPC controller | request-response (token consume) | `nakama/src/rpc/confirm_password_reset.ts` (Phase 1 stub) | exact (real impl) |
| `nakama/src/util/admin_auth.ts` (NEW) | utility/middleware | helper (sync function) | `nakama/src/util/validation.ts` | role-match |
| `nakama/src/util/topic_name.ts` (NEW) | utility/validator | helper (sync function) | `nakama/src/util/validation.ts` | exact |
| `nakama/src/util/json_parse.ts` (NEW if missing) | utility | helper (sync function) | `nakama/src/util/validation.ts` | role-match |
| `nakama/build.mjs` (verify unchanged) | config/build | n/a | self | exact |
| `nakama/package.json` (verify unchanged) | config | n/a | self | exact |
| `nakama/local.yml` + `Dockerfile.nakama` (MODIFIED — env vars) | config | n/a | self | exact |
| `scripts/autoloads/AppConfig.gd` (MODIFIED — flip flag) | autoload/config | n/a | self | exact |
| `scripts/autoloads/StorageKeys.gd` (MODIFIED — mirror) | autoload/config | n/a | self (mirror server) | exact |
| `scripts/autoloads/NakamaService.gd` (MODIFIED — add async methods) | autoload/service | request-response (RPC wrapper) | `scripts/autoloads/AuthManager.gd:request_password_reset` | exact |
| `scripts/autoloads/PlayerStore.gd` (MODIFIED — add fields) | autoload/store | n/a | self | exact |
| `scripts/autoloads/FlowRouter.gd` (MODIFIED — post-club hook) | autoload/router | event-driven | self | exact |
| `scripts/screens/HomeScreen.gd` (MODIFIED — show window banner) | screen | request-response (read on resume) | `scripts/screens/ClubPickerScreen.gd:_load_clubs` | role-match |
| `scenes/HomeScreen.tscn` (MODIFIED — add WindowBanner) | scene | n/a | self | exact |
| `android/plugins/FCMPlugin/` (NEW — GDExtension) | native plugin (Java) | event-driven (OS push callback) | NONE — first native plugin in repo | NO ANALOG (HIGH research-required) |
| `nakama/test/heartbeat-test.sh` (NEW) | test/smoke | sh + curl | `nakama/smoke-test.sh` | exact |
| `nakama/test/admin-curl-examples.md` (NEW) | doc | n/a | `.planning/phases/01-foundation/INFRA-NOTES.md` | partial |
| `.planning/phases/01-foundation/INFRA-NOTES.md` (APPENDED) | doc | n/a | self | exact |

---

## Pattern Assignments

### Group A — Server RPCs (`nakama/src/rpc/*.ts`)

#### Canonical RPC analog: `nakama/src/rpc/get_clubs.ts`

Every Phase 1 RPC is a single exported function `rpc{Name}` with the signature
`(ctx, logger, nk, payload) => string`. Synchronous (Goja has no async). JSON in, JSON out via `JSON.stringify(...)`. Throws `Error("invalid_json_payload")` on parse failure for **internal** errors; otherwise returns `{ok:false, error:"..."}`.

**Imports + interface declaration** (`get_clubs.ts:1-20`):

```typescript
// RPC: get_clubs
// Returns the catalog of seeded clubs. ...
import { COL_CLUBS, SYSTEM_USER_ID } from '../storage_keys';

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

interface GetClubsInput {
  division?: string;
  search?: string;
  page?: number;
  page_size?: number;
}
```

**RPC signature + payload parsing** (`get_clubs.ts:22-35`):

```typescript
export function rpcGetClubs(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  let input: GetClubsInput = {};
  if (payload && payload.length > 0) {
    try {
      input = JSON.parse(payload) as GetClubsInput;
    } catch (e) {
      throw new Error('invalid_json_payload');
    }
  }
```

**Authenticated-user mutate pattern** (`create_pibe.ts:42-77`):

```typescript
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

  // ... validate name + club_id ...
  if (typeof input.club_id !== 'string' || input.club_id.length === 0 || input.club_id.length > 64) {
    return JSON.stringify({ ok: false, error: 'invalid_club_id' });
  }
```

**Storage write w/ permissions** (`create_pibe.ts:100-122`):

```typescript
nk.storageWrite([
  {
    collection: COL_PIBES, key: KEY_PIBE_MAIN, userId,
    value: pibe,
    permissionRead: 1, // owner read
    permissionWrite: 0, // never client-write — server only via RPC
  },
  // ...
]);
logger.info('create_pibe: user=%s pibe=%s club=%s', userId, pibeId, clubId);
return JSON.stringify({ ok: true, pibe });
```

**Storage list pagination + filter** (`get_clubs.ts:47-60`):

```typescript
let cursor = '';
const all: any[] = [];
// Cap iterations to avoid runaway loops if Storage misbehaves.
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

#### New RPC files mirroring this pattern

| File | Pattern fidelity | Deviation Phase 2 introduces |
|------|------------------|-----------------------------|
| `rpc/register_fcm_token.ts` | **same** as create_pibe (authenticated user mutate) | writes to new `COL_FCM_TOKENS`; `permissionRead:0, permissionWrite:0` (token is private) |
| `rpc/get_current_window.ts` | **same** as get_clubs (read with storageList loop + filter by player's club_id) | reads `COL_MATCH_WINDOWS` (system-owned, `permissionRead:2`); requires `ctx.userId` to look up player's club from `players/profile` |
| `rpc/request_password_reset.ts` | **extends** Phase 1 stub | replaces `[Phase 1 stub]` log with real `nk.sqlQuery` user lookup + `nk.uuidv4()` token gen + `storageWrite` to `COL_RESET_TOKENS`; preserves `JSON.stringify({ok:true})` uniform return. **See §"Reset token machinery" excerpt in RESEARCH.md lines 1206-1278 — copy verbatim.** |
| `rpc/confirm_password_reset.ts` | **extends** Phase 1 stub | replaces `feature_unavailable_phase_1` with `storageList` scan over `COL_RESET_TOKENS`, expiry check, `nk.linkEmail()` mutation, mark consumed atomically. **See RESEARCH.md lines 1280-1348.** |
| `rpc/admin_postpone_fixture.ts` | **deviates** — admin guard first, then create_pibe-style mutate | first call `requireAdmin(ctx, logger)`; if `!auth.ok` return `{ok:false, error:auth.error}`. Write to `COL_MATCH_WINDOWS` + audit row in `COL_ADMIN_ACTIONS` (see Group D excerpt). |
| `rpc/admin_close_window.ts` | **deviates** — same as above | identical guard + audit pattern. See RESEARCH.md lines 1383-1426 — full canonical excerpt. |
| `rpc/admin_set_season_window.ts` | **deviates** — same as above | writes to `COL_META`, key `current_season` (D-16 shape). |
| `rpc/admin_force_repoll.ts` | **deviates** — admin guard + no-payload trigger like `delete_account.ts` (payload=`_payload`) | calls `runHeartbeatTick(...)` synchronously; logs result. |
| `rpc/admin_list_windows.ts` | **same** as get_clubs (paginated read, optional state filter) | scans `COL_MATCH_WINDOWS` with `state?` filter mirroring get_clubs's `division?` filter; protected by admin guard. |
| `rpc/admin_inject_test_fixture.ts` | **deviates** — gated by `ADMIN_TEST_MODE` env BEFORE admin guard | abort if `ctx.env['ADMIN_TEST_MODE'] !== 'true'` with `{ok:false, error:'test_mode_disabled'}` — Wave 0 prerequisite per VALIDATION.md. |

---

### Group B — Server Integrations (`nakama/src/integrations/*.ts`)

#### Analog: `nakama/src/util/email.ts` (Phase 1 Resend stub)

Phase 1 has **no `integrations/` directory** — `email.ts` lives under `util/` and is the only HTTP-bound adapter shipped so far. Phase 2 promotes integration adapters into a new `integrations/` directory; the convention this file establishes (function signature, return-shape, stub vs real switching) is the closest precedent.

**Reference excerpt** (`util/email.ts:10-26`):

```typescript
export interface SendResetEmailInput {
  to: string;
  resetLink: string;
  fromEmail?: string;
  apiKey?: string;
}

export interface SendResetEmailResult {
  sent: boolean;
  reason?: string; // "stubbed" | "missing_api_key" | "http_error" | etc.
}

export function sendResetEmail(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: SendResetEmailInput,
): SendResetEmailResult {
```

**Reference impl pattern** (commented in `util/email.ts:30-55`) — `nk.httpRequest('https://...', 'post', headers, body)`, check `res.code >= 200 && < 300`, log + return `{sent:false, reason:'http_error'}` on non-2xx. **Phase 2 uses this exact return-shape for all three new integrations.**

#### New integration files

| File | Pattern fidelity | Reference RESEARCH.md excerpt | Notes |
|------|------------------|------------------------------|-------|
| `integrations/resend.ts` | **same shape** — extracted/moved from `util/email.ts` and turned on behind `RESEND_ENABLED` flag | RESEARCH.md `request_password_reset.ts` body uses `sendResetEmail(...)` — reuse signature, replace stub body with real `nk.httpRequest` (commented impl in `util/email.ts:30-55`). | Email template inline string per D-26. |
| `integrations/api_football.ts` | **extends shape** — adds `pollFixtures()` + internal `getLeagueIds()` + `normalize()` + `upsertFixture()` helpers, all using `nk.httpRequest` | RESEARCH.md §"Code Patterns" 2, lines 818-948 — copy verbatim as starting point | Wave 0: discover league IDs via `/leagues?country=Argentina&current=true`; persist to `COL_META, key='api_football_league_ids'`. |
| `integrations/fcm.ts` | **extends shape** — adds OAuth2 service-account flow (`nk.jwtGenerate('RS256', ...)`), token caching in `COL_META`, `sendTopic()` HTTP call | RESEARCH.md §"Code Patterns" 3, lines 951-1067 — copy verbatim as starting point | `base64ToUtf8` helper required (Goja ArrayBuffer → string). Service account from `FCM_SERVICE_ACCOUNT_B64` env. |

**Shape convention all three new integrations enforce:**

```typescript
// (mirrors util/email.ts:10-26 — shape Phase 2 inherits)
export interface XxxResult { sent: boolean; reason?: string; }
export function doX(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  input: XxxInput,
): XxxResult { ... }
```

---

### Group C — Server Scheduler (`nakama/src/scheduler/*.ts`)

#### Analog: NONE — Phase 2 first-mover

Phase 1 has no scheduler. The closest precedent for "do batch work over storage" is `main.ts:seedClubs` (pagination + write loop) — applicable to `scheduler/windows.ts` materializing fixture rows, but NOT applicable to the timer entry point itself.

**Partial analog (storage iteration pattern from `main.ts:62-78`):**

```typescript
// Pagination + delete pattern reused for "list match_windows page-by-page" + transition evaluation.
let cursor = '';
const toDelete: nkruntime.StorageDeleteRequest[] = [];
for (let i = 0; i < 50; i++) {
  const page = nk.storageList(SYSTEM_USER_ID, COL_CLUBS, 100, cursor);
  if (page.objects && page.objects.length > 0) {
    for (const obj of page.objects) {
      toDelete.push({ collection: COL_CLUBS, key: obj.key, userId: SYSTEM_USER_ID });
    }
  }
  if (!page.cursor) break;
  cursor = page.cursor;
}
```

#### Phase 2 establishes the convention

| File | Source pattern | Notes |
|------|---------------|-------|
| `scheduler/tick.ts` | RESEARCH.md §"Code Patterns" 1, lines 679-792 — `runHeartbeatTick(ctx, logger, nk, triggeredBy)` with **distributed-lock pattern** via `COL_META, key='tick_lock'` (5-min TTL, epoch UUID). | Lock-acquire-release flanks the work; `try { ... } finally { release }`. **Goja: no setTimeout, no async** — entire tick is synchronous in-process. |
| `scheduler/windows.ts` | RESEARCH.md §"Code Patterns" 4, lines 1072-1201 — `evaluateWindowTransitions()` + `upsertOrTransitionWindow()` + `markWindowCancelled()`. | Uses `nk.storageList` pagination (mirror `main.ts:seedClubs`). Optimistic concurrency via `version` field on storageWrite. **Anti-double-push:** `notified_open_at` marker set in same storageWrite that transitions state. |
| `scheduler/seasons.ts` | RESEARCH.md D-16/D-17 — read `COL_FIXTURES`, cluster by `league.season`, write `COL_META, key='current_season'`. No published excerpt; planner derives from D-16 shape. | Singleton record, single storageRead + storageWrite per tick. |
| `scheduler/leaderboard_cron.ts` | RESEARCH.md §"Code Patterns" 1, lines 795-813 — `ensureSchedulerLeaderboards(nk, logger)` + `initializer.registerLeaderboardReset(...)` callback. | Called from `InitModule` AFTER `seedClubs`. Idempotent `leaderboardCreate` (try/catch "already exists"). |

**Critical scheduler conventions Phase 2 locks in:**

1. **No `nk.timerCreate`** — does not exist. Use `initializer.registerLeaderboardReset` with dummy leaderboards `bb_tick_15m` (cron `*/15 * * * *`) + `bb_tick_6h` (cron `0 */6 * * *`). RESEARCH.md Q1.
2. **Tick lock** via `COL_META, key='tick_lock'`, epoch UUID, 5-min TTL. Required by VALIDATION.md test `02-07-Tick-lock`.
3. **Cadence gating** — `state.active_cadence` in `COL_META, key='scheduler_state'` decides whether 15m or 6h tick does real work; the other returns immediately.

---

### Group D — Server Utilities (`nakama/src/util/*.ts`)

#### Canonical util analog: `nakama/src/util/validation.ts`

Phase 1 utilities are pure synchronous functions exposing `ValidationResult` (or a tagged-union result type). No I/O, no `nk` parameter except where strictly needed.

**Validation result shape** (`util/validation.ts:67-70`):

```typescript
export interface ValidationResult {
  ok: boolean;
  error?: string;
}
```

**Regex-allowlist pattern** (`util/validation.ts:14-18`):

```typescript
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;
// Allowed glyph class — letters incl. Spanish (á-ÿ, ñ, ü), digits, space, _ -
const ALLOWED_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 _-]+$/;
```

**Validator function** (`util/validation.ts:72-98`):

```typescript
export function validatePibeName(raw: unknown): ValidationResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'name_must_be_string' };
  }
  const name = raw.trim();
  if (name.length < MIN_LENGTH) {
    return { ok: false, error: 'name_too_short' };
  }
  // ...
  if (!ALLOWED_RE.test(name)) {
    return { ok: false, error: 'name_has_invalid_chars' };
  }
  return { ok: true };
}
```

#### New util files

| File | Pattern fidelity | RESEARCH.md excerpt | Deviation |
|------|------------------|--------------------|-----------|
| `util/topic_name.ts` | **same** — pure validator with regex allowlist, returns ValidationResult-like | FCM topic name regex: `[a-zA-Z0-9_.~%-]+` (RESEARCH S-5, line 1521) — single-line allowlist `/^[a-zA-Z0-9_.~%-]+$/`. | Returns `{ ok, sanitized?, error? }` — `sanitized` is the topic-safe string (e.g., `club_xeneizes_de_la_ribera`). Length cap 900 per Q5 finding. |
| `util/admin_auth.ts` | **deviates** — needs `ctx` parameter to read `ctx.env` + `ctx.headers`; returns tagged union `{ok:true, callerIp} \| {ok:false, error}` | RESEARCH.md §"Code Patterns" 6, lines 1353-1378 — copy verbatim. | Header lookup must handle Nakama's lower-cased keys (`ctx.headers['authorization']`); fallback to `'Authorization'`. **Constant-time compare** to mitigate timing oracle (T-2-ADM-01 threat). |
| `util/json_parse.ts` (if missing) | **same** — pure helper, returns `{ ok, value, error }` | None in RESEARCH.md (small). | If RPCs in Phase 2 begin to look repetitive on `JSON.parse(payload \|\| '{}')` blocks, planner consolidates here. Optional — keep RPCs self-contained if it's clearer. |

#### Admin RPC pattern (consumer of `util/admin_auth.ts`)

**Reference RESEARCH.md §6 lines 1383-1426** — copy verbatim as `rpc/admin_close_window.ts`:

```typescript
import { COL_MATCH_WINDOWS, COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminCloseWindow(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { fixture_id?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  // ... validate, mutate, audit ...

  // Audit row — every admin RPC writes one of these (D-22).
  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: { action: 'admin_close_window', fixture_id: fixtureId,
             caller_ip: auth.callerIp, at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[admin] close_window fixture=%s by ip=%s', fixtureId, auth.callerIp);
  return JSON.stringify({ ok: true });
}
```

---

### Group E — Server Entrypoint (`nakama/src/main.ts`)

#### Analog: self (extend in place) — `main.ts:112-129`

Phase 2 modifies `InitModule` to (1) ensure scheduler leaderboards + (2) register reset hook + (3) register 8 new RPCs alongside the existing 5.

**Reference** (`main.ts:112-129`):

```typescript
export function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  logger.info('BarraBrava runtime starting...');

  seedClubs(nk, logger);

  initializer.registerRpc('get_clubs', rpcGetClubs);
  initializer.registerRpc('create_pibe', rpcCreatePibe);
  initializer.registerRpc('delete_account', rpcDeleteAccount);
  initializer.registerRpc('request_password_reset', rpcRequestPasswordReset);
  initializer.registerRpc('confirm_password_reset', rpcConfirmPasswordReset);

  logger.info('BarraBrava runtime ready: 5 RPCs registered');
}
```

**Phase 2 extension shape** (per RESEARCH.md §1 lines 795-813):

```typescript
// After seedClubs:
ensureSchedulerLeaderboards(nk, logger);

initializer.registerLeaderboardReset(function (ctx, logger, nk, lb, resetTs) {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id as any);
  }
});

// 8 new RPCs alongside existing 5:
initializer.registerRpc('register_fcm_token', rpcRegisterFcmToken);
initializer.registerRpc('get_current_window', rpcGetCurrentWindow);
initializer.registerRpc('admin_postpone_fixture', rpcAdminPostponeFixture);
initializer.registerRpc('admin_close_window', rpcAdminCloseWindow);
initializer.registerRpc('admin_set_season_window', rpcAdminSetSeasonWindow);
initializer.registerRpc('admin_force_repoll', rpcAdminForceRepoll);
initializer.registerRpc('admin_list_windows', rpcAdminListWindows);
// Conditional: admin_inject_test_fixture only when ADMIN_TEST_MODE=true (gate inside the RPC, register unconditionally so tests can see the 'test_mode_disabled' error)
initializer.registerRpc('admin_inject_test_fixture', rpcAdminInjectTestFixture);

logger.info('BarraBrava runtime ready: 13 RPCs registered + scheduler armed');
```

**CRITICAL constraints reused from Phase 1:**
- `InitModule` MUST stay a **function declaration**, not arrow function (`main.ts:108-111` comment — Goja AST lookup).
- All new imports added at top alongside existing `import { rpcGetClubs } ...`.

---

### Group F — Server Storage Keys (`nakama/src/storage_keys.ts`)

#### Analog: self — extend in place

**Reference** (`storage_keys.ts:11-25`):

```typescript
export const COL_PIBES = 'pibes';
export const COL_PLAYERS = 'players';
export const COL_CLUBS = 'clubs';
export const COL_RESET_TOKENS = 'reset_tokens';
export const COL_META = 'meta';

// Per-user fixed-slot keys (Phase 1 = 1 pibe per account; profile is a singleton).
export const KEY_PIBE_MAIN = 'main';
export const KEY_PLAYER_PROFILE = 'profile';

// Postgres nil UUID — used as userId for system-owned (public-read) collections
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
```

**Phase 2 additions (per CONTEXT.md D-05, D-10, D-22 + RESEARCH.md `KEY_*` constants):**

```typescript
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
export const KEY_API_FOOTBALL_LEAGUE_IDS = 'api_football_league_ids';
export const KEY_FCM_OAUTH = 'fcm_oauth_token';
```

**Mirror obligation (CR-01 lesson learned):**

`scripts/autoloads/StorageKeys.gd` MUST mirror every collection the **client reads** (i.e., `COL_MATCH_WINDOWS` — read for HomeScreen banner; `COL_FCM_TOKENS` — written via RPC; `COL_FIXTURES` — possibly never read by client; `COL_ADMIN_ACTIONS` + tick/season/oauth keys — never read by client, skip mirror). Confirmed by RESEARCH.md line 1438: "client never reads tokens" for `COL_RESET_TOKENS` precedent.

---

### Group G — Client Autoloads (`scripts/autoloads/*.gd`)

#### G1. `AppConfig.gd` (MODIFIED — flip flag + add FCM constants)

**Analog:** self — `AppConfig.gd:25-37`.

**Reference** (`AppConfig.gd:24-37`):

```gdscript
# Feature flags — Phase 1 invariants enforced in _ready() asserts (PRV-05).
const ANALYTICS_ENABLED := false
const PUSH_NOTIFICATIONS_ENABLED := false
const GPS_ENABLED := false

func _ready() -> void:
    # PRV-05 hardening: any Phase 1 build that ships with these enabled is a regression.
    assert(not ANALYTICS_ENABLED, "PRV-05: analytics must stay off in Phase 1")
    assert(not PUSH_NOTIFICATIONS_ENABLED, "PRV-05: push must stay off in Phase 1")
    assert(not GPS_ENABLED, "PRV-05: GPS must stay off in Phase 1")
```

**Phase 2 changes:**
- `PUSH_NOTIFICATIONS_ENABLED := true` (flip; per CONTEXT.md `<code_context>` "Reusable Assets" line 169).
- **DELETE** the `assert(not PUSH_NOTIFICATIONS_ENABLED, ...)` line — assert no longer applies.
- Optionally add `FCM_TOPIC_PREFIX := "club_"` constant for use by NakamaService.

#### G2. `StorageKeys.gd` (MODIFIED — mirror server)

**Analog:** self — `StorageKeys.gd:9-20` (Phase 1 mirror table).

**Reference** (`StorageKeys.gd:9-20`):

```gdscript
const COL_PIBES := "pibes"
const COL_PLAYERS := "players"
const COL_CLUBS := "clubs"
const COL_RESET_TOKENS := "reset_tokens"
const COL_META := "meta"

const KEY_PIBE_MAIN := "main"
const KEY_PLAYER_PROFILE := "profile"

const SYSTEM_USER_ID := "00000000-0000-0000-0000-000000000000"
```

**Phase 2 mirror — add only what client actually reads** (to keep mirror tight):

```gdscript
# Phase 2 additions — mirror nakama/src/storage_keys.ts.
# Only collections the CLIENT reads or writes via Storage API are mirrored;
# RPC-only collections (admin_actions, fcm_oauth_token, tick_lock, etc.) are
# server-internal and omitted to avoid drift cost.
const COL_MATCH_WINDOWS := "match_windows"
# COL_FCM_TOKENS not mirrored — client only writes via register_fcm_token RPC.
```

#### G3. `NakamaService.gd` (MODIFIED — add async RPC wrappers)

**Analog:** `AuthManager.gd:61-66` (Phase 1 added `request_password_reset` wrapper there — same pattern for new RPCs).

**Reference** (`AuthManager.gd:61-66`):

```gdscript
func request_password_reset(email: String) -> Dictionary:
    var payload = JSON.stringify({"email": email.strip_edges()})
    var resp = await NakamaService.client.rpc_async(null, "request_password_reset", payload)
    if resp.is_exception():
        return {"ok": false, "error": str(resp.get_exception().message)}
    return {"ok": true}
```

**Phase 2 new methods (place in NakamaService.gd, not AuthManager.gd — these are session-bound RPCs not auth-flow):**

| Method | Authenticated? | RPC name | Payload shape |
|--------|----------------|----------|---------------|
| `register_fcm_token(token: String, platform: String) -> Dictionary` | yes | `register_fcm_token` | `{"token":..., "platform":"android"\|"ios"}` |
| `subscribe_to_club_topic(club_id: String) -> Dictionary` | yes | n/a — server-side: subscription happens automatically on `register_fcm_token` (per D-11). Alternatively a separate RPC if planner picks per-RPC granularity. | — |
| `get_current_window() -> Dictionary` | yes | `get_current_window` | `{}` (server reads `ctx.userId` → player profile → club_id) |

Each method mirrors the `request_password_reset` wrapper exactly: `JSON.stringify` payload, `await rpc_async(session, name, payload)`, check `is_exception()`, return `{"ok":bool,"error"?,"data"?}`.

#### G4. `PlayerStore.gd` (MODIFIED — add fields)

**Analog:** self — `PlayerStore.gd:14-21`.

**Reference** (`PlayerStore.gd:14-21`):

```gdscript
signal profile_loaded
signal profile_cleared

var pibe_id: String = ""
var pibe_name: String = ""
var club_id: String = ""
var club_name: String = ""
```

**Phase 2 additions:**

```gdscript
# Phase 2: push + heartbeat state.
var subscribed_topics: Array[String] = []     # ["club_xeneizes_de_la_ribera", ...]
var current_window: Dictionary = {}            # latest get_current_window response; {} if none
```

**Clear pattern** — extend `clear()` (`PlayerStore.gd:25-30`) to also reset these:

```gdscript
func clear() -> void:
    pibe_id = ""
    pibe_name = ""
    club_id = ""
    club_name = ""
    subscribed_topics.clear()
    current_window = {}
    profile_cleared.emit()
```

#### G5. `FlowRouter.gd` (MODIFIED — post-ClubPicker hook)

**Analog:** self — `FlowRouter.gd:30-46` (`go_to` already in place).

Phase 2 does NOT add a new screen; it adds a side-effect hook in the existing `ClubPickerScreen._on_cta` (Group H) which calls back into `NakamaService.register_fcm_token` + topic subscribe after `PlayerStore.club_id = ...`. FlowRouter itself unchanged unless planner factors out a `_after_club_picked()` helper.

---

### Group H — Client Screens (`scripts/screens/*.gd` + `scenes/*.tscn`)

#### `HomeScreen.gd` + `HomeScreen.tscn` (MODIFIED — show window banner)

**Analog:** `ClubPickerScreen.gd:66-86` (`_load_clubs` — async RPC on `_ready`, parse response, populate UI).

**Reference** (`ClubPickerScreen.gd:66-86`):

```gdscript
func _load_clubs() -> void:
    var session = AuthManager.session
    var page_size := 100
    var payload = JSON.stringify({"division": "Todos", "page": 1, "page_size": page_size})
    var resp = await NakamaService.client.rpc_async(session, "get_clubs", payload)
    if resp.is_exception():
        push_error("[ClubPicker] get_clubs failed: %s" % resp.get_exception().message)
        return
    var data = JSON.parse_string(resp.payload)
    _all_clubs = data.get("clubs", [])
    # ...
    _render_clubs()
```

**HomeScreen current shape** (`HomeScreen.gd:12-20`):

```gdscript
func _ready() -> void:
    if PlayerStore.pibe_name == "":
        await PlayerStore.load_from_server()
    pibe_label.text = PlayerStore.pibe_name if PlayerStore.pibe_name != "" else "Pibe"
    club_label.text = PlayerStore.club_name if PlayerStore.club_name != "" else "—"
    empty_heading.text = "Tu barra te espera."
    empty_body.text = "Empezá a laburar."
```

**Phase 2 extension** — in `_ready()` (and a new `_on_visibility_changed` / `notification(NOTIFICATION_APPLICATION_RESUMED)` handler):

```gdscript
# Phase 2: fetch + render next match window for the player's club.
var window_resp = await NakamaService.get_current_window()
if window_resp.get("ok", false):
    PlayerStore.current_window = window_resp.get("data", {})
    _update_window_banner()
```

`scenes/HomeScreen.tscn` MODIFIED — add a `WindowBanner` node inside `Content` between `Empty` and `DeleteAccount`. Reference existing TopBar Label nodes (`HomeScreen.tscn:31-45`) for theme font sizes / color conventions (`theme_override_font_sizes/font_size = 22`, `Color(0.627, 0.627, 0.627, 1)` for subdued text).

**Banner copy convention (D-13 — lunfardo):**
- `scheduled`: "Falta para que abra la ventana: HH:MM"
- `open`/`live`: "¡Ventana abierta! Tu club juega ahora."
- `closed`: "Ventana cerrada. Próximo partido en X días."

---

### Group I — Native Plugin (`android/plugins/FCMPlugin/`)

#### Analog: **NONE** in repo. HIGH research-required.

`android/` directory does not exist in repo (no Glob hits for `android/plugins/**`). Phase 2 introduces:
- Godot 4.3 GDExtension plugin pattern (Java/Kotlin source + JNI bindings).
- Firebase Cloud Messaging Android SDK integration.
- Custom AndroidManifest.xml entries for FirebaseMessagingService.
- Build integration via Godot Android export template.

**References the planner must fetch:**

| Reference | Why |
|-----------|-----|
| Godot 4.3 [Android plugin documentation](https://docs.godotengine.org/en/stable/tutorials/platform/android/android_plugin.html) | GDExtension lifecycle, Java↔GDScript bridging via signals |
| Heroic Labs Godot client docs | Coordination with existing NakamaService — none direct, but confirm session token flow |
| Firebase Android SDK FCM integration guide | Java side: `FirebaseMessaging.getInstance().getToken()`, `subscribeToTopic(name)`, `FirebaseMessagingService.onMessageReceived(RemoteMessage)` |
| RESEARCH.md Q4 (Godot 4.3 FCM integration) lines 327-378 | Phase 2 research summary — read before planning |
| RESEARCH.md S-17 (Custom FCM plugin signing on Android CI) line 1590-1595 | Build signing pitfall |

**Phase 2 minimum surface (Android-only; iOS deferred to Phase 7 per CONTEXT.md):**

```java
// android/plugins/FCMPlugin/src/main/java/.../FCMPlugin.java
public class FCMPlugin extends GodotPlugin {
  @UsedByGodot public String getDeviceToken() { ... }
  @UsedByGodot public void subscribeToTopic(String topicName) { ... }
  @UsedByGodot public void unsubscribeFromTopic(String topicName) { ... }
  public Set<SignalInfo> getPluginSignals() {
    return setOf(new SignalInfo("on_token_received", String.class),
                 new SignalInfo("on_message_received", Dictionary.class));
  }
}
```

**Planner action:** This is a Wave 1+ task. Carve out a dedicated plan with HIGH-uncertainty flag and validation via real Android device (per VALIDATION.md "Manual-Only Verifications" — "Real push delivery to Android device").

---

### Group J — Build / Config

#### J1. `nakama/build.mjs` — likely unchanged (verify)

**Analog:** self — `build.mjs:14-27`.

**Reference** (`build.mjs:12-27`):

```javascript
const clubsJson = readFileSync('./data/clubs.json', 'utf-8');

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'build/index.js',
  bundle: true,
  format: 'iife',
  globalName: '__bbmod',
  target: 'es2017',
  platform: 'neutral',
  define: {
    __CLUBS_JSON__: JSON.stringify(clubsJson),
  },
  external: ['nakama-runtime'],
  logLevel: 'info',
});
```

**Phase 2 decision point:** if `FCM_SERVICE_ACCOUNT_B64` is to be **injected at build time** (e.g., via CI Secret → `define` block), the planner can extend the `define:` shape exactly like `__CLUBS_JSON__`. **Default Phase 2 path (CONTEXT.md D-11 → ctx.env at runtime):** no build.mjs change — FCM service account read from `ctx.env['FCM_SERVICE_ACCOUNT_B64']` per RESEARCH.md fcm.ts pattern (line 971-972). Verify this remains the chosen approach.

#### J2. `nakama/package.json` — unchanged (verify)

**Reference** (`package.json:10-14`):

```json
"devDependencies": {
  "esbuild": "^0.21.0",
  "nakama-runtime": "github:heroiclabs/nakama-common#master",
  "typescript": "^5.4.0"
}
```

`nk.jwtGenerate` is **native** to Nakama runtime (RESEARCH.md Q3 confirms RS256 support) — no `jsonwebtoken` or similar npm dep needed. **Confirm no new devDependency required.**

#### J3. `nakama/local.yml` + `Dockerfile.nakama` (MODIFIED — env vars)

**Analog:** self — `local.yml:19-25`.

**Reference** (`local.yml:19-25`):

```yaml
runtime:
  js_entrypoint: "build/index.js"
  env:
    - "RESEND_API_KEY=${RESEND_API_KEY}"
    - "RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}"
    - "PASSWORD_RESET_BASE_URL=${PASSWORD_RESET_BASE_URL}"
```

**Phase 2 additions** (8 new env vars per CONTEXT.md pattern):

```yaml
    - "API_FOOTBALL_KEY=${API_FOOTBALL_KEY}"
    - "FCM_SERVICE_ACCOUNT_B64=${FCM_SERVICE_ACCOUNT_B64}"
    - "FCM_PROJECT_ID=${FCM_PROJECT_ID}"
    - "RESEND_ENABLED=${RESEND_ENABLED}"           # "true" | "false" — D-25
    - "RESEND_FROM=${RESEND_FROM}"                  # rename if needed; current Phase 1 uses RESEND_FROM_EMAIL
    - "ADMIN_BEARER=${ADMIN_BEARER}"                # ≥16 chars (admin_auth.ts asserts)
    - "ADMIN_TEST_MODE=${ADMIN_TEST_MODE}"          # "true" | "false" — gates admin_inject_test_fixture
```

Document EVERY new env in `INFRA-NOTES.md` (Group L below).

---

### Group K — Tests

#### `nakama/test/heartbeat-test.sh` (NEW)

**Analog:** `nakama/smoke-test.sh` (full file — 171 lines, Phase 1 canonical pattern).

**Reference** (`smoke-test.sh:1-20`):

```bash
#!/usr/bin/env bash
# BarraBrava Nakama smoke test — end-to-end check of the 5 RPCs against a live server.
set -euo pipefail

NAKAMA_HOST="${NAKAMA_HOST:-nakama-production-7ea8.up.railway.app}"
NAKAMA_KEY="${NAKAMA_KEY:-defaultkey}"
BASE="https://${NAKAMA_HOST}"

# Unique test email per run so we don't collide if the script runs twice without cleanup.
TEST_EMAIL="smoketest+$(date +%s)@barrabrava.test"
TEST_PASSWORD="smoke-test-pw-1234"

basic_auth() {
  printf '%s' "$(printf '%s:' "$NAKAMA_KEY" | base64 | tr -d '\n')"
}
```

**RPC invocation pattern with `?unwrap` + jq parsing** (`smoke-test.sh:68-79`):

```bash
GET_CLUBS_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/get_clubs?unwrap" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"division":"Primera","page":1,"page_size":50}')

if ! echo "$GET_CLUBS_RESP" | grep -q "lunfardo_name"; then
  echo "FAIL: get_clubs did not return any clubs"
  exit 1
fi
```

**Admin RPC invocation pattern Phase 2 introduces (no analog in Phase 1):**

```bash
ADMIN_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/admin_close_window?unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"fixture_id":"12345"}')
```

Note: admin RPCs use **`ADMIN_BEARER`** in the `Authorization` header (NOT a session token). The Nakama Bearer auth pattern doesn't apply — the bearer token is interpreted by `util/admin_auth.ts:requireAdmin`, not Nakama itself. Per VALIDATION.md `02-06-Admin-A/B/C`, three smoke cases: missing header → `unauthorized`, wrong bearer → `unauthorized`, valid bearer + valid payload → mutation + audit row.

**Phase 2 invariants from VALIDATION.md** — 17 cases. Each follows the `=== N) ===` echo + `curl` + `grep` pattern. Tests `02-07-Tick-lock` is **manual logs** per VALIDATION.md, not automated.

#### `nakama/test/admin-curl-examples.md` (NEW)

**Analog:** `.planning/phases/01-foundation/INFRA-NOTES.md` (canonical reference-doc pattern — table-of-contents at top, sectioned with H2/H3).

Phase 2 establishes the convention: companion doc with copy-pasteable curl invocations for each admin RPC + each VALIDATION.md test case. Doubles as Phase 2 "admin runbook" — referenced from `INFRA-NOTES.md` (Group L).

---

### Group L — Documentation Updates

#### `.planning/phases/01-foundation/INFRA-NOTES.md` (APPENDED, not rewritten)

**Analog:** self — `INFRA-NOTES.md:1-40` (Phase 1 section format with H2 headers per service).

**Reference** (`INFRA-NOTES.md:1-15`):

```markdown
# Phase 1 — Infrastructure Notes

> Bitácora de URLs, credenciales (REFERENCED, no secretos en plano), y estado de trámites.

## Railway

- **Proyecto:** `honest-heart` (auto-generado, **NO renombrado** a `barrabrava-nakama` todavía — TODO opcional)
- **Región:** US East _(Railway NO tiene São Paulo — ver D-15 revisado en `01-CONTEXT.md`)_
- **Postgres plugin:** ✓ online (instalado, `DATABASE_URL` disponible vía reference variable)
- **Nakama service:** creado, deploy configurado vía GitHub repo `lukasval/barrabrava` branch `main`, builder Dockerfile (`Dockerfile.nakama`)
- **URL pública Nakama:** `https://nakama-production-7ea8.up.railway.app`
```

**Phase 2 append sections** (per CONTEXT.md line 149):

1. `## AFA Scheduler` — cadence config (15m/6h), tick lock, league IDs discovery.
2. `## FCM Setup` — GCP project creation steps, service-account JSON → base64 → Railway env var, project ID source.
3. `## Admin RPCs` — bearer token generation (UUIDv4), env var `ADMIN_BEARER` setup, link to `admin-curl-examples.md`.
4. `## Resend (Pending)` — clarify D-25 feature flag state, one-line flip recipe when domain bought (Phase 6/7).
5. `## Env Var Inventory` — table of all env vars across Phase 1 + Phase 2 (8 new + 6 existing = 14 total).

Pattern: every section uses the same `- **Item:** value` bullet style as Phase 1.

---

## Shared Patterns

### Shared Pattern S1 — Anti-enumeration uniform return

**Source:** `nakama/src/rpc/request_password_reset.ts:37, 43, 49` (Phase 1 stub).

**Apply to:** `rpc/request_password_reset.ts` (Phase 2 real impl). Do NOT apply to `confirm_password_reset` — that one returns structured `{ok:false, error:"token_..."}` per T-2-PWR.

```typescript
// Same uniform response — we don't tell the client whether the address shape was wrong.
return JSON.stringify({ ok: true });
```

### Shared Pattern S2 — Storage list cap at 50 iterations × 100 records

**Source:** `nakama/src/rpc/get_clubs.ts:51` AND `nakama/src/main.ts:65` AND `nakama/src/rpc/confirm_password_reset.ts` (RESEARCH.md lines 1308-1322).

**Apply to:** `scheduler/windows.ts evaluateWindowTransitions`, `rpc/admin_list_windows`, `rpc/confirm_password_reset` (token scan), `rpc/get_current_window` (window lookup), `integrations/api_football.ts` if it ever lists fixtures.

```typescript
let cursor = '';
for (let i = 0; i < 50; i++) {
  const page = nk.storageList(USER_OR_SYSTEM, COLLECTION, 100, cursor);
  // ... process page.objects ...
  if (!page.cursor) break;
  cursor = page.cursor;
}
```

5000-record cap is conservative for Phase 2 (max ~700 fixtures Primera+Nacional over a season + 10–50 reset tokens).

### Shared Pattern S3 — Storage permissions

**Source:** `nakama/src/rpc/create_pibe.ts:106-107` (per-user) + `nakama/src/main.ts:89-90` (system).

Three levels:

| Owner type | `permissionRead` | `permissionWrite` | Examples |
|------------|------------------|-------------------|----------|
| System-owned, public-read | 2 | 0 | `clubs`, `fixtures`, `match_windows` |
| User-owned, owner-read | 1 | 0 | `pibes/main`, `fcm_tokens/<userId>` |
| User-owned, server-only | 0 | 0 | `players/profile` (public via lookups; verify), `reset_tokens/reset` |
| System-owned, server-only | 0 | 0 | `meta/*`, `admin_actions/<uuid>`, `match_windows` notification markers |

**Phase 2 specifics:**
- `COL_FIXTURES`: `permissionRead: 2, permissionWrite: 0` — public so admin tooling can introspect via Nakama Console.
- `COL_MATCH_WINDOWS`: `permissionRead: 2, permissionWrite: 0` — public; client calls `get_current_window` but Console debugging also reads directly.
- `COL_FCM_TOKENS`: `permissionRead: 0, permissionWrite: 0` — server-only (sensitive token).
- `COL_ADMIN_ACTIONS`: `permissionRead: 0, permissionWrite: 0` — audit, server-only.
- `COL_META` keys (`tick_lock`, `scheduler_state`, `current_season`, `api_football_league_ids`, `fcm_oauth_token`): `permissionRead: 0, permissionWrite: 0`.

### Shared Pattern S4 — `logger.info(...)` with `%s/%d` placeholders

**Source:** `nakama/src/main.ts:105` + `nakama/src/rpc/create_pibe.ts:124` + `nakama/src/rpc/delete_account.ts:34`.

**Apply to:** every Phase 2 RPC + scheduler tick + integration. **Tokens, passwords, FCM device tokens MUST NEVER be logged** (T-1-RT-08 precedent in `request_password_reset.ts:7` comment).

```typescript
logger.info('create_pibe: user=%s pibe=%s club=%s', userId, pibeId, clubId);
logger.warn('delete_account: storageDelete partial failure user=%s err=%s', userId, String(e));
```

Phase 2 log prefix convention from RESEARCH.md: `[tick]`, `[api-football]`, `[fcm]`, `[admin]`, `[reset]`, `[window]`. Bracketed prefix → space → key=value pairs.

### Shared Pattern S5 — Idempotency marker via storage seed key

**Source:** `nakama/src/main.ts:21, 35, 42-44, 95-104` (`CLUBS_SEED_VERSION` + `clubs_seeded_<version>` marker).

**Apply to:** `scheduler/leaderboard_cron.ts:ensureSchedulerLeaderboards` (idempotent `leaderboardCreate` via try/catch), `season_state` first-write detection, FCM OAuth token cache expiry check.

```typescript
const seedKey = 'clubs_seeded_' + CLUBS_SEED_VERSION;
const existing = nk.storageRead([{ collection: COL_META, key: seedKey, userId: SYSTEM_USER_ID }]);
if (existing.length > 0) {
  logger.info('Clubs already seeded (version=%s), skipping', CLUBS_SEED_VERSION);
  return;
}
// ... do work ...
nk.storageWrite([{ collection: COL_META, key: seedKey, ..., value: { seeded: true, at: Date.now() } }]);
```

### Shared Pattern S6 — Defensive JSON parse on client

**Source:** `scripts/autoloads/PlayerStore.gd:44-51` (WR-09 fix — `typeof()` check after `JSON.parse_string`).

**Apply to:** `HomeScreen.gd` when reading `get_current_window` response, any new client code parsing RPC payloads.

```gdscript
var profile_raw = JSON.parse_string(resp.objects[0].value)
if typeof(profile_raw) != TYPE_DICTIONARY:
    return {"ok": false, "error": "profile_corrupt"}
var profile: Dictionary = profile_raw
```

### Shared Pattern S7 — Async RPC wrapper return shape on client

**Source:** `scripts/autoloads/AuthManager.gd:61-66` (`request_password_reset`).

**Apply to:** every new `NakamaService.gd` method (`register_fcm_token`, `get_current_window`, etc.).

```gdscript
func xxx(...) -> Dictionary:
    var payload = JSON.stringify({...})
    var resp = await NakamaService.client.rpc_async(session, "xxx", payload)
    if resp.is_exception():
        return {"ok": false, "error": str(resp.get_exception().message)}
    var data = JSON.parse_string(resp.payload)
    return {"ok": true, "data": data}
```

---

## No Analog Found (Phase 2 first-mover)

| File | Role | Data Flow | Why No Analog |
|------|------|-----------|---------------|
| `nakama/src/scheduler/tick.ts` | scheduler entry | event-driven (leaderboard reset) | No scheduler in Phase 1. Source: RESEARCH.md §"Code Patterns" 1, copy verbatim. |
| `nakama/src/scheduler/leaderboard_cron.ts` | scheduler registrar | event-driven (Init hook) | No `registerLeaderboardReset` in Phase 1. Source: RESEARCH.md §"Code Patterns" 1, lines 795-813. |
| `nakama/src/integrations/api_football.ts` | integration | HTTP fetch + cache | No outbound HTTP in Phase 1 (Resend was stubbed). Source: RESEARCH.md §"Code Patterns" 2, lines 818-948. |
| `nakama/src/integrations/fcm.ts` | integration | HTTP push + JWT | No JWT generation in Phase 1. Source: RESEARCH.md §"Code Patterns" 3, lines 951-1067 — note `base64ToUtf8` Goja-specific helper lines 1060-1067. |
| `android/plugins/FCMPlugin/` | native plugin | OS callback | First Android native code in repo. **HIGH research-required.** Source: Godot 4.3 Android plugin docs + Firebase SDK + RESEARCH.md Q4 + S-17. |

---

## Cross-File Wiring Map (for planner's task-graph drafting)

```
Boot:
  main.ts InitModule
    ├─ seedClubs (existing)
    ├─ ensureSchedulerLeaderboards (NEW) ─→ leaderboard_cron.ts
    ├─ registerLeaderboardReset → runHeartbeatTick (NEW) ─→ scheduler/tick.ts
    └─ registerRpc × 13

Every 15min/6h tick (scheduler/tick.ts):
  acquire tick lock (COL_META.tick_lock)
  pollFixtures ─→ integrations/api_football.ts ─→ nk.httpRequest
  evaluateWindowTransitions ─→ scheduler/windows.ts
    on scheduled→open transition:
      sendTopic ─→ integrations/fcm.ts ─→ nk.jwtGenerate + nk.httpRequest
  detectSeasonState ─→ scheduler/seasons.ts
  release tick lock

Client login flow (G3 + G4 + G5):
  AuthManager.login → AuthManager.session_ready
  PlayerStore.load_from_server (existing)
  NakamaService.register_fcm_token (NEW; passes platform="android")
    → RPC register_fcm_token (NEW; writes COL_FCM_TOKENS + subscribes via FCM Instance ID API)

Client home flow (H):
  HomeScreen._ready
    → NakamaService.get_current_window (NEW)
      → RPC get_current_window (NEW; reads players/profile + match_windows)
    → _update_window_banner (NEW)

Admin flow (curl + Group D):
  curl → /v2/rpc/admin_X?unwrap (Authorization: Bearer $ADMIN_BEARER)
    → util/admin_auth.ts requireAdmin (validate + constant-time compare)
    → mutate target collection
    → audit row in COL_ADMIN_ACTIONS

Reset flow (replaces Phase 1 stubs):
  client → AuthManager.request_password_reset (existing wrapper)
    → RPC request_password_reset (Phase 2 REAL)
      → token gen → storageWrite COL_RESET_TOKENS
      → if RESEND_ENABLED: integrations/resend.ts (NEW; extracted from util/email.ts)
      → else: log link, return ok:true
  user clicks link in web/reset-password/index.html (existing, becomes functional)
    → RPC confirm_password_reset (Phase 2 REAL)
      → scan COL_RESET_TOKENS → linkEmail → mark consumed
```

---

## Metadata

**Analog search scope:** `nakama/src/**/*.ts`, `scripts/autoloads/*.gd`, `scripts/screens/*.gd`, `scenes/*.tscn`, `nakama/*.{sh,mjs,yml,json}`, `Dockerfile.nakama`, `.planning/phases/01-foundation/INFRA-NOTES.md`.
**Files scanned:** 9 server TS + 7 autoloads + 7 screens + 8 scenes + 5 build/config + 1 Phase 1 INFRA doc = **37 files**.
**Pattern extraction date:** 2026-05-17.
**Reference excerpts in:** all line ranges cited above are from current `main` (`d2c4583`).
