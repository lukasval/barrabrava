# Architecture Patterns: BarraBrava

**Domain:** Mobile multiplayer geo-social game with real-world calendar sync
**Researched:** 2026-05-14
**Confidence:** HIGH (established patterns for async multiplayer + geo games)

---

## 1. Component Diagram

### Major Services

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (Unity / React Native + native modules)                 │
│  - Local game state cache (read-only mirror)                    │
│  - GPS capture + platform push token management                 │
│  - Asset streaming from CDN                                     │
│  - IAP purchase flow (Apple/Google SDK)                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS + WebSocket (selective)
┌──────────────────────▼──────────────────────────────────────────┐
│  API GATEWAY (Supabase Edge Functions / Cloudflare Workers)     │
│  - Auth token validation on every request                       │
│  - Rate limiting per player                                     │
│  - Routes to downstream services                                │
└──┬──────────┬─────────┬──────────┬────────────┬────────────────┘
   │          │         │          │            │
   ▼          ▼         ▼          ▼            ▼
[PLAYER]  [WORLD]   [COMBAT]  [SOCIAL]    [COMMERCE]
 STATE     STATE    ENGINE     FEED         SERVICE
   │          │         │          │            │
   └──────────┴────┬────┴──────────┘            │
                   │                            │
             [POSTGRES DB]              [IAP VALIDATOR]
             (Supabase)                 (server-side only)
                   │
            [REDIS CACHE]
            (Upstash free tier)

[SCHEDULER]────────────────────────────────────────────────────────
  - AFA fixture poll (cron, every 15 min during match days)       │
  - Match window open/close triggers                              │
  - Season transition jobs                                        │
  - Cleanup / expiry jobs                                         │
──────────────────────────────────────────────────────────────────

[PUSH SERVICE]                [CDN]                  [MODERATION]
  Firebase Cloud Messaging      Cloudflare R2 +          Queue in
  / APNs passthrough            CDN for cosmetics,       Postgres +
  Triggered by Scheduler,       trapos, audio            manual review
  Combat Engine, Social Feed                             dashboard
```

### Service Boundaries

| Service | Owns | Asks Others |
|---------|------|-------------|
| Player State Service | pibe roster, skills, resources (Aguante, Trapos, Reputación), heat/cana status, club affiliation | World State for territory bonuses; Combat for outcomes |
| World State Service | territory ownership map, zone control percentages, active feudos | Player State for club populations; Scheduler for match window status |
| Combat Engine | ambush plan validation, auto-defense resolution, outcome calculation, permadeath/lawyer logic | Player State (read + write outcomes); Push Service (notifications); Social Feed (virality events) |
| Social Feed Service | event log, trapo theft posts, emboscada replays, virality ranking | Combat Engine (event source); Player State (club/profile enrichment); Moderation queue |
| Commerce Service | IAP receipt storage, premium currency ledger, cosmetic entitlements | IAP providers (Apple/Google) for validation; CDN for asset delivery |
| Scheduler Service | AFA fixture cache, match window open/close events, season state, drop triggers | AFA data source; all services (broadcasts window events) |
| Moderation Service | trapo image queue, name review queue, report queue | CDN (images); Push/email for reviewer alerts |

---

## 2. Data Flow: Four Key User Journeys

### (A) Player Launches Game

```
1. Client → API Gateway: POST /session/init
   - JWT token (Supabase Auth)
   - Device fingerprint, platform, app version

2. API Gateway → Player State Service:
   - Fetch player snapshot (pibe, resources, roster, heat)
   - Returns delta since last_seen timestamp (bandwidth optimization)

3. Player State Service → World State Service:
   - Fetch current territory map (club zones, contested areas)
   - Cached in Redis, TTL 60 seconds
   - Full map is ~30KB compressed; only diffs sent on reconnect

4. Player State Service → Scheduler:
   - Fetch active match windows for player's club
   - Fetch upcoming windows next 48h

