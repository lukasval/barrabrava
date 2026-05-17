# Phase 2: Heartbeat AFA — Research

**Researched:** 2026-05-17
**Domain:** Nakama TypeScript runtime scheduling + external API integration (API-Football, FCM v1, Resend) + Godot 4.3 push notifications
**Confidence:** HIGH (Nakama APIs + Resend), MEDIUM (FCM v1 wiring + API-Football league IDs), LOW (Godot FCM plugin maturity for 4.3)

---

## Summary

Phase 2 wires "the heartbeat" — a poll loop inside Nakama that ingests AFA fixtures, materializes match windows, and broadcasts an FCM push when a window opens. Five critical facts shape the plan:

1. **Nakama TypeScript runtime has NO `timerCreate`, `setTimeout`, or any scheduler API.** D-01's "`nk.timerCreate` or equivalent" must be replaced with the documented community pattern: **piggyback on `registerLeaderboardReset`** using a dummy leaderboard whose cron reset acts as the tick. (Heroic Labs issue #581 acknowledges this gap; using leaderboard resets is the explicit unofficial workaround.) `[VERIFIED: index.d.ts grep + forum + issue #581]`
2. **`nk.httpRequest` is synchronous and blocks the Goja VM thread.** Goja is ES5 — no `async/await`, no Promises returned from RPCs. Every outbound call (API-Football, FCM, Resend) consumes one VM slot for its full duration. The timer tick must keep work bounded (timeouts + early-exit). `[VERIFIED: index.d.ts + heroic forum]`
3. **`nk.jwtGenerate('RS256', signingKey, claims)` exists in Nakama TS runtime.** This unlocks the Google OAuth2 service-account flow needed for FCM v1 (and the Instance ID `batchAdd` topic management API, now also OAuth2-only since 2024-06-21). No external JWT library needed. `[VERIFIED: index.d.ts:3583]`
4. **`nk.accountUpdateId` does NOT mutate password.** The right primitive is **`nk.linkEmail(userId, email, password)`** — which silently overwrites existing email credentials. Combined with `nk.sqlQuery` to look up userId by email (no built-in `usersGetEmail`), this completes the password-reset flow that the Phase 1 stub left open. `[VERIFIED: index.d.ts:3850, 3968 + heroic issue #275]`
5. **D-02's two-cadence scheduler maps cleanly onto leaderboard resets:** keep a 15-minute reset leaderboard AND a 6-hour reset leaderboard, with each tick checking `meta:scheduler_lock` to ensure only one cadence is "active". Simpler than self-rescheduling and survives Nakama restarts (cron schedule is persisted in PG). `[ASSUMED, planner to validate]`

**Primary recommendation:** Replace D-01's "in-process timer" with two `registerLeaderboardReset` hooks (15 min + 6 h cron), gated by a `meta:scheduler_state` flag that the tick itself toggles based on fixture proximity. Implement OAuth2 + FCM v1 send directly via `nk.httpRequest` + `nk.jwtGenerate`. Defer Godot FCM plugin choice to Wave 3 of execution — the server-side push send works regardless of which client plugin lands.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope (D-domain):**
- Phase 2 covers: API-Football integration (free tier 100 req/day), Nakama scheduler with 15 min / 6 h cadences, Storage collections `fixtures` + `match_windows` + `fcm_tokens` + `reset_tokens` + reused `meta:season_state`, FCM v1 topic broadcast on window open, season detection auto+admin, admin RPCs via curl with bearer token, Resend token machinery (token gen + persist + expire + consume) behind `RESEND_ENABLED=false`.
- Out of Phase 2: lower-division scraping (B Metro/Federal A/C Metro → v1.1), per-user push (Phase 4+), daily reset push (Phase 3), quiet hours (v1.1), web admin UI (Phase 5+), domain registration + Resend live (Phase 6/7), API-Football paid tier (Phase 6).

**Scheduler & Cron Architecture:**
- **D-01:** Scheduler runs **in-process inside Nakama TS runtime** using `nk.timerCreate` or equivalent registered in `InitModule`. Zero external services. **[Research finding: `nk.timerCreate` does NOT exist — see §"Technical Decisions Q1" for the substitute pattern.]**
- **D-02:** Two cadences driven by a single tick: 15 min when any fixture is in `[now, now+24h]`, 6 h otherwise. Tick self-reschedules based on the proximity check.
- **D-03:** Transient API-Football errors (timeout / 5xx / 429) are logged, never reach the client, latest valid cache serves until next poll. >6h stale cache without successful update = WARNING log (no external alerting in Phase 2).
- **D-04:** Each poll fetches only `[now-1d, now+14d]` fixtures. Persisted per-fixture in `fixtures` collection, value = normalized JSON.

**Match Window State Machine:**
- **D-05..D-08:** Window state in `match_windows`, key = `{fixture_id}`, states `scheduled → open → live → closed` (or `cancelled`). Materialized when `kickoff < now+48h`. Idempotent on `fixture_id`. Kickoff postpone before `open` = shift timestamps; after `open` requires admin RPC.

**Push Notifications (FCM v1):**
- **D-09:** Topics primary. `club_{club_id}` per club. Single push at `scheduled → open` transition.
- **D-10:** Token-per-user infra prepared (`fcm_tokens` collection) but not fired in Phase 2.
- **D-11:** Server subscribes device tokens to topics via FCM REST API. Idempotent.
- **D-12:** Anti-spam via `notified_open_at` marker — one push per window-open transition.
- **D-13:** Push payload (Spanish argentino, lunfardo): `title: "¡Ventana abierta!"`, `body: "Tu club juega ahora. Mové el orto al aguantadero."`, `data: { type: "window_open", fixture_id, club_id, kickoff_utc, closes_at }`.
- **D-14:** No quiet hours in Phase 2.
- **D-15:** Argentina only (`America/Argentina/Buenos_Aires`), UTC stored, AR displayed.

**Season Detection:**
- **D-16:** Hybrid — `season` field from API-Football + admin override. State in `meta:current_season`.
- **D-17:** Auto-start when first fixture enters `<7d`; auto-end 7 d after last detected fixture.
- **D-18:** `admin_set_season_window` RPC for manual override.
- **D-19:** ONE active season globally (Primera). Nacional parallel but no distinct gameplay yet.

**Admin Override Plane:**
- **D-20:** Admin auth = bearer token in env var `ADMIN_BEARER`. RPCs validate `Authorization: Bearer <token>` header.
- **D-21:** Admin RPCs: `admin_postpone_fixture(fixture_id, new_kickoff_utc, cancel?)`, `admin_close_window(fixture_id)`, `admin_set_season_window(division, season_id, started_at, ends_at, status)`, `admin_force_repoll()`, `admin_list_windows(state?)`.
- **D-22:** Every admin mutation logged to `admin_actions` collection (audit trail).
- **D-23:** No web UI in Phase 2 — curl only.

**Resend Wiring:**
- **D-24:** Internal logic active: token gen (`nk.uuidv4()`), persist `reset_tokens` collection (`userId → {token, expires_at, consumed_at?}`, TTL 1 h), validation at confirm, atomic consume. `confirm_password_reset` becomes real (validates + mutates password).
- **D-25:** Resend HTTP call gated by `RESEND_ENABLED` env var. Default `false` (Phase 2): RPC still returns `{ok: true}`, dev gets reset link in server logs. `true` (Phase 6/7 after dominio): same code calls Resend HTTP.
- **D-26:** Email template: HTML inline TS source, español, header lunfardo "Recuperá tu contraseña — Liga Aguante", link = `PASSWORD_RESET_BASE_URL + "?token=" + token`.
- **D-27:** Token GC = passive (checked at confirm). No GC job in Phase 2.

### Claude's Discretion
- Exact normalized fixture schema (which API-Football fields survive vs. drop).
- Retry/backoff strategy for API-Football (suggested: 3 retries exponential, then cache fallback).
- Logging via `logger.info/warn/error` (Phase 1 pattern). No Prometheus in Phase 2.
- Internal timer structure (single self-rescheduling vs. multiple) — *constrained by §"Technical Decisions Q1" finding*.
- Bearer token format (UUIDv4 stored in Railway env var = default).
- FCM service-account JSON loading: env var with JSON inline base64 (`FCM_SERVICE_ACCOUNT_B64`).
- Race between concurrent polls: `meta:poll_lock` with expiry, or single-instance assumption (Railway free = 1 instance, see §Pitfall S-2).

### Deferred Ideas (OUT OF SCOPE)
- Scraping AFA / fixtures B Metro / Federal A / C Metro → v1.1.
- Custom domain registration → Phase 6/7 prelaunch.
- Resend live wiring + domain verified → Phase 6/7.
- API-Football paid tier subscription → Phase 6 prelaunch.
- Quiet hours / per-user notification preferences → v1.1.
- Per-user push notifications (te atacaron, pibe preso, raid finished) → Phase 4.
- Daily reset push (DAY-03 subset) → Phase 3.
- Heat / cana event push → Phase 4.
- Web admin UI dedicated → Phase 5+.
- Token GC dedicated for `reset_tokens` → Phase 6+ (Phase 2 = passive GC).
- Métricas Prometheus / structured observability → Phase 7.
- Season modifiers visibles al player → Phase 6.
- Multi-timezone / fans fuera de Argentina → post-MVP.
- Personalización de push copy por matchup → v1.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CLB-03** | Fixture feed via API-Football (Primera + Nacional) | §"API-Football v3" + §"Code Patterns: API-Football fetch". Free tier 100 req/day → 15-min cadence on match days = ~96 calls/day, just under cap. |
| **CLB-04** | Admin panel for manual fixture override | §"Code Patterns: Admin bearer middleware" + D-20..D-22 admin RPC list. |
| **CLB-05** | Cache TTL 30 min + fallback to last cache | §"Idempotent fixture upsert" pattern + §"Pitfalls: API-Football quota exhaustion". |
| **SEA-01** | Season = real AFA tournament duration | §"Season detection" — read `season` field + first-fixture trigger. |
| **SEA-02** | Season starts/ends with real tournament | §"Code Patterns: season auto-trigger" + `admin_set_season_window` override. |
| **CMB-01** | Combat windows synced to fixture (2h pre, 2h post) | §"Match window state machine" — `opens_at = kickoff - 2h`, `closes_at = kickoff + 2h`. |
| **DAY-03** | Push notifications (Phase 2 scope = window-open only) | §"FCM v1 send-to-topic" — broadcast to `club_{club_id}` on `scheduled → open` transition. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Implication for Phase 2 |
|-----------|------------------------|
| **Server-authoritative for everything that matters** (TEC-09) | Window state lives server-side; client only reads via RPC. Match windows never derived from client-reported time. |
| **Cosmetic-only monetization** | Not relevant Phase 2. |
| **No free-text chat ever** | Push payload is server-defined; no user-generated content. |
| **Solo dev, budget ~$40/mo total** | Free tiers only: API-Football free (100 req/day), Resend free (3K/mo, 100/day), Railway $20-40/mo. FCM unlimited free. |
| **Caricaturesco, fantasy-coded, never glorify barra violence** | Push copy must stay caricaturesque ("Mové el orto al aguantadero" = playful lunfardo, not menace). D-13 already locked correct tone. |
| **Lunfardo / jerga argentina** | All user-facing strings (push, email template) in español argentino. Technical strings (log lines, errors) in English. |
| **Apolítico** | N/A Phase 2. |
| **Sin nombres reales de líderes barra** | N/A Phase 2 (Phase 1 already enforced via `validation.ts` deny list). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Poll AFA fixtures every 15 min/6 h | Nakama TS runtime (server) | — | Anti-cheat: client cannot derive windows from real data. Server cache is single source of truth. |
| Compute `opens_at`, `closes_at`, current state | Nakama TS runtime (server) | — | TEC-09 server-authoritative; client never times window. |
| Send FCM topic broadcast on window open | Nakama TS runtime (server) | FCM v1 (external) | Server holds OAuth2 service-account key. Client must NEVER send FCM. |
| Subscribe device to club topic | Nakama TS runtime (server) | FCM Instance ID API (external) | OAuth2 service-account key on server; client only forwards its device token via RPC. |
| Get FCM device token from OS | Godot client | OS (Android/iOS) | Only the device runtime can mint a registration token. |
| Display current/upcoming window to player | Godot client | Nakama RPC `get_current_window` | Pure display tier; reads server truth. |
| Admin: postpone / close / set season / repoll | Nakama TS runtime (server) | — | Bearer-token gated; never client-callable in player path. |
| Generate + persist + consume reset token | Nakama TS runtime (server) | — | Token never leaves server except via Resend email. |
| Send password reset email | Nakama TS runtime (server) | Resend API (external) | Server holds Resend API key + email template. Gated by `RESEND_ENABLED`. |
| Audit log every admin action | Nakama TS runtime (server) | — | Storage collection `admin_actions`, write-once. |

---

## Technical Decisions (answers to 13 critical research questions)

### Q1: Nakama 3.21 TS runtime — what scheduler API exists?

**`[VERIFIED: nakama-runtime/index.d.ts + Heroic Labs forum + GitHub issue #581]`**

**Finding:** `nk.timerCreate` does **NOT exist** in the Nakama TypeScript runtime. Goja is ES5 sandboxed (no `setTimeout`, no `setInterval`, no spawning OS threads). The TS runtime is fundamentally request-response — Heroic Labs explicitly recommends Just-In-Time hooks instead of background jobs.