5. API Gateway → Client: Single consolidated payload
   - Player snapshot
   - World map delta
   - Active + upcoming match windows
   - Unread notifications count (not content — lazy loaded)
   - Cosmetic entitlement list (asset keys, not URLs — CDN URLs signed on demand)

Total cold start payload target: < 50KB compressed
CDN assets: pulled lazily on first render, cached locally
```

### (B) Match Window Opens

```
1. Scheduler (cron, checks every 2 min):
   - AFA feed returns match status = LIVE for fixture X
   - Scheduler writes match_window record: {fixture_id, home_club, away_club, opens_at, closes_at}
   - Publishes event to internal message queue (Supabase Realtime / pg_notify)

2. Combat Engine consumes event:
   - Marks all pending ambush plans targeting home/away clubs as ELIGIBLE
   - Validates GPS bonus eligibility for players near stadiums

3. World State Service consumes event:
   - Activates contested zones for home/away club territories
   - Applies clásico / superclásico multipliers if applicable

4. Push Service consumes event:
   - Fan-out push to all players affiliated with home/away clubs
   - Message: "Ventana abierta — [Club A] vs [Club B] — 90 minutos"
   - Uses FCM topic subscriptions (club_X topic) to avoid per-device loop
   - Batched in chunks of 500 to respect FCM quotas

5. Client (foreground): receives WebSocket push OR polls on next action
   - Match window banner appears
   - Combat planning UI unlocks for eligible players
```

### (C) Player Ambushes Another

```
1. Client → Combat Engine: POST /combat/plan
   Body: {
     attacker_id,
     target_player_id,
     location: {lat, lng},  // where ambush will occur
     roster: [pibe_ids],
     scheduled_for: ISO timestamp
   }

2. Combat Engine — server-side validations (ALL server, none trusted from client):
   a. Match window is currently OPEN for attacker's club
   b. Attacker has not exceeded daily ambush limit
   c. Attacker's roster pibes are not already deployed or in hospital
   d. Target player is in the same or adjacent territory zone
   e. GPS location claim plausibility check (see Anti-Cheat section)
   f. No cooldown active between these two players

3. Combat Engine stores plan: status = PENDING_EXECUTION
   - Scheduled job fires at scheduled_for time
   - If window closes before execution: plan auto-cancels, resources refunded

4. At execution time — Combat Engine resolves:
   a. Fetch target's auto-defense configuration (defender set this in advance)
   b. Apply tactical roles: trompada vs aguantador matchups, vigía intel bonuses
   c. Apply location modifier (home territory = defender bonus)
   d. Roll outcome: rasguñazo / paliza / robo bombo / robo trapo
   e. Apply heat escalation: increase attacker's heat score
   f. Permadeath check: if pibe falls AND attacker has no abogado available → pibe lost

5. Combat Engine writes outcomes:
   - Player State Service: debit/credit resources, update pibe statuses, increment heat
   - World State Service: update territory control if applicable
   - Social Feed Service: publish event (trapo theft = viral post with replay data)

6. Push Service sends to both players:
   - Attacker: "Tu emboscada en Villa Crespo tuvo éxito — robaste el trapo de [target]"
   - Defender: "¡Te emboscaron! [attacker] te robó el trapo. Recuperalo antes de que termine la ventana"

7. Client receives push → opens to combat result screen
   - Replay constructed client-side from server-provided seed + action log
   - No deterministic simulation on server — outcome is stored, replay is cosmetic
```

### (D) Season Ends

```
1. Scheduler detects: AFA tournament final round complete, season_end flag set

2. Season Transition Job (long-running, idempotent):
   a. Snapshot leaderboard rankings per club + globally
   b. Calculate territory domination percentages (final ownership)
   c. Identify champion club (AFA result) → write buff record for next season
   d. Identify relegated clubs → write penalty records
   e. Award exclusive cosmetics to top-ranked players per club (server-minted)
   f. Award battle pass completers their final reward
   g. Write "season archive" record (historical read-only snapshot)

3. Partial reset (NOT wipe):
   - Resources: partial decay (retain 40% Aguante, 20% Trapos — design decision)
   - Pibes: retain, but XP soft-resets
   - Territory: full reset to neutral
   - Heat/cana: cleared
   - Premium currency: NOT reset (paid, never expire)
   - Cosmetic entitlements: NOT reset

4. New season state written atomically via Postgres transaction
   - If transaction fails: job is idempotent, safe to retry
   - Season number increments only on full success

5. Push to all players: "Nueva temporada comenzó — [champion] manda"
   - Cosmetic reward delivery: pushed to entitlement store, pulled by client on next launch
```

---

## 3. State Storage — What Lives Where

### Hot Storage (Redis / Upstash)

Fast reads, volatile, acceptable to reconstruct from Postgres.

| Data | TTL | Why Hot |
|------|-----|---------|
| World territory map | 60s | Read on every client launch, thousands of readers |
| Active match windows | Until window closes | Combat Engine polls constantly |
| Player resource snapshot | 30s | Ambush validation needs sub-100ms reads |
| Session tokens | 24h | Auth middleware on every request |
| Rate limit counters | Per window (1min) | DDoS / abuse protection |
| Leaderboard top-100 | 5 min | Feed and profile reads |

### Warm Storage (Postgres primary — Supabase)

Source of truth. All writes go here first.

| Table | Notes |
|-------|-------|
| players | Auth, club, profile, settings |
| pibes | Roster per player, skills, status, permadeath flag |
| resources | Aguante, Trapos, Reputación, premium currency per player |
| heat_status | Current heat level, cana/arrested flag, lawyer availability |
| ambush_plans | Planned, executing, resolved combat records |
| combat_outcomes | Immutable log of resolved combats |
| territory_ownership | Zone_id → club_id + control_pct, timestamped |
| match_windows | Fixture → open/close times, status |
| afa_fixtures | Cached fixture schedule, refreshed by Scheduler |
| seasons | Season boundaries, champion, buff/penalty records |
| social_feed_events | Event type, payload JSON, virality score |
| cosmetic_entitlements | player_id → cosmetic_id, granted_at |
| iap_receipts | Raw receipt, validated_at, entitlement granted |
| trapo_submissions | Image key in R2, status (pending/approved/rejected) |
| moderation_queue | Reports, flags, reviewer assignments |

### Cold Storage (Cloudflare R2 / S3)

Binary blobs, historical archives, rarely read.

| Data | Access Pattern |
|------|---------------|
| Season archives (snapshot JSON) | Once per season end, read for historical stats |
| Combat replay seeds | Fetched on-demand when player views old replay |
| User-submitted trapo images (pending/rejected) | Moderation review, then purge if rejected |
| Approved trapo images | Promoted to CDN after moderation approval |
| Analytics event dumps | Batch export, never real-time |

### CDN (Cloudflare CDN in front of R2)

| Data | Cache Strategy |
|------|---------------|
| Official cosmetic assets (skins, bombos, cánticos, effects) | Immutable, long TTL (1 year), versioned filenames |
| Approved trapos | 24h TTL, purged on moderation revocation |
| Club badge assets | Immutable per season |
| Audio cues (cánticos, drums) | Immutable, long TTL |

---

## 4. Authoritative vs Client Logic

### Server Decides (Source of Truth — Never Trust Client)

| Decision | Why |
|----------|-----|
| Resource amounts (Aguante, Trapos, Reputación, premium currency) | Economy integrity, cheating prevention |
| Combat outcomes | Cannot be manipulated by either party |
| Match window open/close times | Cannot let client self-report "window is open" |
| Permadeath outcomes | Irreversible, must be server-confirmed |
| GPS bonus eligibility | Anti-spoofing validation |
| IAP entitlement grants | Anti-fraud |
| Heat/cana escalation | Game balance, anti-exploit |
| Territory ownership percentages | Shared world state |
| Season transitions + resets | Economy integrity |
| Leaderboard rankings | Anti-cheat |
| Ambush plan eligibility (club match window, cooldowns, roster availability) | Anti-cheat |

### Client Decides (Presentation Only — Verified or Inconsequential)

| Decision | Why Safe |
|----------|---------|
| UI navigation, screen transitions | No game state |
| Replay animation rendering (from server-provided seed) | Cosmetic only |
| Audio/visual effects timing | Cosmetic only |
| Local notification scheduling (reminders) | User experience, not game state |
| Asset pre-fetch prioritization | Bandwidth optimization, not state |
| Map pan/zoom | Presentation |
| Draft ambush plan composition (before submitting) | Submitted to server for validation before committing |

### Grey Zone — Client Optimistic, Server Corrects

| Action | Pattern |
|--------|---------|
| Displaying current resources | Show cached value, server diff on reconnect corrects it |
| Territory map display | Show last-known, real-time correction on WebSocket or reconnect |
| Combat plan "preview" (estimated outcome) | Client shows probability range — server result may differ |

---

## 5. Realtime Requirements

### Needs WebSocket / Long-Poll

These require sub-second or push-initiated updates during active sessions.

| Channel | Why | Implementation |
|---------|-----|---------------|
| Match window open (during match) | Players need to know immediately when combat is available | Supabase Realtime (Postgres LISTEN/NOTIFY) |
| Combat outcome notification (foreground player) | Immediate result when player is in app | Supabase Realtime |
| Territory map changes during match window | World state changes rapidly during 90-min window | Realtime with 10s debounce — not every individual change |

Constraint: WebSocket connections are expensive on mobile battery. Only maintain WebSocket when player is in an active match window screen. Background: use push notifications.

### Needs Request-Response (REST/RPC)

| Action | Why |
|--------|-----|
| Game launch / session init | One-shot, no ongoing connection needed |
| Submit ambush plan | Action, not stream |
| Set auto-defense configuration | Infrequent action |
| Fetch social feed | Paginated pull |
| IAP purchase | Transactional |
| Profile / roster management | Infrequent |
| Trapo submission | File upload |

### Needs Push Notifications (FCM / APNs)

| Trigger | Urgency |
|---------|---------|
| Match window opens | High — time-sensitive (90 min window) |
| You got attacked | High — defender may want to respond |
| Trapo stolen | High — humiliation mechanic requires visibility |
| Pibe arrested / needs lawyer | High — resource decision |
| Pibe died (permadeath) | High |
| Season ended / rewards ready | Medium |
| Upcoming match window reminder | Medium (scheduled 30 min before) |
| Moderation decision on trapo | Low |

### Needs Batch / Cron (No Realtime)

| Job | Schedule |
|-----|---------|
| AFA fixture poll | Every 15 min on match days, every 6h otherwise |
| Match window open/close evaluation | Every 2 min |
| Season end detection | Daily check |
| Leaderboard recalculation | Every 5 min |
| Heat/cana decay | Hourly |
| Cosmetic drop triggers | On AFA events (goal, match end) — event-driven not cron |
| Analytics export | Nightly |
| Expired moderation items | Daily |

---

## 6. External Integrations

### AFA Data Source

**Primary option:** API-Football (api-football.com) or SofaScore unofficial API
- Provides: fixtures, live scores, match status, season calendar
- Reliability: MEDIUM — unofficial APIs break during high-traffic events
- Mitigation: Cache aggressively. Never make match window availability depend on real-time API call — pre-load fixtures 48h ahead. If live feed dies, windows remain open for pre-scheduled duration. Log failure and alert.

**Fallback:** Manual admin override endpoint — solo dev can push match results manually if feed breaks during a clásico.

**Data stored locally:**
- Full season fixture calendar (refreshed weekly)
- Live match status (refreshed every 2 min during match days)
- Results (refreshed within 5 min of full-time whistle)

### IAP Providers

| Provider | Integration Point | Validation |
|---------|-------------------|------------|
| Apple App Store | StoreKit 2 (iOS SDK) | Server-side receipt validation at `https://buy.itunes.apple.com/verifyReceipt` |
| Google Play | Billing Library 6+ (Android SDK) | Server-side via Google Play Developer API |