**Available primitives:**
- `initializer.registerLeaderboardReset(fn)` — runs after a leaderboard's cron-scheduled reset.
- `initializer.registerTournamentReset(fn)` / `registerTournamentEnd(fn)` — similar for tournaments.
- `nk.cronNext(cron, ts)` / `nk.cronPrev(cron, ts)` — pure cron-math helpers.
- `nk.leaderboardCreate(id, authoritative, sortOrder, operator, resetSchedule?, metadata?)` — `resetSchedule` is a cron string.

**Recommended pattern (community workaround, used by Nakama users since issue #581):**

```typescript
// In InitModule, ensure two dummy leaderboards exist:
//   bb_tick_15m  → cron "*/15 * * * *"  (every 15 min)
//   bb_tick_6h   → cron "0 */6 * * *"   (every 6 h)
// Then register reset hooks that BOTH route to one tick function.

nk.leaderboardCreate('bb_tick_15m', true, /*sortOrder*/ 0, /*operator*/ 0,
                     '*/15 * * * *', { purpose: 'scheduler_tick' });
nk.leaderboardCreate('bb_tick_6h',  true, /*sortOrder*/ 0, /*operator*/ 0,
                     '0 */6 * * *',  { purpose: 'scheduler_tick' });

initializer.registerLeaderboardReset(function(ctx, logger, nk, lb, resetTs) {
  if (lb.id !== 'bb_tick_15m' && lb.id !== 'bb_tick_6h') return; // ignore others
  runHeartbeatTick(ctx, logger, nk, lb.id);
});
```

**Why this works:**
- Leaderboard reset schedules are stored in Postgres, so they survive Nakama restarts. No re-registration needed in `InitModule` beyond `leaderboardCreate` (which is idempotent — second call with same ID is no-op).
- The reset hook fires in-process inside the same Goja runtime, so `nk.httpRequest` and `nk.storageRead` work normally.
- Two leaderboards run in parallel — but the tick function uses a `meta:scheduler_state` flag to decide whether to do "real" work this tick (see §"Code Patterns: scheduler tick" below). One cron does the math, both fire on their own schedule.

**Alternative — single fast tick + internal gating:** Keep only `bb_tick_15m` running every 15 min; on every tick, check `last_poll_at` and skip if not yet 6 h elapsed for the "slow path". Simpler but wastes 75% of ticks. **Recommended for Phase 2** because of free-tier API-Football quota: 96 ticks/day × 1 fetch = 96 calls (under 100/day cap), and skip-quickly is much cheaper than coordinating two leaderboards. The planner should pick one — both work.

**Survives restart:** Yes. Leaderboard records are in Postgres; cron next-fire is server-computed.

**Multi-instance Nakama:** Phase 2 = single Railway instance. **If/when scaled (Phase 6/7+) the reset hook fires on ONE instance only** — Nakama coordinates this internally for `authoritative: true` leaderboards. Document this for future scaling but Phase 2 ignores it.

**Citation:** [`registerLeaderboardReset` line 2379 in nakama-runtime/index.d.ts; `leaderboardCreate` line 4511; Heroic Labs issue #581 (cron scheduler feature request); Heroic Labs Background Jobs guide](https://heroiclabs.com/docs/nakama/guides/server-framework/background-jobs/).

---

### Q2: API-Football endpoints + auth

**`[VERIFIED: api-sports.io documentation references via WebSearch — base URL, header, rate limit headers]`**

**Base URL:** `https://v3.football.api-sports.io` (direct subscription) or `https://api-football-v1.p.rapidapi.com/v3` (RapidAPI route — needs different headers).

**Recommended:** Subscribe directly at api-sports.io, NOT through RapidAPI. Reasons:
- Single header (`x-apisports-key`) vs. two (`x-rapidapi-key` + `x-rapidapi-host`).
- Same free tier (100 req/day) but lower latency (no RapidAPI proxy hop).
- Direct billing if upgrading later (Phase 6).

**Auth header (direct):** `x-apisports-key: <your-api-key>` `[CITED: api-sports.io documentation references]`

**Fixtures endpoint:** `GET /fixtures`

**Parameters useful for Phase 2:**
- `league=<id>` — Argentine Primera = `[VERIFY exact ID — see Q6]`
- `season=<YYYY>` — e.g., `2026` for 2026 season
- `from=<YYYY-MM-DD>` & `to=<YYYY-MM-DD>` — date range filter (recommended Phase 2)
- `date=<YYYY-MM-DD>` — single day
- `timezone=America/Argentina/Buenos_Aires` — coerces output to AR local; **server still receives UTC in `fixture.timestamp`**
- `status=<NS|1H|HT|2H|FT|PST|CANC|...>` — filter by status (skip in Phase 2; fetch all)

**Response shape (per fixture):**
```json
{
  "fixture": {
    "id": 123456,
    "date": "2026-03-15T22:00:00-03:00",
    "timestamp": 1740000000,
    "timezone": "America/Argentina/Buenos_Aires",
    "status": { "long": "Not Started", "short": "NS", "elapsed": null }
  },
  "league": { "id": 128, "name": "Liga Profesional Argentina", "season": 2026, "round": "Apertura - 5" },
  "teams": {
    "home": { "id": 451, "name": "...", "logo": "..." },
    "away": { "id": 452, "name": "...", "logo": "..." }
  },
  "goals": { "home": null, "away": null },
  "score": { ... }
}
```

`status.short` enum: `NS` (Not Started), `1H/HT/2H/ET/P` (in progress), `FT` (Final), `PST` (Postponed), `CANC` (Cancelled), `SUSP` (Suspended), `AWD` (Awarded), `WO` (WalkOver). **Postponed/cancelled markers Phase 2 must respect: `PST` and `CANC`.** `[VERIFIED]`

**Free tier limits:** 100 requests/day total. Resets daily at **00:00 UTC** (not local time). `x-ratelimit-requests-remaining` header on every response shows count left. `[VERIFIED: api-football.com/news/post/how-ratelimit-works]`

**Rate-limit response:** HTTP 429 with empty body / standard text. Plan for it (log + back off until reset). Logos/images do NOT count toward quota.

**Source:**
- [API-Sports Football v3 docs](https://api-sports.io/documentation/football/v3) `[VERIFY direct read blocked by 403 — confirmed via WebSearch summaries]`
- [How rate limit works](https://www.api-football.com/news/post/how-ratelimit-works) `[VERIFY direct read blocked 403 — confirmed via WebSearch summaries]`
- [HOW TO GET ALL FIXTURES DATA FROM ONE LEAGUE](https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league)

---

### Q3: FCM v1 API for Nakama

**`[VERIFIED: Firebase docs + index.d.ts confirms jwtGenerate RS256]`**

**Send endpoint:** `POST https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send`

**Auth:** `Authorization: Bearer <OAuth2_access_token>` — short-lived (1 h) token obtained from Google OAuth2 token endpoint via service-account JWT assertion. `[CITED: firebase.google.com/codelabs/use-the-fcm-http-v1-api-with-oauth-2-access-tokens]`

**OAuth2 token-exchange flow (server-to-server):**

1. Build JWT with claims:
   ```
   {
     iss: <service_account_email>,
     scope: "https://www.googleapis.com/auth/firebase.messaging",
     aud: "https://oauth2.googleapis.com/token",
     iat: <now_seconds>,
     exp: <now_seconds + 3600>
   }
   ```
2. Sign with service-account private key using **RS256** → `signed_jwt`. **Nakama has `nk.jwtGenerate('RS256', privateKeyPem, claims)` natively.** `[VERIFIED: index.d.ts:3583]`
3. POST to `https://oauth2.googleapis.com/token` with body `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<signed_jwt>` (form-encoded).
4. Response JSON contains `access_token` (string) + `expires_in` (3600). Cache in `meta:fcm_oauth_token` with `expires_at = now + 3500` (60 s safety margin).

**Topic send body:**
```json
{
  "message": {
    "topic": "club_42",
    "notification": {
      "title": "¡Ventana abierta!",
      "body": "Tu club juega ahora. Mové el orto al aguantadero."
    },
    "data": {
      "type": "window_open",
      "fixture_id": "123456",
      "club_id": "42",
      "kickoff_utc": "2026-03-15T22:00:00Z",
      "closes_at": "2026-03-16T00:00:00Z"
    },
    "android": { "priority": "high", "ttl": "7200s" },
    "apns": { "headers": { "apns-priority": "10", "apns-expiration": "<unix_ts>" } }
  }
}
```

`[CITED: firebase.google.com/docs/cloud-messaging/send/v1-api]`

**Topic name format in HTTP v1:** Bare name in `message.topic` (NOT `/topics/club_42`). The `/topics/` prefix is for legacy API only. `[VERIFIED: search results — Firebase v1 docs use "topic": "news" bare]`

**Topic name validation:** Must match regex `[a-zA-Z0-9-_.~%]+` — letters, digits, hyphens, underscores, dots, tildes, percent signs. **No spaces.** `club_42`, `club_boca-juniors`, `club_42.primera` all valid. `[VERIFIED: Firebase forum docs]`

**Topic name max length:** Not officially documented but widely-tested apps use 50-100 chars without issue. `club_{club_id}` where `club_id` is a UUID = ~41 chars total. Safe.

**Topics auto-create:** Yes — on first subscribe, the topic is created server-side. No "create topic" call needed. `[CITED: firebase.google.com/docs/cloud-messaging/manage-topics]`

**Topic subscription (server-side):** Endpoint `https://iid.googleapis.com/iid/v1:batchAdd` and `:batchRemove`. **The Instance ID legacy service is deprecated** but the endpoint still works **using OAuth2 access tokens** (same scope as send). Static server-key auth was disabled 2024-06-21. `[CITED: deprecated-but-functional, Google groups + Heroic Labs context]`

**Request body for batchAdd:**
```json
{
  "to": "/topics/club_42",
  "registration_tokens": ["<device_token_1>", "<device_token_2>"]
}
```
Note `to` field DOES use `/topics/` prefix here (legacy API). Up to 1000 tokens per call. `[CITED: developers.google.com/instance-id/reference/server]`

**Phase 2 simplification — client-side subscribe instead of server-side:**
- Godot FCM plugin exposes `subscribeToTopic(name)` natively.
- Client subscribes to `club_{club_id}` after club pick. Idempotent.
- Server NEVER calls Instance ID API in Phase 2.
- Token-per-user storage (`fcm_tokens` collection) is still written for Phase 4+ targeted pushes — but Phase 2 doesn't read it.
- **Big win:** removes 2nd OAuth2 user (still need it for send) — actually nope, still need OAuth2 for send-to-topic. But removes one source of complexity: no batchAdd flow.

**Recommendation:** Use client-side subscribe in Phase 2. Server-side batchAdd deferred to Phase 4 when per-user FCM kicks in.

**Sources:**
- [FCM HTTP v1 API codelab](https://firebase.google.com/codelabs/use-the-fcm-http-v1-api-with-oauth-2-access-tokens)
- [Send messages using FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- [Topic management](https://firebase.google.com/docs/cloud-messaging/manage-topics)
- [Authenticating FCM v1 (Medium)](https://medium.com/@ThatJenPerson/authenticating-firebase-cloud-messaging-http-v1-api-requests-e9af3e0827b8)
- [Instance ID batchImport deprecated (Google Groups)](https://groups.google.com/g/firebase-talk/c/GzvORYMk6sE)

---

### Q4: Godot 4.3 FCM integration

**`[VERIFIED: GitHub searches across known plugins]`**

**State of the art (May 2026):**

| Plugin | Min Godot | Maintained? | FCM support | Notes |
|--------|-----------|-------------|-------------|-------|
| **Godotx Firebase** (godot-x/firebase) | 4.6 | Yes — v2.4.1 dated 2026-03-13 | Full (topic + token + receive) | **Does NOT support Godot 4.3** |
| **godot-firebase-ios** (Somni Game Studios) | 4.x (iOS only) | Recent | iOS only, GDExtension SwiftGodot | Companion to godot-firebase-android |
| **DrMoriarty/godot-firebase-cloudmessaging** | 3.x | Stale (v0.2.1, 2021-07) | Basic | **Unmaintained, likely won't work on 4.3** |
| **funseek/godot-ios-firebase-message** | 4.x | Sparse | iOS only | Niche |
| **godot-local-notification** (kyoz, DrMoriarty) | 3 & 4 | Active | Local notifications only — NOT FCM | Useful for local schedules but doesn't receive FCM push |

**Conclusion:** No turnkey FCM plugin exists for Godot 4.3. Three viable paths for the planner:

**Path A — Custom GDExtension (recommended, ~2-3 days):**
- Write thin Android plugin (Java/Kotlin) wrapping `FirebaseMessaging.getInstance()` + `subscribeToTopic()` + `onMessageReceived()`.
- iOS: similar Swift/ObjC wrapper around `Messaging.messaging()`.
- Both expose `get_token() -> String`, `subscribe_to_topic(name)`, `unsubscribe_from_topic(name)`, signal `message_received(data)` and `token_refreshed(token)`.
- Phase 2 ships Android-only (consistent with Phase 1's deferred-iOS-CI pattern); iOS plugin lands Phase 7 along with iOS CI.

**Path B — Upgrade to Godot 4.6** (then use Godotx Firebase plugin):
- Godot 4.6 just released; Phase 1 stack is 4.3. Major version bump = re-test all 7 onboarding screens + addons compatibility. **Reject — risk > reward Phase 2.**

**Path C — Defer FCM client-side entirely to Phase 4:**
- Phase 2 ships server-side FCM send + Storage collection `fcm_tokens` (empty in Phase 2).
- Client cannot subscribe in Phase 2 → push doesn't actually deliver until Phase 4.
- Pro: zero plugin work Phase 2. Con: violates D-09 ("push when ventana abre" is a Phase 2 success criterion).
- **Conditional recommendation:** If Path A blocks (Android signing certs, FCM project setup), fall back to Path C with documented decision.

**Recommended:** **Path A** — write minimal Android plugin in Phase 2. Wave structure:
- Wave 1 Plan: Set up Firebase project + Android google-services.json + add deps to Godot Android export.
- Wave 2 Plan: Java module `GodotFcmPlugin.java` extending `GodotPlugin`, exposes 3 methods + 2 signals.
- Wave 3 Plan: Godot-side `FcmService.gd` autoload wrapping the singleton.

**Android Manifest permissions needed:**
- `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />` (Android 13+ runtime).
- `<uses-permission android:name="android.permission.INTERNET" />` (already present from Nakama).
- `<service ... FirebaseMessagingService>` declared.

**Android 13+ runtime permission:** Request via `request_post_notifications_permission()` at first launch or after club pick (UX choice — soft after-pick is friendlier per Argentine market notes; aggressive on-splash kills onboarding). `[CITED: developer.android.com/develop/ui/views/notifications/notification-permission]`

**iOS permission:** `UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])` — requires `NSUserNotificationsUsageDescription` in Info.plist with clear Spanish justification.

**Sources:**
- [Godotx Firebase GitHub](https://github.com/godot-x/firebase)
- [DrMoriarty's FCM plugin (stale)](https://github.com/DrMoriarty/godot-firebase-cloudmessaging)
- [Android POST_NOTIFICATIONS permission](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [godot-local-notification (related)](https://github.com/kyoz/godot-local-notification)

---

### Q5: Nakama `nk.httpRequest` capabilities

**`[VERIFIED: index.d.ts:3517 + Heroic Labs forum]`**

**Signature:**
```typescript
httpRequest(
  url: string,
  method: RequestMethod,           // "get" | "post" | "put" | "patch" | "head" | "delete"
  headers?: {[h: string]: string},
  body?: string,
  timeout?: number,                // milliseconds, default 5000
  insecure?: boolean               // skip TLS validation, default false
): HttpResponse
```

`HttpResponse` shape: `{ code: number, headers: {[h]: string}, body: string }`.

**Critical constraints:**

| Property | Value | Implication |
|----------|-------|-------------|
| Sync / async | **Synchronous (blocking)** | Tick function blocks the Goja VM thread for full duration. |
| Default timeout | 5000 ms | Override explicitly for Resend (5s ok) and FCM (8s safer); API-Football can stick to 5s. |
| Body encoding | Plain string — caller serializes JSON | Use `JSON.stringify(...)` before passing. |
| TLS verification | On by default | Keep default. Never set `insecure: true` for production. |
| Max payload | Not documented officially, ~5-10 MB practical | API-Football fixtures payload ~100 KB max for 14-day window. FCM responses small. Resend small. |
| Errors | Throws `GoError` on network / parse failures | Wrap every call in try/catch. |
| Goja async/await | **NOT supported** | All code synchronous. ES5 target despite esbuild's es2017 — async/await syntax compiles, but `RpcFunction` returning a Promise rejected at runtime. |

**Source:** [`nk.httpRequest` line 3517 in index.d.ts](https://github.com/heroiclabs/nakama-common/blob/master/index.d.ts); [Heroic Labs forum: TS runtime does not support async](https://forum.heroiclabs.com/t/typescript-nakama-runtime-does-not-support-async-functions-for-custom-rpcs/5209).

**Goja blocking implications for Phase 2:**
- Tick fetches API-Football (~500 ms typical), 0–N FCM sends (~300 ms each), 0–1 OAuth2 refresh (~200 ms). One full tick can take 1-3 seconds.
- Nakama uses a VM pool (default 16 instances); one tick blocks one slot. RPC concurrency NOT degraded.
- BUT: if tick reschedules itself with a fixed delay and HTTP timeouts wedge, the next tick may fire from the leaderboard cron BEFORE current tick releases. Use `meta:tick_lock` with TTL + epoch comparison to prevent overlap (see §"Code Patterns").

---

### Q6: API-Football "league" IDs for Argentina

**`[VERIFY — sources contradict]`**

**Conflict found in research:**
- BarraBrava CONTEXT.md (D-derived from earlier research) says: **Primera = 128, Nacional = 130**.
- WebSearch results from APIfootball.com cite: **Primera (Liga Profesional) = 44, Primera Nacional = 41**.
- The 128 / 130 IDs likely refer to a DIFFERENT API (this might be the api-sports.io ID scheme; the 44 / 41 might be apifootball.com — a different vendor entirely).

**Verification plan for Wave 0 of execution:**

1. Subscribe to api-sports.io free tier, get API key.
2. Call `GET https://v3.football.api-sports.io/leagues?country=Argentina&season=2026` once.
3. Record the actual `league.id` for "Liga Profesional Argentina" and "Primera Nacional" returned.
4. Hardcode the verified IDs in a `nakama/src/integrations/api_football_config.ts` module.

**Do NOT hardcode 128/130 OR 44/41 without verifying.** This is a 1-call cost (1 of 100 daily) and must be the first task in Wave 0.

**Argentine seasons within a league:** API-Football's `season` field is a year integer (e.g., `2026`). Argentine football has Apertura + Clausura WITHIN one calendar-year season, distinguished by the `league.round` string (e.g., `"Apertura - 5"`, `"Clausura - 12"`). Phase 2's season-detection logic must use `round` string parsing (substring match `Apertura` / `Clausura`) to compute torneo boundaries, NOT `season` alone. D-16's "season field + cluster of fixtures" plan is correct — `round` distinguishes Apertura from Clausura.

**Sources:**
- [API-Football Leagues & Teams IDs](https://www.api-football.com/news/post/leagues-teams-ids) `[VERIFY direct read blocked 403]`
- [API-Football coverage list](https://www.api-football.com/coverage)
- [BetsAPI Argentina Liga Profesional](https://betsapi.com/l/26549/Argentina-Liga-Profesional) (different vendor IDs)
- [AFA Liga Profesional Wikipedia](https://en.wikipedia.org/wiki/AFA_Liga_Profesional_de_F%C3%BAtbol)

---

### Q7: Resend API for transactional emails

**`[VERIFIED: Resend docs + ecosystem coverage]`**

**Endpoint:** `POST https://api.resend.com/emails`

**Auth:** `Authorization: Bearer re_<api_key>` `[VERIFIED]`

**Request body (minimum):**
```json
{
  "from": "BarraBrava <noreply@barrabrava.com.ar>",
  "to": ["user@example.com"],
  "subject": "Recuperá tu contraseña — Liga Aguante",
  "html": "<p>Hola...</p>"
}
```

**Response (200/202):** `{ "id": "uuid" }`

**Free tier (May 2026):** 3000 emails/month, **100 emails/day**, 1 verified domain, 30-day log retention. `[CITED: resend.com/blog/new-free-tier + automationatlas.io]`

**HARD BLOCKER for Phase 2 → Phase 6/7 activation:**
**Without a verified custom domain, Resend's `from` address can only be `onboarding@resend.dev`, and emails can only be delivered to the email address registered on your Resend account.** This is the "sandbox mode" — perfect for dev testing (the dev's own email) but useless for actual users. `[CITED: resend.com/docs/knowledge-base + lovable.dev/faq + Phase 6/7 dependency]`

**Implication:** Even if `RESEND_ENABLED=true` were flipped tomorrow on Phase 2 code, real users would NOT receive emails. The flip from `false → true` is contingent on:
1. Buy `barrabrava.com.ar` (or `.ar`, `.com`) domain.
2. Add DNS records (SPF, DKIM, DMARC) per Resend dashboard.
3. Resend "Verify Domain" passes.
4. Flip `RESEND_ENABLED=true` + set `RESEND_FROM=noreply@<verified-domain>`.

This sequence is explicitly Phase 6/7 work. Phase 2 only prepares the code.

**When `RESEND_ENABLED=false`:** Phase 2 path:
1. Token generated, persisted in `reset_tokens`.
2. `logger.info('Reset link for %s: %s', email, resetLink)` — dev copies from Railway logs.
3. Return `{ok: true}` to client (anti-enumeration response shape unchanged).
4. `confirm_password_reset` works fully — dev can test end-to-end manually.

**Sources:**
- [Resend Send Email API reference](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Free Tier (2026)](https://resend.com/blog/new-free-tier)
- [Resend account quotas + limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Resend Free Tier Explained May 2026 (Automation Atlas)](https://automationatlas.io/answers/resend-free-tier-explained-2026/)

---

### Q8: Timer survival across server restarts

**`[VERIFIED: leaderboard storage is in Postgres]`**

**Per Q1's pattern:**
- `leaderboardCreate` writes record into Postgres `leaderboard` table.
- `resetSchedule` cron parsed by Nakama server, next-fire computed on each tick.
- Server restart loses in-memory state but Postgres still has the leaderboard + last reset timestamp → server resumes the next scheduled fire.
- **No need to re-register `registerLeaderboardReset` across restarts** — but `InitModule` should call `leaderboardCreate` idempotently (it's a no-op if the LB already exists with same cron).

**Multi-instance Nakama (Phase 6/7+ scaling):** For `authoritative: true` leaderboards (which we use), the reset hook fires on **ONE** instance — Nakama coordinates internally. **Single instance Phase 2 → no concern. Document for Phase 7.**

**Source:** Nakama leaderboard storage is in Postgres `leaderboard` table (Nakama-managed schema); reset scheduler is part of `nakama/server/leaderboard_scheduler.go`. `[CITED: heroiclabs/nakama leaderboard_scheduler.go]`

---

### Q9: Idempotent fixture upsert pattern

**`[VERIFIED: index.d.ts StorageWriteRequest with version]`**

**Pattern:**

```typescript
// First time write
const writes: nkruntime.StorageWriteRequest[] = [{
  collection: COL_FIXTURES,
  key: String(fixture.id),
  userId: SYSTEM_USER_ID,
  value: normalized,
  permissionRead: 2,   // public read
  permissionWrite: 0,  // no client write
  // No `version` → unconditional write.
}];
nk.storageWrite(writes);

// Update preserving optimistic concurrency
const read = nk.storageRead([{
  collection: COL_FIXTURES,
  key: String(fixture.id),
  userId: SYSTEM_USER_ID,
}]);
const existing = read[0];
if (existing) {
  const merged = mergeNormalized(existing.value, normalized);
  try {
    nk.storageWrite([{
      collection: COL_FIXTURES,
      key: String(fixture.id),
      userId: SYSTEM_USER_ID,
      value: merged,
      version: existing.version,  // optimistic — fail if changed
      permissionRead: 2,
      permissionWrite: 0,
    }]);
  } catch (e) {
    logger.warn('Concurrent fixture write detected for %s; retrying', fixture.id);
    // single retry via fresh read — sufficient at Phase 2 scale.
  }
}
```

**Easier alternative:** `nk.storageWriteRetry(reads, updateFn, maxRetries)` — built-in retry helper (index.d.ts:4474). Single API call handles read → modify → write-with-version → retry-on-mismatch. **Recommended for Phase 2 — less boilerplate, same semantics.**

```typescript
nk.storageWriteRetry(
  [{ collection: COL_FIXTURES, key: String(fixture.id), userId: SYSTEM_USER_ID }],
  (objs) => objs.map(o => ({
    collection: COL_FIXTURES,
    key: o.key,
    userId: SYSTEM_USER_ID,
    value: mergeNormalized(o.value, normalized),
    permissionRead: 2,
    permissionWrite: 0,
  })),
  3  // maxRetries
);
```

Same pattern for `match_windows` updates (where transition logic mutates state).

**Source:** `StorageWriteRequest` interface line 2773, `storageWriteRetry` line 4474.

---

### Q10: Storage collection naming + permissions

**`[VERIFIED: index.d.ts + Phase 1 patterns]`**

**Nakama Storage permissions semantics:**
- `permissionRead: 0` = no one (owner only via internal Storage Engine; clients cannot read)
- `permissionRead: 1` = owner only (the `userId` who owns the record)
- `permissionRead: 2` = public read (any authenticated client)
- `permissionWrite: 0` = no client writes (server-only via TS runtime)
- `permissionWrite: 1` = owner can write

`[VERIFIED: Phase 1 patterns + Nakama docs]`

**Phase 2 collection permission matrix:**

| Collection | UserId | Read | Write | Rationale |
|------------|--------|------|-------|-----------|
| `fixtures` | `SYSTEM_USER_ID` | **2** (public) | **0** (server only) | Game data — anyone can list upcoming fixtures. |
| `match_windows` | `SYSTEM_USER_ID` | **2** (public) | **0** (server only) | Player needs to query `get_current_window`. |
| `meta` (reused) | `SYSTEM_USER_ID` | **0** (no client) | **0** (server only) | Internal state — season, scheduler lock, OAuth token cache. |
| `fcm_tokens` | `<userId>` of player | **0** (no client) | **0** (server only) | Sensitive — never expose. Client writes via RPC, server persists. |
| `reset_tokens` | `<userId>` of player | **0** (no client) | **0** (server only) | Secret — token leak = account takeover. T-1-RT-08. |
| `admin_actions` | `SYSTEM_USER_ID` | **0** (no client) | **0** (server only) | Audit trail — admin-eyes-only. |

**Note on `fcm_tokens` userId choice:** Use the **player's userId** as the storage userId, key = `"token"` (singleton-per-user). This way each token record is owned by the player it belongs to (easier GDPR delete via `nk.storageDelete` scoped to userId), and Phase 4+ can iterate per-club via querying `clubs` ↔ `players` ↔ tokens.

**Note on `reset_tokens` userId choice:** Also use the player's userId. Key = the bcrypt-hashed token (NOT the raw token — prevents Storage-dump → enumerate-all-active-tokens attack). Or simpler: key = `"reset"` (singleton, one active token per user; new request invalidates old). **Recommended: singleton key `"reset"`** — simpler GC, simpler UI (one outstanding link at a time).

---

### Q11: Goja TypeScript runtime quirks

**`[VERIFIED: Phase 1 STATE.md + index.d.ts]`**

**The InitModule trap (Phase 1 lesson):** `InitModule` MUST be a function declaration or `var InitModule = function() {}` — NOT an arrow function. Nakama's `findInitModuleFn` (in `runtime_javascript_init_module.go`) parses the AST and only matches function declarations. The IIFE-strip in `build.mjs` hoists everything to globalThis after the wrapper is removed. Phase 2 callbacks (the leaderboard reset hook, RPC handlers) are passed BY REFERENCE — they can be arrow functions internally, just NOT InitModule itself.

**Goja capability summary:**
- ES5 syntax + a subset of ES2015 (TC39 incremental). esbuild target `es2017` works as long as no `async/await` is emitted (test: search compiled bundle for `__awaiter`).
- No Promises returned from RPCs (Nakama rejects them at `registerRpc` time).
- No `setTimeout` / `setInterval` / `setImmediate` / `process.nextTick`.
- No filesystem (`fs`), no `process.env` (use `ctx.env` from RPC ctx or Nakama config).
- `nk.httpRequest` is sync (Go-side blocks the goroutine that owns the VM slot until response arrives).
- Strict mode breaks the IIFE-unwrap (Phase 1 build.mjs strips `"use strict"` for this exact reason).

**Phase 2 implication for timer callback shape:**

```typescript
// CORRECT — arrow OK because passed as function value
initializer.registerLeaderboardReset(function (ctx, logger, nk, lb, resetTs) { ... });

// Internal helpers — arrows fine
const runTick = (ctx, logger, nk) => { ... };

// InitModule itself — MUST be function decl (already enforced in Phase 1 main.ts)
export function InitModule(...) { ... }
```

**Environment variables in TS runtime:** Available via `ctx.env` inside RPC/hook callbacks — a `{[key: string]: string}` map populated from Nakama config / Railway env vars. Critical Phase 2 vars:
- `ADMIN_BEARER` (admin RPC auth)
- `API_FOOTBALL_KEY`
- `FCM_PROJECT_ID`
- `FCM_SERVICE_ACCOUNT_B64` (base64-encoded service-account JSON)
- `RESEND_API_KEY`
- `RESEND_ENABLED` (string "true" / "false")
- `RESEND_FROM` (e.g., `"BarraBrava <noreply@barrabrava.com.ar>"`)
- `PASSWORD_RESET_BASE_URL` (e.g., `https://lukasval.github.io/barrabrava/reset-password/`)

`[VERIFIED: Phase 1 INFRA-NOTES.md + index.d.ts Context interface]`

---

### Q12: Validation architecture (Nyquist)

Covered in §"Validation Architecture" below. Summary: every Phase 2 invariant has a testable sentinel — log line, Storage record, or RPC response — that can be asserted via a smoke-test script extension of Phase 1's `smoke-test.sh`.

---

### Q13: Pitfalls specific to Phase 2

Covered in §"Pitfalls & Mitigations" below.

---

## API & Library Reference

| Library / Endpoint | URL | Auth | Free tier | Phase 2 use | Docs |
|-------------------|-----|------|-----------|-------------|------|
| **Nakama TS runtime 3.21** | bundled w/ Nakama server | n/a — in-process | n/a | Scheduler hooks, RPCs, Storage | [TypeScript Runtime](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/) |
| **API-Football v3** | `https://v3.football.api-sports.io` | Header `x-apisports-key` | 100 req/day, reset 00:00 UTC | `/leagues?country=Argentina` (once), `/fixtures?league=X&season=Y&from=A&to=B` (every poll) | [API-Sports docs](https://api-sports.io/documentation/football/v3) |
| **FCM v1 send** | `https://fcm.googleapis.com/v1/projects/{projectId}/messages:send` | Header `Authorization: Bearer <oauth2_token>` | Unlimited (FCM is free) | 1 send per `scheduled → open` transition | [Send v1 API](https://firebase.google.com/docs/cloud-messaging/send/v1-api) |
| **Google OAuth2 token endpoint** | `https://oauth2.googleapis.com/token` | JWT assertion (RS256 signed) | Unlimited | Token refresh hourly | [OAuth2 service account](https://developers.google.com/identity/protocols/oauth2/service-account) |
| **FCM Instance ID (legacy, OAuth2-only)** | `https://iid.googleapis.com/iid/v1:batchAdd` | OAuth2 same as send | Deprecated but works | Server-side topic subscribe (DEFERRED to Phase 4) | [Instance ID Server Reference](https://developers.google.com/instance-id/reference/server) |
| **Resend** | `https://api.resend.com/emails` | Header `Authorization: Bearer re_xxx` | 3000/mo, 100/day, 1 verified domain | Reset emails (gated `RESEND_ENABLED=false` Phase 2) | [Resend API ref](https://resend.com/docs/api-reference/emails/send-email) |
| **Godot 4.3 FCM plugin** | None available — custom GDExtension | — | n/a | Subscribe to topic, get device token, receive payload | See §"Q4" for path |

---

## Code Patterns

### 1. Scheduler tick via leaderboard reset

```typescript
// nakama/src/scheduler/tick.ts
import { COL_META, SYSTEM_USER_ID } from '../storage_keys';
import { pollFixtures } from '../integrations/api_football';
import { evaluateWindowTransitions } from './windows';
import { detectSeasonState } from './seasons';

const KEY_SCHEDULER_STATE = 'scheduler_state';
const KEY_TICK_LOCK = 'tick_lock';
const TICK_LOCK_TTL_MS = 5 * 60 * 1000;  // 5 min — long enough for poll + sends

interface SchedulerState {
  last_poll_at: number;        // unix ms
  last_poll_success_at: number;
  next_fixture_kickoff?: number;
  active_cadence: '15m' | '6h';
}

export function runHeartbeatTick(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  triggeredBy: 'bb_tick_15m' | 'bb_tick_6h',
): void {
  // Acquire tick lock — prevents overlap if previous tick still running.
  const now = Date.now();
  const lockRead = nk.storageRead([{
    collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID,
  }]);
  if (lockRead.length > 0) {
    const lock = lockRead[0].value as { acquired_at: number; epoch: string };
    if (lock.acquired_at + TICK_LOCK_TTL_MS > now) {
      logger.info('[tick] previous tick still active (acquired %dms ago); skipping',
        now - lock.acquired_at);
      return;
    }
    logger.warn('[tick] previous tick lock expired (stale by %dms) — proceeding',
      now - lock.acquired_at - TICK_LOCK_TTL_MS);
  }
  const epoch = nk.uuidv4();
  nk.storageWrite([{
    collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID,
    value: { acquired_at: now, epoch }, permissionRead: 0, permissionWrite: 0,
  }]);

  try {
    // Read state — decide whether to actually run for THIS cadence.
    const stateRead = nk.storageRead([{
      collection: COL_META, key: KEY_SCHEDULER_STATE, userId: SYSTEM_USER_ID,
    }]);
    const state: SchedulerState = stateRead.length > 0
      ? (stateRead[0].value as SchedulerState)
      : { last_poll_at: 0, last_poll_success_at: 0, active_cadence: '6h' };

    // Skip if wrong cadence — e.g., 15m fires but no fixture in 24h.
    if (triggeredBy === 'bb_tick_15m' && state.active_cadence !== '15m') {
      logger.debug('[tick] 15m fired but active cadence is 6h; skip');
      return;
    }
    if (triggeredBy === 'bb_tick_6h' && state.active_cadence !== '6h') {
      logger.debug('[tick] 6h fired but active cadence is 15m; skip');
      return;
    }

    // 1. Poll fixtures (max 3 API-Football calls; each ~500ms).
    let polled = 0;
    try {
      polled = pollFixtures(ctx, logger, nk, /*windowDays*/ 14);
      state.last_poll_at = Date.now();
      state.last_poll_success_at = Date.now();
    } catch (e) {
      logger.warn('[tick] pollFixtures failed: %s', String(e));
      state.last_poll_at = Date.now();
      // last_poll_success_at unchanged — fallback cache remains in use.
    }

    // 2. Evaluate window transitions + emit FCM topics for `scheduled → open`.
    evaluateWindowTransitions(ctx, logger, nk);

    // 3. Update season state.
    detectSeasonState(ctx, logger, nk);

    // 4. Reschedule cadence based on next fixture.
    const next = findNextKickoffWithin24h(nk);
    state.next_fixture_kickoff = next;
    state.active_cadence = (next !== undefined && next - Date.now() < 24 * 3600 * 1000)
      ? '15m' : '6h';

    nk.storageWrite([{
      collection: COL_META, key: KEY_SCHEDULER_STATE, userId: SYSTEM_USER_ID,
      value: state, permissionRead: 0, permissionWrite: 0,
    }]);

    logger.info('[tick] done — polled=%d cadence=%s nextKickoff=%s',
      polled, state.active_cadence, next ? new Date(next).toISOString() : 'none');
  } finally {
    // Release lock if it's still ours.
    const finalLockRead = nk.storageRead([{
      collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID,
    }]);
    if (finalLockRead.length > 0 && (finalLockRead[0].value as any).epoch === epoch) {
      nk.storageDelete([{
        collection: COL_META, key: KEY_TICK_LOCK, userId: SYSTEM_USER_ID,
      }]);
    }
  }
}

function findNextKickoffWithin24h(nk: nkruntime.Nakama): number | undefined {
  // Read upcoming match_windows; find min(opens_at) > now and < now+24h.
  // ... implementation reads col_match_windows page-by-page
  return undefined; // stub
}
```

```typescript
// In main.ts InitModule, after seedClubs:
function ensureSchedulerLeaderboards(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  // Idempotent — creates only if not exists. Use try/catch for "already exists" error.
  try {
    nk.leaderboardCreate('bb_tick_15m', true, /*sortOrder ASC*/ 0, /*operator BEST*/ 0,
      '*/15 * * * *', { purpose: 'scheduler_tick' });
  } catch (e) { /* already exists */ }
  try {
    nk.leaderboardCreate('bb_tick_6h', true, 0, 0, '0 */6 * * *', { purpose: 'scheduler_tick' });
  } catch (e) { /* already exists */ }
  logger.info('Scheduler leaderboards ensured');
}

// And the reset hook:
initializer.registerLeaderboardReset(function (ctx, logger, nk, lb, resetTs) {
  if (lb.id === 'bb_tick_15m' || lb.id === 'bb_tick_6h') {
    runHeartbeatTick(ctx, logger, nk, lb.id as any);
  }
});
```

### 2. API-Football fetch + parse

```typescript
// nakama/src/integrations/api_football.ts
import { COL_FIXTURES, COL_META, SYSTEM_USER_ID } from '../storage_keys';

const API_BASE = 'https://v3.football.api-sports.io';
const KEY_LEAGUE_IDS = 'api_football_league_ids';

interface CachedLeagueIds { primera_id: number; nacional_id: number; resolved_at: number; }

function getLeagueIds(ctx: nkruntime.Context, nk: nkruntime.Nakama, logger: nkruntime.Logger): CachedLeagueIds {
  const read = nk.storageRead([{ collection: COL_META, key: KEY_LEAGUE_IDS, userId: SYSTEM_USER_ID }]);
  if (read.length > 0) return read[0].value as CachedLeagueIds;

  // Resolve from API — costs 1 of 100 daily calls.
  const apiKey = ctx.env['API_FOOTBALL_KEY'];
  if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured');
  const resp = nk.httpRequest(
    `${API_BASE}/leagues?country=Argentina&current=true`,
    'get', { 'x-apisports-key': apiKey }, undefined, 8000
  );
  if (resp.code !== 200) throw new Error(`leagues lookup failed: ${resp.code}`);
  const body = JSON.parse(resp.body);
  let primera_id = 0, nacional_id = 0;
  for (const item of body.response) {
    const name = (item.league.name as string).toLowerCase();
    if (name.includes('liga profesional')) primera_id = item.league.id;
    if (name.includes('primera nacional')) nacional_id = item.league.id;
  }
  if (!primera_id || !nacional_id) throw new Error(`Could not resolve Argentine leagues: ${resp.body}`);
  const cached: CachedLeagueIds = { primera_id, nacional_id, resolved_at: Date.now() };
  nk.storageWrite([{
    collection: COL_META, key: KEY_LEAGUE_IDS, userId: SYSTEM_USER_ID,
    value: cached, permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('Resolved API-Football league IDs: primera=%d nacional=%d', primera_id, nacional_id);
  return cached;
}

interface NormalizedFixture {
  fixture_id: string;
  league_id: number;
  division: 'primera' | 'nacional';
  season: number;
  round: string;
  kickoff_utc: number;        // unix ms
  status: 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'P' | 'FT' | 'PST' | 'CANC' | 'SUSP' | 'AWD' | 'WO';
  home: { team_id: number; name: string };
  away: { team_id: number; name: string };
  fetched_at: number;
}

export function pollFixtures(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  windowDays: number,
): number {
  const apiKey = ctx.env['API_FOOTBALL_KEY'];
  if (!apiKey) { logger.warn('API_FOOTBALL_KEY missing; skipping poll'); return 0; }
  const leagueIds = getLeagueIds(ctx, nk, logger);
  const now = new Date();
  const from = isoDate(new Date(now.getTime() - 86400000));        // now - 1d
  const to   = isoDate(new Date(now.getTime() + windowDays * 86400000));
  const season = now.getUTCFullYear();

  let total = 0;
  for (const [div, leagueId] of [['primera', leagueIds.primera_id], ['nacional', leagueIds.nacional_id]] as const) {
    let attempt = 0; let lastErr: any = null;
    while (attempt < 3) {
      try {
        const url = `${API_BASE}/fixtures?league=${leagueId}&season=${season}&from=${from}&to=${to}&timezone=America/Argentina/Buenos_Aires`;
        const resp = nk.httpRequest(url, 'get', { 'x-apisports-key': apiKey }, undefined, 8000);
        if (resp.code === 429) {
          logger.warn('[api-football] 429 rate-limited; remaining=%s; aborting', resp.headers['x-ratelimit-requests-remaining']);
          return total;
        }
        if (resp.code !== 200) throw new Error(`status=${resp.code} body=${resp.body.substring(0, 200)}`);
        const body = JSON.parse(resp.body);
        for (const item of body.response as any[]) {
          const norm: NormalizedFixture = normalize(item, div);
          upsertFixture(nk, norm);
          total++;
        }
        break; // success — exit retry loop
      } catch (e) {
        lastErr = e; attempt++;
        if (attempt < 3) {
          // Goja has no setTimeout; "backoff" = nothing. Just retry immediately.
          // (Better: log + skip; next tick will retry organically.)
        }
      }
    }
    if (attempt >= 3) logger.warn('[api-football] %s polling failed after 3 attempts: %s', div, String(lastErr));
  }
  return total;
}

function normalize(item: any, div: 'primera' | 'nacional'): NormalizedFixture {
  return {
    fixture_id: String(item.fixture.id),
    league_id: item.league.id,
    division: div,
    season: item.league.season,
    round: item.league.round,
    kickoff_utc: item.fixture.timestamp * 1000,
    status: item.fixture.status.short,
    home: { team_id: item.teams.home.id, name: item.teams.home.name },
    away: { team_id: item.teams.away.id, name: item.teams.away.name },
    fetched_at: Date.now(),
  };
}

function upsertFixture(nk: nkruntime.Nakama, f: NormalizedFixture): void {
  nk.storageWriteRetry(
    [{ collection: COL_FIXTURES, key: f.fixture_id, userId: SYSTEM_USER_ID }],
    function (objs) {
      return [{
        collection: COL_FIXTURES, key: f.fixture_id, userId: SYSTEM_USER_ID,
        value: f, permissionRead: 2, permissionWrite: 0,
      }];
    },
    3,
  );
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in UTC
  return d.getUTCFullYear() + '-'
    + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
    + String(d.getUTCDate()).padStart(2, '0');
}
```

### 3. FCM v1 send to topic with OAuth2 service-account flow

```typescript
// nakama/src/integrations/fcm.ts
import { COL_META, SYSTEM_USER_ID } from '../storage_keys';

const OAUTH2_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const KEY_FCM_OAUTH = 'fcm_oauth_token';

interface CachedOAuthToken { access_token: string; expires_at: number; }
interface ServiceAccount {
  type: string;
  project_id: string;
  private_key: string;     // PEM-encoded RS256 key
  client_email: string;
  token_uri: string;       // https://oauth2.googleapis.com/token
}

function loadServiceAccount(ctx: nkruntime.Context): ServiceAccount {
  const b64 = ctx.env['FCM_SERVICE_ACCOUNT_B64'];
  if (!b64) throw new Error('FCM_SERVICE_ACCOUNT_B64 not configured');
  // base64Decode returns ArrayBuffer; convert to UTF-8 string.
  const bytes = new Uint8Array(/*decoded — depends on Goja support*/);
  // In Goja, ArrayBuffer → string requires manual decode or use the b64Url alt API.
  // Simpler: use atob if available, else implement small decoder.
  const json = base64ToUtf8(b64);  // helper
  return JSON.parse(json) as ServiceAccount;
}

function getAccessToken(ctx: nkruntime.Context, nk: nkruntime.Nakama, logger: nkruntime.Logger): string {
  const now = Date.now();
  const cached = nk.storageRead([{ collection: COL_META, key: KEY_FCM_OAUTH, userId: SYSTEM_USER_ID }]);
  if (cached.length > 0) {
    const c = cached[0].value as CachedOAuthToken;
    if (c.expires_at > now + 60_000) return c.access_token;
  }
  // Refresh.
  const sa = loadServiceAccount(ctx);
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const jwt = nk.jwtGenerate('RS256', sa.private_key, {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: sa.token_uri,
    iat: iat,
    exp: exp,
  });

  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
  const resp = nk.httpRequest(OAUTH2_TOKEN_URL, 'post',
    { 'Content-Type': 'application/x-www-form-urlencoded' }, body, 8000);
  if (resp.code !== 200) {
    logger.error('OAuth2 token refresh failed: %d %s', resp.code, resp.body);
    throw new Error('oauth2_refresh_failed');
  }
  const parsed = JSON.parse(resp.body);
  const newCache: CachedOAuthToken = {
    access_token: parsed.access_token,
    expires_at: now + (parsed.expires_in - 60) * 1000,
  };
  nk.storageWrite([{
    collection: COL_META, key: KEY_FCM_OAUTH, userId: SYSTEM_USER_ID,
    value: newCache, permissionRead: 0, permissionWrite: 0,
  }]);
  return newCache.access_token;
}

export interface FcmTopicPayload {
  topic: string;
  title: string;
  body: string;
  data: { [k: string]: string };
}

export function sendTopic(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  p: FcmTopicPayload,
): boolean {
  const projectId = ctx.env['FCM_PROJECT_ID'];
  if (!projectId) { logger.warn('FCM_PROJECT_ID missing; skip send'); return false; }
  const token = getAccessToken(ctx, nk, logger);
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message = {
    message: {
      topic: p.topic,
      notification: { title: p.title, body: p.body },
      data: p.data,
      android: { priority: 'high', ttl: '7200s' },
      apns: { headers: { 'apns-priority': '10' } },
    },
  };
  const resp = nk.httpRequest(url, 'post',
    { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    JSON.stringify(message), 8000);
  if (resp.code >= 200 && resp.code < 300) {
    logger.info('[fcm] sent to topic=%s', p.topic);
    return true;
  }
  logger.warn('[fcm] send failed code=%d body=%s', resp.code, resp.body.substring(0, 300));
  return false;
}
```

**Note on `base64ToUtf8`:** Goja's `nk.base64Decode` returns ArrayBuffer. Convert to string via iteration:

```typescript
function base64ToUtf8(b64: string): string {
  const ab = nk.base64Decode(b64);
  const bytes = new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  // For multi-byte UTF-8 (service account JSON usually ASCII), this works directly.
  return s;
}
```

### 4. Idempotent match_window upsert with state transition

```typescript
// nakama/src/scheduler/windows.ts
import { COL_FIXTURES, COL_MATCH_WINDOWS, SYSTEM_USER_ID } from '../storage_keys';
import { sendTopic } from '../integrations/fcm';

const WINDOW_PRE_MS  = 2 * 3600 * 1000;
const WINDOW_POST_MS = 2 * 3600 * 1000;
const MATERIALIZE_HORIZON_MS = 48 * 3600 * 1000;

interface MatchWindow {
  fixture_id: string;
  club_home_id: string;
  club_away_id: string;
  kickoff_utc: number;
  state: 'scheduled' | 'open' | 'live' | 'closed' | 'cancelled';
  opens_at: number;
  closes_at: number;
  notified_open_at?: number;
  source: 'api-football' | 'admin';
  updated_at: number;
}

export function evaluateWindowTransitions(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
): void {
  // 1. Materialize windows for fixtures <48h that don't have one.
  let cursor = '';
  for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_FIXTURES, 100, cursor);
    for (const obj of (page.objects || [])) {
      const f = obj.value as any;
      const now = Date.now();
      if (f.kickoff_utc - now > MATERIALIZE_HORIZON_MS) continue;
      if (f.status === 'PST' || f.status === 'CANC') {
        markWindowCancelled(nk, logger, f.fixture_id);
        continue;
      }
      upsertOrTransitionWindow(ctx, logger, nk, f);
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
}

function upsertOrTransitionWindow(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  f: any,
): void {
  const now = Date.now();
  const opens_at = f.kickoff_utc - WINDOW_PRE_MS;
  const closes_at = f.kickoff_utc + WINDOW_POST_MS;
  const desiredState: MatchWindow['state'] =
    now >= closes_at ? 'closed'
    : now >= f.kickoff_utc ? 'live'
    : now >= opens_at ? 'open'
    : 'scheduled';

  // We want to detect transition for `scheduled → open` to send push.
  const existing = nk.storageRead([{
    collection: COL_MATCH_WINDOWS, key: f.fixture_id, userId: SYSTEM_USER_ID,
  }]);
  const prev: MatchWindow | null = existing.length > 0 ? (existing[0].value as MatchWindow) : null;

  const next: MatchWindow = {
    fixture_id: f.fixture_id,
    club_home_id: f.home.team_id ? `team_${f.home.team_id}` : 'unknown',
    club_away_id: f.away.team_id ? `team_${f.away.team_id}` : 'unknown',
    kickoff_utc: f.kickoff_utc,
    opens_at, closes_at,
    state: desiredState,
    notified_open_at: prev?.notified_open_at,
    source: prev?.source ?? 'api-football',
    updated_at: now,
  };

  const shouldNotify = (!prev || prev.state === 'scheduled')
    && desiredState !== 'scheduled'
    && !next.notified_open_at;

  // Write FIRST with the notification marker — atomic anti-double-send.
  if (shouldNotify) next.notified_open_at = now;

  try {
    nk.storageWrite([{
      collection: COL_MATCH_WINDOWS, key: f.fixture_id, userId: SYSTEM_USER_ID,
      value: next,
      version: existing.length > 0 ? existing[0].version : '*',  // optimistic
      permissionRead: 2, permissionWrite: 0,
    }]);
  } catch (e) {
    logger.warn('[window] concurrent update for %s; will retry next tick', f.fixture_id);
    return;
  }

  // Send push AFTER successful write — failure here is acceptable (logged).
  if (shouldNotify) {
    for (const clubId of [next.club_home_id, next.club_away_id]) {
      sendTopic(ctx, logger, nk, {
        topic: 'club_' + clubId,
        title: '¡Ventana abierta!',
        body: 'Tu club juega ahora. Mové el orto al aguantadero.',
        data: {
          type: 'window_open',
          fixture_id: next.fixture_id,
          club_id: clubId,
          kickoff_utc: String(next.kickoff_utc),
          closes_at: String(next.closes_at),
        },
      });
    }
  }
}

function markWindowCancelled(nk: nkruntime.Nakama, logger: nkruntime.Logger, fixtureId: string): void {
  const r = nk.storageRead([{ collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID }]);
  if (r.length === 0) return;
  const w = r[0].value as MatchWindow;
  if (w.state === 'cancelled') return;
  w.state = 'cancelled';
  w.updated_at = Date.now();
  nk.storageWrite([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
    value: w, version: r[0].version, permissionRead: 2, permissionWrite: 0,
  }]);
  logger.info('[window] %s cancelled (postpone detected)', fixtureId);
}
```

### 5. Reset token machinery (Phase 1 carryover)

```typescript
// nakama/src/rpc/request_password_reset.ts (Phase 2 REAL)
import { COL_RESET_TOKENS, SYSTEM_USER_ID } from '../storage_keys';
import { isValidEmailShape } from '../util/validation';
import { sendResetEmail } from '../util/email';

const TOKEN_TTL_MS = 60 * 60 * 1000;  // 1h

export function rpcRequestPasswordReset(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  let email = '';
  try {
    const input = JSON.parse(payload || '{}') as { email?: unknown };
    if (isValidEmailShape(input.email)) email = (input.email as string).trim().toLowerCase();
  } catch (e) { /* fall through */ }
  // ALWAYS return ok: true (anti-enumeration) even if email missing or unknown.
  if (!email) return JSON.stringify({ ok: true });

  // Look up userId by email — Nakama has no usersGetEmail; use raw SQL.
  let userId: string | null = null;
  try {
    const res = nk.sqlQuery('SELECT id::text FROM users WHERE email = $1 LIMIT 1', [email]);
    if (res.length > 0) userId = res[0]['id'] as string;
  } catch (e) {
    logger.error('[reset] SQL lookup failed: %s', String(e));
    return JSON.stringify({ ok: true });
  }
  if (!userId) {
    logger.info('[reset] unknown email (returning ok: true): %s', maskEmail(email));
    return JSON.stringify({ ok: true });
  }

  // Generate token, persist (singleton per user — overwrites prior).
  const token = nk.uuidv4();
  const expires_at = Date.now() + TOKEN_TTL_MS;
  nk.storageWrite([{
    collection: COL_RESET_TOKENS, key: 'reset', userId: userId,
    value: { token, expires_at, requested_at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);

  const resetBase = ctx.env['PASSWORD_RESET_BASE_URL'] || 'https://lukasval.github.io/barrabrava/reset-password/';
  const resetLink = `${resetBase}?token=${token}`;
  // Token NOT logged (T-1-RT-08). Link IS logged when RESEND_ENABLED=false for dev.
  if (ctx.env['RESEND_ENABLED'] !== 'true') {
    logger.info('[reset][dev] link for %s (token redacted): %s?token=<redacted>',
      maskEmail(email), resetBase);
    logger.info('[reset][dev] FULL link (DEV ONLY — flip RESEND_ENABLED for prod): %s', resetLink);
  } else {
    const result = sendResetEmail(nk, logger, {
      to: email,
      resetLink,
      fromEmail: ctx.env['RESEND_FROM'] || 'BarraBrava <onboarding@resend.dev>',
      apiKey: ctx.env['RESEND_API_KEY'],
    });
    if (!result.sent) {
      logger.warn('[reset] Resend send failed: %s', result.reason);
      // Still return ok: true — anti-enumeration is paramount.
    }
  }
  return JSON.stringify({ ok: true });
}

function maskEmail(e: string): string {
  const at = e.indexOf('@');
  if (at <= 1) return '***';
  return e[0] + '***' + e.substring(at);
}
```

```typescript
// nakama/src/rpc/confirm_password_reset.ts (Phase 2 REAL)
import { COL_RESET_TOKENS } from '../storage_keys';

export function rpcConfirmPasswordReset(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  let input: { token?: unknown; new_password?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_json_payload' }); }

  if (typeof input.token !== 'string' || input.token.length < 8 || input.token.length > 256)
    return JSON.stringify({ ok: false, error: 'invalid_token' });
  if (typeof input.new_password !== 'string'
      || input.new_password.length < 8 || input.new_password.length > 256)
    return JSON.stringify({ ok: false, error: 'invalid_new_password' });

  const token = input.token;
  const newPassword = input.new_password;

  // Find the userId+record that has this token. No index on value field;
  // must scan COL_RESET_TOKENS. At Phase 2 scale (~10 dev tokens) this is fine.
  // For prod scale (Phase 6+) add a secondary index collection token→userId.
  let foundUserId: string | null = null;
  let foundVersion: string | null = null;
  let cursor = '';
  scan: for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList('', COL_RESET_TOKENS, 100, cursor);
    for (const obj of (page.objects || [])) {
      const v = obj.value as { token: string; expires_at: number; consumed_at?: number };
      if (v.token === token) {
        if (v.consumed_at) return JSON.stringify({ ok: false, error: 'token_already_used' });
        if (v.expires_at < Date.now()) return JSON.stringify({ ok: false, error: 'token_expired' });
        foundUserId = obj.userId;
        foundVersion = obj.version;
        break scan;
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  if (!foundUserId) return JSON.stringify({ ok: false, error: 'token_invalid' });

  // Look up the user's email — we need it for linkEmail.
  const sql = nk.sqlQuery('SELECT email FROM users WHERE id = $1 LIMIT 1', [foundUserId]);
  if (sql.length === 0) return JSON.stringify({ ok: false, error: 'user_not_found' });
  const email = sql[0]['email'] as string;

  // Mutate password via linkEmail (overwrites existing email creds — Heroic Labs issue #275).
  try {
    nk.linkEmail(foundUserId, email, newPassword);
  } catch (e) {
    logger.error('[reset] linkEmail failed for %s: %s', foundUserId, String(e));
    return JSON.stringify({ ok: false, error: 'internal_error' });
  }

  // Consume token (one-shot).
  nk.storageWrite([{
    collection: COL_RESET_TOKENS, key: 'reset', userId: foundUserId,
    value: { token, expires_at: 0, consumed_at: Date.now() },  // expires_at=0 → can't reuse
    version: foundVersion ?? undefined,
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[reset] password mutated for userId=%s', foundUserId);
  return JSON.stringify({ ok: true });
}
```

### 6. Admin RPC bearer middleware

```typescript
// nakama/src/util/admin_auth.ts
const HEADER_KEY = 'authorization'; // Nakama lower-cases header names in ctx.

export function requireAdmin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
): { ok: true; callerIp: string } | { ok: false; error: string } {
  const expected = ctx.env['ADMIN_BEARER'];
  if (!expected || expected.length < 16) {
    logger.error('[admin] ADMIN_BEARER not configured');
    return { ok: false, error: 'admin_disabled' };
  }
  // ctx.headers: { [key: string]: string[] }
  const auth = ctx.headers && (ctx.headers[HEADER_KEY] || ctx.headers['Authorization']);
  const header: string | undefined = Array.isArray(auth) ? auth[0] : (auth as any);
  if (!header || !header.startsWith('Bearer ')) return { ok: false, error: 'unauthorized' };
  const presented = header.substring(7).trim();
  // Constant-time compare to mitigate timing oracle.
  if (presented.length !== expected.length) return { ok: false, error: 'unauthorized' };
  let diff = 0;
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { ok: false, error: 'unauthorized' };
  const callerIp = (ctx.clientIp as string) || 'unknown';
  return { ok: true, callerIp };
}
```

```typescript
// Example admin RPC using the middleware
// nakama/src/rpc/admin_close_window.ts
import { COL_MATCH_WINDOWS, COL_ADMIN_ACTIONS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

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

  const fixtureId = input.fixture_id;
  const existing = nk.storageRead([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
  }]);
  if (existing.length === 0) return JSON.stringify({ ok: false, error: 'window_not_found' });
  const w = existing[0].value as any;
  if (w.state === 'closed') return JSON.stringify({ ok: true, already_closed: true });

  w.state = 'closed';
  w.closes_at = Date.now();
  w.updated_at = Date.now();
  w.source = 'admin';
  nk.storageWrite([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
    value: w, version: existing[0].version, permissionRead: 2, permissionWrite: 0,
  }]);
  // Audit
  nk.storageWrite([{
    collection: COL_ADMIN_ACTIONS, key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: { action: 'admin_close_window', fixture_id: fixtureId, caller_ip: auth.callerIp, at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[admin] close_window fixture=%s by ip=%s', fixtureId, auth.callerIp);
  return JSON.stringify({ ok: true });
}
```

---

## Runtime State Inventory

Phase 2 is greenfield (new collections, new env vars, new external integrations) — no rename/refactor of existing runtime state. Section omitted per researcher guidance.

**However**, Phase 2 touches Phase 1's `reset_tokens` collection contract:
- Phase 1 stubs never wrote to it (`request_password_reset.ts:48` says "Does NOT write a reset token").
- Phase 2 starts writing — clean slate, no prior data to migrate.
- The collection `COL_RESET_TOKENS` constant already exists in `storage_keys.ts:14`. No mirror change needed in `StorageKeys.gd` for this one (client never reads tokens).

---

## Validation Architecture

> Phase 2 has nyquist_validation enabled (config.json default). Section is mandatory.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Bash + curl** (extending Phase 1's `nakama/smoke-test.sh`) — no Jest/pytest in repo |
| Config file | `nakama/smoke-test.sh` (Phase 1 pattern) |
| Quick run command | `bash nakama/smoke-test.sh` (against deployed Railway) |
| Full suite command | Same — there is one script, structured by test number |
| New file Phase 2 adds | `nakama/test/heartbeat-test.sh` (or extend existing) |

**Why not Jest:** Heroic Labs publishes `heroiclabs/typescript-testing` for unit testing TS runtime code with mock `nk`/`logger` (jest-based), but introducing the mock-Nakama harness in Phase 2 is a Wave 0 dependency that delays real Wave 1 work. **Recommended Phase 2 strategy:** end-to-end smoke testing against the deployed instance is sufficient at Phase 2 scope (we already do this in Phase 1). Adding jest unit tests is deferred to Phase 4+ when combat resolution complexity demands deterministic test fixtures. `[Heroic Labs: typescript-testing](https://heroiclabs.com/docs/nakama/guides/server-framework/typescript-testing/)`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CLB-03 | After first tick post-deploy, `meta:api_football_league_ids` exists | smoke | `curl -s "$NK/v2/console/storage/meta" --user "admin:..." \| jq '.objects[]\|select(.key=="api_football_league_ids")'` | ❌ Wave 0 |
| CLB-03 | After tick, `fixtures` collection contains ≥1 record with `status` ∈ valid set | smoke | `bash heartbeat-test.sh test_fixtures_seeded` | ❌ Wave 0 |
| CLB-05 | When `API_FOOTBALL_KEY` unset, tick logs `'API_FOOTBALL_KEY missing'` AND cache remains intact (last fetched_at unchanged) | manual (logs) | grep Railway logs after intentional unset | ❌ documented |
| CLB-05 | Cache TTL: stale-fetched-record (>30 min old `fetched_at`) is replaced on next successful poll | smoke | inspect `fetched_at` field across two ticks | ❌ Wave 0 |
| SEA-01 | After 1st fixture of new season enters <7d window, `meta:current_season.status == 'active'` | smoke | inspect `meta:current_season` after first fixture's `opens_at - 7d` passes | ❌ Wave 0 |
| SEA-02 | After 7 days post-last-fixture, `status == 'ended'` | smoke (long-running) | inspect after 7 days OR `admin_set_season_window` to fake | ❌ Wave 0 |
| CMB-01 | Window record has `opens_at == kickoff - 2h` exactly | unit-style smoke | RPC `admin_list_windows` returns object, assert math | ❌ Wave 0 |
| CMB-01 | At kickoff time, state == 'live' (within 16 min of true time given 15-min tick) | smoke (timed) | wait for known fixture, inspect after tick | ❌ Wave 0 |
| DAY-03 | Single push per window-open transition (idempotent across re-eval) | smoke (logs) | force two consecutive ticks via `admin_force_repoll`; assert only one `[fcm] sent to topic=` log line per window | ❌ Wave 0 |
| **Resend-A** | `RESEND_ENABLED=false`: `request_password_reset` logs link, persists token, returns `{ok:true}` | smoke | curl RPC, then `nk.storageRead` token, then grep logs for link | ❌ Wave 0 |
| **Resend-B** | `confirm_password_reset` with valid token mutates password AND consumes token | smoke | curl confirm, then curl authenticate with new password (expect 200), then curl confirm same token again (expect `token_already_used`) | ❌ Wave 0 |
| **Resend-C** | Expired token rejected (`token_expired`) | smoke | force `expires_at < now` via SQL, attempt confirm | ❌ Wave 0 |
| **Admin-A** | Admin RPC without bearer → `unauthorized` | smoke | curl without header | ❌ Wave 0 |
| **Admin-B** | Admin RPC with wrong bearer → `unauthorized` | smoke | curl with `Authorization: Bearer wrong` | ❌ Wave 0 |
| **Admin-C** | Admin RPC with right bearer + valid input → mutation persisted + audit row written | smoke | curl + inspect both `match_windows` and `admin_actions` | ❌ Wave 0 |
| **Tick-A** | Tick lock prevents overlap (force two manual ticks <5 min apart, 2nd should log "previous tick still active; skipping") | manual (logs) | trigger two `admin_force_repoll` back-to-back | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Local `npm run typecheck` (Phase 1 pattern). No live test on every commit (would burn API-Football quota).
- **Per wave merge:** `bash nakama/smoke-test.sh` against Railway (after deploy completes).
- **Phase gate (`/gsd-verify-work`):** Full extended heartbeat-test.sh covering all 14 invariants above. Some invariants require fake fixtures (admin RPC to inject) since real AFA fixture timing can't be manipulated for tests.

### Wave 0 Gaps

- [ ] `nakama/test/heartbeat-test.sh` — new script with 14 test cases (or extend existing smoke-test.sh).
- [ ] `nakama/test/admin-curl-examples.md` — companion doc with copy-pasteable curl invocations for each admin RPC.
- [ ] **Fake fixture injection:** `admin_force_repoll` is fine for live fixtures, but tests for CMB-01 / SEA need a way to inject synthetic fixtures with controllable `kickoff_utc`. Plan to add `admin_inject_test_fixture(fixture_id, kickoff_utc_iso, home, away)` RPC, gated behind a stricter env flag (`ADMIN_TEST_MODE=true`) — only enabled in dev/staging, never prod. This unblocks deterministic state-machine testing.
- [ ] Framework install: **None — bash + curl + jq already present from Phase 1.**

---

## Pitfalls & Mitigations

### S-1: Nakama TS runtime has no scheduler (D-01 assumption wrong)

**What goes wrong:** Planner faithfully encodes `nk.timerCreate` into a task, code fails to compile (no such function) or runtime errors.
**Mitigation:** Use `registerLeaderboardReset` pattern (Q1). Document in CONTEXT.md addendum + INFRA-NOTES. Single-fast-tick (15m + skip-if-not-yet) is simplest.

### S-2: Goja sync HTTP blocks the VM thread

**What goes wrong:** Tick fetches 2 leagues (2 × ~500 ms) + maybe 4-6 FCM sends during clásico (~6 × 300 ms) + 1 OAuth2 refresh (1 × 200 ms) = up to ~4 s per tick. One VM slot tied up. Default Nakama VM pool is 16; tick consumption is fine but if Phase 2 chooses small pool (`runtime.js_concurrency=4`) and FCM is slow, RPCs may queue.
**Mitigation:** Keep default pool size. Set `nk.httpRequest` timeout to 8 s (above API-Football's typical 1-3 s p99 but bounded). Log every HTTP call duration via `Date.now()` deltas to make slow calls visible.

### S-3: API-Football free tier (100 req/day) is tight

**What goes wrong:** 96 ticks × 2 league calls = 192/day → exceeds quota by ~16:00 UTC every day.
**Mitigation chain:**
- **Option A (recommended):** Tick fetches ONLY when `last_poll_at < now - 25 min` (skip if within 25 min) — 4 polls/hour max but 2 calls each = 192/day. **STILL OVER.**
- **Option B (recommended):** Fetch BOTH leagues in ONE call by widening date range — actually API-Football requires `league` param singular. So 2 calls minimum. **Confirmed over budget if pure 15-min cadence.**
- **Real solution:** 15-min cadence kicks in ONLY in `[fixture - 24h, fixture + 4h]` actual window. Outside that, fall to 6h. Argentine Primera matches: 1-2 per week-night-windows of ~3-4 days/wk. So 15-min cadence active maybe 3 × 24h × 4 ticks/h × 2 leagues = ~576 calls weekly, +6h base = 4 × 7 days × 2 = ~56 → **~632 calls/week ÷ 7 = ~90/day.** Under quota.
- **Operational mitigation:** Add a `daily_quota_warn` metric in `meta:scheduler_state` — if `x-ratelimit-requests-remaining < 10`, set state and force 6h cadence regardless until reset.
- **Phase 6 mitigation:** Upgrade to paid tier ($10-15/mo) when prelaunch.

### S-4: API-Football league IDs unverified (Q6)

**What goes wrong:** Hardcode 128/130, get empty results because real IDs are 44/41 (or vice-versa).
**Mitigation:** Wave 0 task: subscribe + call `/leagues?country=Argentina` once, hardcode the result. Already encoded in `getLeagueIds()` pattern above with caching.

### S-5: FCM topic name validation

**What goes wrong:** Club ID format includes invalid chars (e.g., `boca-juniors-(la-doce)` — parens not allowed).
**Mitigation:** Sanitize `club_id` to `[a-zA-Z0-9-_.~%]+` before forming topic name. Current Phase 1 clubs.json uses lowercase + underscores → safe. Add `validateTopicName(s)` helper in `nakama/src/integrations/fcm.ts` that asserts regex match; fail fast in dev, log + skip in prod.

### S-6: Argentine DST confusion

**What goes wrong:** None — Argentina is UTC-3 fixed since 2009. Confirmed via Q + WebSearch.
**Mitigation:** Store all timestamps as UTC milliseconds. Display only at the UI layer with fixed `America/Argentina/Buenos_Aires` (offset -03:00). Phase 2 hardcodes the timezone — no DST math needed. `[VERIFIED]`

### S-7: Reset token leak risk via logs

**What goes wrong:** Phase 1 lesson T-1-RT-08 — logging `resetLink` exposes token to anyone with Railway log access.
**Mitigation:** Phase 2 splits behavior:
- `RESEND_ENABLED=true` → never log the full link (dev not needed once Resend wired).
- `RESEND_ENABLED=false` → log the link as DEV-ONLY-OK convenience (no other path). Document in INFRA-NOTES that `RESEND_ENABLED=true` MUST flip before exposing Railway logs to other people.

### S-8: Resend without verified domain = no real delivery

**What goes wrong:** Flip `RESEND_ENABLED=true` thinking it works → real users get nothing because Resend sandbox only sends to dev's verified email.
**Mitigation:** INFRA-NOTES.md gets a "DO NOT FLIP UNTIL" checklist:
1. Domain purchased
2. DNS records added (SPF, DKIM, DMARC per Resend dashboard)
3. Resend "Verify Domain" returns green
4. `RESEND_FROM` env set to `<name>@<verified-domain>`
5. ONLY THEN flip `RESEND_ENABLED=true`

Add an assertion at boot: if `RESEND_ENABLED=true` AND `RESEND_FROM` contains `resend.dev` → `logger.error` + STILL behave as if false (defense in depth).

### S-9: linkEmail silently overwrites differing email

**What goes wrong:** Phase 2 reset confirms — if user's stored email differs from input (e.g., capitalization mismatch in lookup), `linkEmail` could overwrite an unrelated account. Issue #275 documented this.
**Mitigation:** Resolve email from `users.email` BY userId (not from the input) before calling linkEmail. Pattern in §"Code Patterns 5" already does this: `sqlQuery('SELECT email FROM users WHERE id = $1')`. Pass the canonical email back to linkEmail.

### S-10: Goja base64 + UTF-8 service-account JSON

**What goes wrong:** `nk.base64Decode` returns ArrayBuffer; converting to a UTF-8 string in Goja's ES5 is non-trivial (no `TextDecoder`). Service-account JSON has multi-byte characters (`é` in `client_email` if you used accents — unlikely; default Google service-account JSON is ASCII).
**Mitigation:** Service-account JSON is generated by Google and is pure ASCII. The `String.fromCharCode` loop in §"Code Patterns 3" works. Add a comment warning future maintainers not to copy this pattern for arbitrary UTF-8 base64.

### S-11: Storage `permissionRead: 0` and Nakama Console visibility

**What goes wrong:** Setting `reset_tokens` to `permissionRead: 0` makes them invisible to Nakama Console (admin web UI) too — debugging is hard.
**Mitigation:** Acceptable trade-off. Dev uses `nk.sqlQuery('SELECT * FROM storage WHERE collection = $1', ['reset_tokens'])` from a dev-only `admin_dump_tokens` RPC for debugging. NOT exposed in prod.

### S-12: Tick overlap on slow tick

**What goes wrong:** 15-min leaderboard fires every 900s; tick takes 1100s due to flaky API-Football → next tick fires while previous still running → double poll, double quota burn.
**Mitigation:** §"Code Patterns 1" `KEY_TICK_LOCK` with 5-min TTL prevents this. If tick exceeds 5 min, lock expires — but at that point the OAuth/poll is broken and second tick may legitimately retry. Log WARN.

### S-13: Race between `admin_force_repoll` and scheduled tick

**What goes wrong:** Admin curls `admin_force_repoll` at second :59, scheduled tick fires at next :00 = two concurrent ticks.
**Mitigation:** `admin_force_repoll` honors the same `KEY_TICK_LOCK` (it's just another tick caller). If lock is held, return `{ok: false, error: 'tick_in_progress'}` and let admin retry.

### S-14: `fcm_tokens` collection grows unbounded

**What goes wrong:** Phase 2 writes one record per device-token-per-user. Users reinstall the app → new token, old token never cleaned up. Phase 4+ tries to push to stale tokens → FCM returns `UNREGISTERED`, but each invalid send still consumes time.
**Mitigation:** Phase 2 uses key = `'token'` (singleton per userId). New registration overwrites old. Same user logs into a second device → both tokens lost (only the most recent wins). **Acceptable** at Phase 2 because we don't ACTUALLY push per-user yet (D-10). Phase 4 revisits with proper multi-device storage (e.g., key = `'token_' + platform`).

### S-15: Postpone (`PST`) reaches us late

**What goes wrong:** API-Football updates a fixture to `PST` status 30 min before kickoff. Our tick was 14 min ago — next tick is 1 min from now. Window already transitioned to `open`, push already fired.
**Mitigation:** On detecting `PST` for a window already `open` or `live`, the tick `markWindowCancelled` writes `state: 'cancelled'` — clients reading `get_current_window` will see cancelled and hide UI. **No retraction push is sent** (no FCM "delete" feature for fired pushes); the lunfardo body line about "the game is on" becomes stale but the data payload `type: 'window_open'` plus subsequent `state=cancelled` lets the client filter. Future Phase 4 can add a "ventana cancelada" push.

### S-16: Storage list pagination correctness

**What goes wrong:** `storageList(userId, collection, limit, cursor)` requires `userId`. For `reset_tokens` we want to scan ALL users' tokens — passing `''` for userId is required.
**Mitigation:** Use `nk.storageList('', COL_RESET_TOKENS, 100, cursor)` (empty userId = all users). Verified in code pattern. Limit 50 pages × 100 = 5000 tokens (safe at Phase 2 dev scale; Phase 6+ adds secondary index).

### S-17: Custom FCM plugin signing on Android CI

**What goes wrong:** Adding native Android Java module to Godot 4.3 requires recompiling Godot's Android export template — Phase 1's debug-only CI may need an upgrade.
**Mitigation:** Phase 2 builds locally only (no CI change). Phase 7 picks up production signing + CI. Document in INFRA-NOTES that `bash gradlew assembleRelease` from `android/build/` is the local Phase 2 path. `[VERIFY when Wave 1 starts]`

---

## Open Questions / [VERIFY] items

1. **API-Football league IDs for Argentine Primera and Primera Nacional.** Conflicting sources (128/130 vs 44/41). Resolved by calling `/leagues?country=Argentina&current=true` once at deploy. **Wave 0 task.**
2. **Exact Nakama `runtime.js_concurrency` default and how many goroutines it spawns.** Likely 48 per Nakama defaults; planner can verify against Railway deployment config. Not a blocker — tick is short.
3. **Whether `nk.leaderboardCreate` is truly idempotent OR throws on duplicate ID.** Code pattern wraps it in try/catch; safer than asserting. **Wave 1 task to confirm by inspecting behavior.**
4. **Whether `ctx.headers` capitalization is consistent.** Nakama might lowercase, might pass-through. Code pattern checks both `authorization` and `Authorization` for safety. **Inspect actual ctx.headers shape in a smoke test.**
5. **Godot 4.3 FCM plugin path.** Three options surveyed (Q4); Path A (custom GDExtension) recommended. **Wave 1 task: stand up minimal Java plugin and validate.**
6. **`ctx.clientIp` behavior behind Railway's proxy.** Likely shows Railway proxy IP, not real user IP. For admin audit log this is fine (we're auditing the admin operator who knows their VPN/home IP). Document.
7. **Whether Nakama's `nk.sqlQuery` is wired in TS runtime AT ALL.** index.d.ts has the function (line 3503). **Wave 1 task: verify it actually executes on Railway-hosted Nakama 3.21.** If disabled by `runtime.allow_db_access=false`, we'd need an alternative for email→userId lookup (custom email index in Storage on register hook).
8. **JWT `nk.jwtGenerate('RS256', ...)` key format.** Likely expects PEM-encoded (with `-----BEGIN PRIVATE KEY-----` markers). Service-account JSON contains the key in PEM form. **Wave 2 task: confirm at first OAuth2 refresh.**
9. **FCM "INVALID_ARGUMENT" / "NOT_FOUND" topic responses.** Topics auto-create on first subscribe, but if no devices ever subscribe to `club_X` and we send anyway, FCM may return success but deliver to zero. **Acceptable Phase 2.** Document.

---

## Sources

### Primary (HIGH confidence)
- Nakama TS runtime types: `nakama/node_modules/nakama-runtime/index.d.ts` (lines 1090, 1099, 2379, 3503, 3517, 3583, 3850, 3968, 4462, 4474, 5198, 5208) — verified via direct read.
- [Nakama TypeScript Runtime official docs](https://heroiclabs.com/docs/nakama/server-framework/typescript-runtime/)
- [Nakama Background Jobs guide](https://heroiclabs.com/docs/nakama/guides/server-framework/background-jobs/)
- [Heroic Labs forum: TS runtime no async](https://forum.heroiclabs.com/t/typescript-nakama-runtime-does-not-support-async-functions-for-custom-rpcs/5209)
- [GitHub issue: Cron Scheduler for Nakama #581](https://github.com/heroiclabs/nakama/issues/581)
- [GitHub issue: LinkEmail overwrites silently #275](https://github.com/heroiclabs/nakama/issues/275)
- [Firebase Cloud Messaging HTTP v1 codelab](https://firebase.google.com/codelabs/use-the-fcm-http-v1-api-with-oauth-2-access-tokens)
- [Send messages using FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- [FCM Manage Topics](https://firebase.google.com/docs/cloud-messaging/manage-topics)
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend New Free Tier](https://resend.com/blog/new-free-tier)
- [Resend account quotas + limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- Phase 1 outputs: `nakama/src/main.ts`, `nakama/build.mjs`, `nakama/src/rpc/*.ts`, `nakama/src/util/*.ts`, `nakama/src/storage_keys.ts`, `scripts/autoloads/*.gd`.
- BarraBrava context: `.planning/phases/02-heartbeat-afa/02-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`.

### Secondary (MEDIUM confidence — WebSearch results; original docs gated 403)
- [API-Sports Football v3 docs landing](https://api-sports.io/documentation/football/v3) — direct read 403, summary via WebSearch.
- [API-Football: How rate limit works](https://www.api-football.com/news/post/how-ratelimit-works) — direct read 403, summary via WebSearch.
- [API-Football: Leagues & Teams IDs](https://www.api-football.com/news/post/leagues-teams-ids) — direct read 403, summary via WebSearch.
- [API-Football: How to get all fixtures from one league](https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league)
- [Authenticating FCM HTTP v1 API (Medium, Jen Person)](https://medium.com/@ThatJenPerson/authenticating-firebase-cloud-messaging-http-v1-api-requests-e9af3e0827b8)
- [Resend Free Tier Explained May 2026 (Automation Atlas)](https://automationatlas.io/answers/resend-free-tier-explained-2026/)
- [Resend free tier (Lovable FAQ)](https://lovable.dev/faq/backend/email/resend-free-tier)
- [Godotx Firebase GitHub](https://github.com/godot-x/firebase) — confirmed Godot 4.6+ requirement.
- [DrMoriarty FCM plugin (stale)](https://github.com/DrMoriarty/godot-firebase-cloudmessaging)
- [Argentina TimeZone (TimeZoneDB)](https://timezonedb.com/time-zones/America/Argentina/Buenos_Aires) — UTC-3 fixed, no DST.
- [Google Identity OAuth2 service account flow](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Google Instance ID Server Reference (deprecated)](https://developers.google.com/instance-id/reference/server)
- [Instance ID batchImport deprecation note (Google Groups)](https://groups.google.com/g/firebase-talk/c/GzvORYMk6sE)

### Tertiary (LOW confidence — flagged [VERIFY])
- AFA Liga Profesional Wikipedia — used only for division name confirmation.
- BetsAPI Argentina Liga Profesional — alternative vendor IDs; not used directly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `nk.leaderboardCreate` is idempotent (re-call with same ID = no-op or recoverable error) | Q1 + Code Pattern 1 | Tick scheduler never installs; user must wipe LB by hand. **Mitigated by try/catch around the call.** |
| A2 | Two parallel leaderboards firing at the 15-min mark do NOT race each other (each `registerLeaderboardReset` callback gets its own VM slot) | Q1 + Code Pattern 1 | Concurrent ticks fight over `meta:tick_lock`. **Mitigated by tick lock — one wins, other skips.** |
| A3 | API-Football's response field `league.round` reliably contains substrings "Apertura" or "Clausura" for Argentine Primera/Nacional | Q6 + season detection | Season auto-detect fires wrong. **Admin override `admin_set_season_window` covers it.** |
| A4 | `nk.sqlQuery` is enabled in the Railway Nakama deployment (default config doesn't disable it) | Code Pattern 5 + Open Q7 | Email → userId lookup fails. **Mitigation: ship a register-hook that maintains `email_index` collection.** |
| A5 | `ctx.env['ADMIN_BEARER']` returns the Railway env var as-set (no Nakama transform) | Code Pattern 6 | Admin RPCs always 401. **Mitigated by simple boot-time log of `ADMIN_BEARER.length > 16`.** |
| A6 | FCM `INVALID_ARGUMENT` for unknown topic still returns 2xx (broadcast to zero subscribers is success) | Q3 | Push send appears failed but isn't. **Acceptable — log only.** |
| A7 | esbuild target `es2017` continues to compile Phase 2 sources without emitting `__awaiter` (no async/await in source) | Q11 + Phase 1 | Build succeeds but runtime crash. **Mitigation: add post-build grep for `__awaiter` in `build.mjs`.** |
| A8 | Godot 4.3 supports custom Android plugin via `GodotPlugin` Java class (same pattern as Godot 3.x just with renamed namespace) | Q4 Path A | Plugin doesn't load; entire FCM client stalls. **Mitigation: Wave 1 spike to validate; fallback Path C.** |
| A9 | Custom-domain Resend email delivery latency from Railway's region to Resend's US infrastructure is <10s p95 | (not directly applicable — sending only, not waiting on response) | Reset emails arrive late. **Not in Phase 2 scope (Resend disabled).** |
| A10 | The Argentine Liga Profesional 2026 season has STARTED by the time Phase 2 deploys (so there are actual fixtures to test against) | Phase 2 timing | Phase 2 deploys but no fixtures exist → tick has nothing to do. **Mitigation: synthetic fixture injection via `admin_inject_test_fixture` for testing.** |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Nakama 3.21 (Railway) | All Phase 2 server work | ✓ (Phase 1 deployed) | 3.21.0 (per Phase 1 STATE.md) | — |
| Postgres 16 (Nakama-bundled) | All Storage | ✓ | bundled | — |
| Godot 4.3 (local dev) | Client FCM plugin | ✓ | 4.3 stable | — |
| Android SDK + NDK + JDK | Custom FCM plugin build | ✓ (Phase 1 CI used it for debug APK) | per `DEFERRED-CI.md` | — |
| Firebase project | FCM service account | ✗ — not yet provisioned | — | **Blocking** — Wave 0 task. Free tier instant. |
| API-Football account | Fixture data | ✗ — not yet registered | — | **Blocking** — Wave 0 task. Free signup. |
| Resend account | Email delivery (deferred Phase 6/7) | ✗ — not yet registered | — | NON-blocking Phase 2 (RESEND_ENABLED=false). Wave 0 task to register for free tier so the API key exists. |
| Custom domain (`barrabrava.com.ar`) | Resend verified-domain | ✗ — not yet purchased | — | **Blocking for activation only** — deferred Phase 6/7. Phase 2 deploys w/o it. |
| iOS Mac/Xcode | Future iOS FCM plugin | ✓ (dev has Mac per Phase 1) | per Phase 1 | Phase 2 ships Android-only; iOS plugin lands Phase 7. |

**Missing dependencies blocking Phase 2 work:**
- Firebase project (free, instant) — Wave 0 task.
- API-Football account (free, instant) — Wave 0 task.

**Missing dependencies non-blocking (Phase 2 graceful degrade):**
- Resend account → Phase 2 ships with RESEND_ENABLED=false; account creation deferred to Phase 6/7 prelaunch.
- Custom domain → Phase 6/7 prelaunch only; Phase 2 doesn't need it.

---

## Security Domain

> `security_enforcement` defaults enabled (config.json has no explicit `false`). Phase 2 introduces new attack surface — admin RPCs + FCM credentials + reset tokens — so this section is mandatory.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| **V2 Authentication** | yes | Bearer-token for admin RPCs via env var (D-20). Constant-time compare in middleware (S-7 mitigation). Reset tokens are short-lived (1h TTL) and single-use. |
| **V3 Session Management** | yes | Nakama session tokens already managed by Nakama core (Phase 1). Phase 2 doesn't introduce new session surface. |
| **V4 Access Control** | yes | Storage `permissionRead/Write` enforced server-side. Admin RPCs gated by env var bearer. Client never reads `reset_tokens`, `admin_actions`, `meta`, `fcm_tokens`. |
| **V5 Input Validation** | yes | Every RPC validates input via existing `validation.ts` patterns: `isValidEmailShape`, length bounds on token/password, regex for topic name, `fixture_id` shape check, ISO timestamp parse for `new_kickoff_utc`. |
| **V6 Cryptography** | yes | `nk.jwtGenerate('RS256', ...)` for OAuth2 — never hand-rolled. Service-account private key stored ONLY in env var (`FCM_SERVICE_ACCOUNT_B64`), never logged, never stored to Storage. `bcryptCompare` available if we ever need password verification (Phase 2 uses `linkEmail` which handles hashing internally). |
| **V7 Error Handling & Logging** | yes | Logs use `logger.info/warn/error`. Tokens NEVER logged (T-1-RT-08 carryover). Emails masked in logs (`a***@example.com`). Stack traces only on `error` level. |
| **V9 Communication** | yes | TLS-by-default (`nk.httpRequest` `insecure: false` default). Never overridden to true. |
| **V12 Files & Resources** | no | No file uploads in Phase 2 (UGC trapos = v2). |
| **V14 Configuration** | yes | Env-var-driven config. `RESEND_ENABLED=false` default. `ADMIN_BEARER` minimum length asserted at boot. Defense-in-depth: assertion that `RESEND_ENABLED=true` REQUIRES `RESEND_FROM` to not contain `resend.dev`. |

### Known Threat Patterns for Phase 2

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Admin RPC enumeration / brute force of bearer token** | Spoofing (S) | 32+ char UUID v4 token (`crypto/rand`-grade by Railway). Constant-time compare in middleware (S-7 mitigation). Rate limit at Nakama level (default 5 req/sec/IP per Nakama config). |
| **Reset token guessing** | Spoofing (S) | 128-bit UUID v4 (~2^122 entropy). 1-hour TTL. Single-use (consumed at confirm). |
| **Reset token leak via logs** | Information Disclosure (I) | Token NEVER logged; full link logged ONLY when `RESEND_ENABLED=false` (dev) and stamped as DEV-ONLY in log line. |
| **Reset token replay** | Spoofing (S), Tampering (T) | `consumed_at` marker; second attempt → `token_already_used`. |
| **Email enumeration via reset flow** | Information Disclosure (I) | Uniform `{ok:true}` response regardless of email existence (Phase 1 anti-enumeration pattern preserved). |
| **Push notification spam** | DoS | One push per window-open transition (D-12 + `notified_open_at` marker). Idempotent across re-eval. |
| **Push topic injection (FCM `\n` in topic name)** | Tampering (T) | `validateTopicName(s)` regex check before forming `topic` field. |
| **OAuth2 access-token leak** | Information Disclosure (I), Spoofing (S) | Cached in `meta:fcm_oauth_token` with `permissionRead: 0` (server-only). Token rotates hourly. Worst-case leak = 1h misuse window. |
| **FCM service-account key leak via process env** | Information Disclosure (I), Elevation of Privilege (E) | Stored base64 in env var, never written to Storage, never logged. If Railway env leaks → full compromise. **Acceptable Phase 2 risk; Phase 7 considers secret rotation procedure.** |
| **API-Football key leak** | Information Disclosure (I) | Same as FCM key. Lower stakes (worst case: quota burn). |
| **Admin RPC injecting fake fixtures used to grief players** | Tampering (T), Repudiation (R) | All admin mutations logged to `admin_actions` (D-22) — IP + timestamp + payload. Solo dev knows what they did. |
| **Race on simultaneous admin override + scheduler tick** | Tampering (T) | Tick lock (S-12); admin RPCs honor same lock. |
| **Stale FCM tokens cause O(N) failed sends in Phase 4** | DoS | Phase 2 uses singleton key `'token'` — no accumulation. Phase 4 problem deferred. |
| **TLS downgrade on Resend / FCM / API-Football** | Tampering (T) | `nk.httpRequest` uses TLS by default; never set `insecure: true`. |
| **Reset link click-jacking on web reset page** | Tampering (T) | Phase 1's `web/reset-password/index.html` is static HTML on GitHub Pages — no iframe-able state. Add `Content-Security-Policy: frame-ancestors 'none'` header via `<meta>` if not already present (Wave 3 task). |

---

## Metadata

**Confidence breakdown:**
- Nakama TS runtime APIs (scheduler workaround, jwt, linkEmail, httpRequest, storage versioning): **HIGH** — verified via direct read of `nakama-runtime/index.d.ts` v2026-master + Heroic Labs official docs + GitHub issues.
- API-Football endpoint shape + rate limit semantics: **HIGH** — multiple corroborating sources via WebSearch (direct doc page returns 403 to WebFetch but search snippets are consistent).
- API-Football Argentine league IDs (128/130 vs 44/41): **LOW** — flagged Q6; Wave 0 task to call `/leagues?country=Argentina` and verify.
- FCM v1 send-to-topic + OAuth2 service-account flow: **HIGH** — Firebase official docs + codelabs corroborate. JWT-with-RS256 path uses `nk.jwtGenerate` (verified in index.d.ts).
- Godot 4.3 FCM client plugin path: **LOW** — no maintained plugin for 4.3 exact; recommended path is custom GDExtension (Path A); requires Wave 1 spike.
- Resend free tier + verified-domain constraint: **HIGH** — multiple corroborating sources, Resend's own marketing pages.
- Argentine timezone (UTC-3, no DST): **HIGH** — TimeZoneDB + Wikipedia + 2009 law widely documented.

**Research date:** 2026-05-17

**Valid until:** 2026-06-17 (30 days for stack-mature components; **Godot FCM plugin landscape may shift** if Godot 4.6 ships before then or if a 4.3-compatible plugin appears — revalidate Q4 at execution start).

---

*Phase: 02-heartbeat-afa*
*Research conducted: 2026-05-17*
*Researcher mode: gsd-phase-researcher (filling implementation gaps under user-delegated D-01..D-27).*