Client NEVER grants entitlements. Client initiates purchase → sends receipt token to server → server validates with Apple/Google → server grants entitlement → client reads entitlement on next state sync.

**Anti-fraud:** Receipt is tied to player_id on first validation. Replaying same receipt for second account returns error. Idempotency key prevents double-grant on network retry.

### Push Notification Providers

**Firebase Cloud Messaging (FCM)** — primary for Android, also delivers to iOS via APNs passthrough.

- Use FCM topic subscriptions for club-wide notifications (match windows):
  - Topic: `club_{club_id}_matches` — subscribed on club selection
  - Topic: `season_events` — all players
- Use direct device token for personal notifications (attack, theft, pibe died)
- Store device tokens server-side, refresh on app launch
- FCM free tier: unlimited for up to 1M MAU effectively

**Argentine network conditions:**
- FCM messages that fail delivery are queued for 4 weeks by default
- For time-sensitive match window notifications: set TTL to 5400s (90 min window duration) — stale delivery is useless
- Collapse key on match window notifications to avoid notification storm on reconnect

### CDN

**Cloudflare R2 + Cloudflare CDN:**
- R2: zero egress fees (critical for cost control with cosmetic assets)
- CDN: global PoP coverage includes São Paulo (nearest to Argentina, ~30ms)
- Signed URLs for premium cosmetic assets (entitlement check before URL issued)
- Public URLs for approved trapos and common assets
- Budget: R2 free tier covers 10GB storage + 1M operations/month — sufficient for MVP

### Analytics

**PostHog (self-hosted on free tier or cloud free tier):**
- Event tracking: match window engagement, combat conversion, IAP funnel
- Feature flags for phased rollout of mechanics
- Session replay disabled on mobile (too heavy)
- Send events in batches from client (every 30s or on app background)

---

## 7. Anti-Cheat Strategy

### GPS Spoofing

**Problem:** Players fake location near estadio to claim stadium bonus.

**Detection signals (server-side, never trust client):**
1. Speed plausibility: player cannot teleport 500km between two GPS readings 5 minutes apart
2. Location history variance: mock GPS apps produce unnaturally clean coordinates (exact integer lat/lng)
3. Cross-reference with IP geolocation: if IP resolves to Buenos Aires but GPS claims Mendoza, flag
4. Device sensor correlation: real movement correlates with accelerometer data (if provided)
5. Frequency analysis: mock GPS apps often produce coordinates at exactly regular intervals

**Response:**
- First detection: GPS bonus withheld silently, warning logged
- Second detection: GPS bonus suspended for 7 days, player notified
- Third detection: Permanent GPS bonus revocation, account flag

**Stadium bonus is a quality-of-life bonus, not win-critical.** Removing it is a measured response, not account ban. This reduces cheating incentive and support burden.

### Time Manipulation

**Problem:** Player changes device clock to extend match windows or trigger bonuses.

**Prevention:** Server controls all time. Match windows are defined by server timestamps derived from AFA feed. Client never reports or influences window timing. Client-side "time remaining" display is cosmetic — recalculated from server's window close time on every state sync.

### Resource Cheating

**Prevention:** All resource mutations happen server-side. Client sends intents (I want to attack), server validates and applies. No client-side resource balance. Memory editors that modify client state produce optimistic UI until next server sync corrects it.

### Automation / Bots

**Signals:**
- Ambush plans submitted at mathematically regular intervals (e.g., exactly every 3600.000s)
- No variation in roster selection patterns
- Device fingerprint associated with multiple accounts
- Action rate exceeds human plausible limit (rate limiting is first defense)

**Rate limits (server-enforced):**
- Max 10 API calls/second per player
- Max 5 ambush plans/24h (game mechanic limit — anti-bot by design)
- Max 20 GPS claims/hour

**CAPTCHA:** Triggered on suspicious automation signals, not on normal play. Use hCaptcha (privacy-friendly, free tier) for rare challenge moments.

### Multi-Accounting

- Device fingerprint (not a reliable ban tool, but useful signal)
- One account per IAP purchase platform ID
- IP rate limiting for account creation
- Shared device ≠ instant ban (families share phones in Argentina) — weight as signal, not proof

---

## 8. Scalability Path

### MVP Tier — 0 to ~5,000 MAU

**Infrastructure:** Entirely managed services, minimal ops.

| Component | Service | Cost |
|-----------|---------|------|
| Database | Supabase free tier (500MB, 2 compute units) | $0 |
| Cache | Upstash Redis free tier (10K req/day) | $0 |
| Edge Functions | Supabase Edge Functions (500K invocations/month free) | $0 |
| Object storage | Cloudflare R2 free tier (10GB) | $0 |
| CDN | Cloudflare free plan | $0 |
| Push | Firebase FCM | $0 |
| Analytics | PostHog free tier (1M events/month) | $0 |
| Scheduler | Supabase pg_cron (built-in) | $0 |

**Total infra cost at MVP: ~$0–$25/month**

Bottleneck at this tier: Supabase free compute (shared, can be slow under burst load during match windows). Mitigation: aggressive Redis caching for read-heavy world state.

**Architecture simplification at MVP:**
- No separate microservices — all logic in Edge Functions, organized by domain module
- Single Postgres instance with row-level security
- No message queue — pg_notify is sufficient for internal events
- No async worker fleet — cron jobs handle all scheduled work

### Growth Tier — 5,000 to ~100,000 MAU

**Triggers to upgrade:** Supabase compute saturation during match windows, Redis quota exceeded, R2 storage > 10GB.

**Changes:**
- Upgrade Supabase to Pro ($25/month) → dedicated compute, 8GB DB
- Upstash Redis paid tier ($0.20/100K reads) — budget ~$20/month at this scale
- Cloudflare R2 paid storage (minimal — $0.015/GB)
- Consider Supabase dedicated instance if connection pooling becomes bottleneck
- Add read replicas for world state queries (Supabase supports this on Pro)
- Split Edge Functions into logical deployment units (combat, social, commerce separate cold-start pools)
- Introduce proper job queue (Inngest free tier or QStash) for combat resolution fan-out

**Architecture still: serverless + managed. No Kubernetes, no self-hosted anything.**

**Total infra cost at growth tier: ~$75–$150/month**

### Scale Tier — 100,000+ MAU

At this scale the project has revenue to hire help. Architectural changes become a team decision, not a solo-dev constraint. Indicative path:

- Dedicated Postgres cluster (Neon, Supabase Enterprise, or managed RDS)
- Redis Cluster for world state (ElastiCache or Upstash Enterprise)
- Regional edge caching for South America (Cloudflare already handles this)
- Separate combat resolution service (stateless worker fleet, auto-scaled)
- Dedicated push delivery service with retry queues
- Moderation dashboard with ML pre-screening (AWS Rekognition for image content)

---

## 9. Build Order — Foundational to Deferred

### Layer 0 — Must Exist Before Anything (Week 1–2)

These block every other component.

1. **Supabase project + schema** — Player, pibe, resource tables. Auth. Row-level security policies.
2. **API Gateway (Edge Functions shell)** — Auth middleware, request routing skeleton.
3. **Club data seed** — Static list of AFA Primera División clubs. No live feed yet — hardcode.
4. **Player creation flow** — Pick club, create pibe, assign starting resources. Proves auth + DB work.

### Layer 1 — Core Loop (Week 3–6)

The game is not a game without these.

5. **AFA Fixture Scheduler** — Cron polling AFA feed, storing fixtures, match_window records. The heartbeat of the entire game.
6. **Match Window Service** — Open/close logic triggered by Scheduler. World state activation.
7. **Combat Engine (basic)** — Submit ambush plan, server validates, resolves at window, stores outcome. No permadeath yet — simplify.
8. **Player State sync** — Resource mutations from combat. Debit/credit.
9. **Push Notifications (FCM)** — Match window open. Attack received. Without this, async combat has no feedback loop.

### Layer 2 — World and Social (Week 7–10)

10. **Territory / World State** — Zone ownership, club control map. Redis-backed.
11. **GPS Bonus** — Opt-in stadium detection. Anti-spoof checks.
12. **Social Feed** — Combat events published. Trapo theft viral post.
13. **Permadeath + Lawyer system** — Adds tension. Requires combat engine stable first.
14. **Heat / Cana system** — Police escalation. Requires combat engine stable first.

### Layer 3 — Economy and Monetization (Week 11–14)

15. **IAP Integration** — Apple StoreKit 2 + Google Billing. Server receipt validation. Premium currency ledger.
16. **Cosmetic Entitlement system** — Grant, store, deliver to client.
17. **CDN asset pipeline** — Upload official cosmetics to R2, serve via CDN. Client asset loader.
18. **Battle Pass / Season Pass** — Progress tracking, reward milestones.

### Layer 4 — UGC and Safety (Week 15–18)

19. **Trapo image upload** — R2 upload, moderation queue.
20. **Moderation dashboard** — Solo dev reviews submissions. Basic admin UI.
21. **Auto-moderation** — Integrate image safety API (AWS Rekognition or similar) to pre-screen.
22. **Report system** — Players report abuse in feed.

### Layer 5 — Season and Polish (Week 19–22)

23. **Season transition job** — Idempotent end-of-season reset, archive, reward distribution.
24. **Leaderboards** — Redis sorted sets. Per-club + global.
25. **Replay system** — Server stores combat seed + action log. Client renders replay cosmetically.
26. **Jerarquía interna** — Barra leader mechanics, voting, challenge system.

### Deferred (Post-MVP Validation)

- Eventos dinámicos (clásico multipliers) — Scheduler supports it, but UX polish needed
- Vigía intel system (advanced ambush planning) — Layer 1 combat works without it
- Advanced analytics dashboards
- Cross-club seasonal events (Libertadores tier)

---

## 10. Disaster Scenarios

### AFA Data Feed Dies Mid-Clásico

**Scenario:** Superclásico is live. 90-minute window is open. api-football.com goes down.

**What breaks:** Live score sync (cosmetic during game). Real-match winner bonus cannot be confirmed until feed recovers.

**What does NOT break:** The match window was pre-scheduled and is already open. Combat continues normally. Window closes at pre-calculated time (match start + 105 min).

**Response:**
- Scheduler detects feed failure: logs error, sends alert to dev (PagerDuty / simple email webhook)
- Window stays open for full pre-scheduled duration
- Winner bonus job is idempotent: when feed recovers, re-runs for the period, applies bonus retroactively (safe because it's additive, not destructive)
- Manual override: admin endpoint allows dev to push match result manually

**Player communication:** No in-game indication of feed failure. Winner bonus may be delayed up to 2h. Acceptable for v1.

### Push Provider (FCM) Fails During Match Window

**Scenario:** FCM outage. Match window opens but notifications don't deliver.

**What breaks:** Players who are not in the app don't get notified. Reduced combat activity during window.

**What does NOT break:** Game state is correct. Windows are still open. Players in-app still see window via WebSocket or next poll.

**Response:**
- Match window notification is time-sensitive: TTL set to 30 min. If FCM recovers within 30 min, delayed delivery still has value.
- FCM reliability is very high (>99.9% uptime historically). Plan for occasional delay, not outage.
- No fallback push provider in v1 (overkill). If FCM is down, window runs with reduced participation — acceptable.

**Mitigation:** In-app persistent banner shows time until next window. Players who check app regularly are unaffected.

### Database Overload During Superclásico

**Scenario:** 3,000 players submit ambush plans within 2 minutes of window opening. Supabase free tier DB becomes slow.

**What breaks:** Latency spikes on plan submission. Players see slow responses.

**What does NOT break:** Data integrity — writes are serialized by Postgres. No corruption. Plans submitted before timeout are recorded.

**Response:**
- Rate limiting (10 req/s per player) caps individual player impact
- Redis caching means most read traffic (world state, resources) hits cache, not DB
- Ambush plan submission is an append-only write — not a hot update path
- If MVP proves this load is real: upgrade Supabase to Pro before next superclásico

**Monitoring:** Supabase dashboard shows query performance. Set alert on p95 latency > 500ms.

### CDN Outage (Cosmetic Assets Unavailable)

**Scenario:** Cloudflare CDN partial outage. Some players can't load skin assets.

**What breaks:** Visual rendering of custom skins/trapos.

**What does NOT break:** Game mechanics. Combat, resources, territory — all server-side data, not CDN-served.

**Response:**
- Client renders fallback default skin when asset fails to load
- Retry with exponential backoff (3 attempts)
- Cloudflare has 99.99%+ uptime SLA; this is extremely rare
- No action needed for v1 beyond client-side fallback rendering

### Moderation Backlog Overwhelms Solo Dev

**Scenario:** 500 trapo submissions queue up overnight.

**What breaks:** Trapos stuck in pending state. Players frustrated their custom trapo is not live.

**Response:**
- Auto-moderation pre-screening (AWS Rekognition, ~$0.001/image) rejects obvious violations automatically
- Only flagged/borderline items need human review
- SLA communicated to players: "Trapos revisados en hasta 48 horas"
- In v1: limit trapo submissions to 1 per player per season (reduces volume dramatically)

---

## Component Health Summary

| Component | Build Complexity | Failure Mode | Mitigation |
|-----------|-----------------|--------------|------------|
| Auth (Supabase) | Low | Provider outage | Supabase 99.9% SLA; JWTs cached client-side survive brief outage |
| AFA Scheduler | Medium | Feed API dies | Pre-cache fixtures; manual override; idempotent retry |
| Combat Engine | High | Logic bugs = economy exploit | Extensive server-side validation; immutable outcome log for audit |
| Push Notifications | Low | FCM outage | TTL on time-sensitive pushes; in-app fallback |
| CDN | Low | Asset unavailable | Client fallback renders; Cloudflare reliability |
| IAP Validation | Medium | Apple/Google API slow | Queue receipt validation async; never block purchase UI |
| GPS Anti-Spoof | Medium | False positives | Silent withholding before punitive action; appeal path |
| Social Feed | Low | Virality storm DB load | Redis read cache for feed; pagination |
| Season Transition | High | Partial completion | Idempotent job; transaction-wrapped; dry-run mode |
| Moderation | Medium | Backlog | Auto pre-screen; volume cap per player |

---

## Authoritative Boundary Summary

```
CLIENT                              SERVER
──────                              ──────
Intent only →                       Validation + execution
Draft plans →                       Commit or reject
Display cached state →              Source of truth + corrections
Render cosmetics →                  Asset entitlement grants
Initiate IAP →                      Receipt validation + entitlement
Report GPS location →               Plausibility check + bonus grant
Request replay →                    Serve combat seed + action log
```

**The client is a display terminal and intent collector. It never executes game logic.**

---

## Sources

- Supabase architecture documentation (Edge Functions, Realtime, pg_cron, RLS)
- Firebase Cloud Messaging topic messaging and TTL documentation
- Cloudflare R2 + CDN pricing and reliability specifications
- Upstash Redis free tier specifications
- Apple StoreKit 2 server-side receipt validation documentation
- Google Play Billing Library 6 server validation patterns
- Clash of Clans-style async combat resolution: industry pattern for base-defense games
- GPS anti-spoofing detection: published patterns from Niantic (Pokémon GO) post-mortems
- Confidence: HIGH for overall architectural pattern; MEDIUM for specific service free tier limits (verify current pricing before committing)
