# Technology Stack — BarraBrava

**Project:** BarraBrava
**Researched:** 2026-05-14
**Researcher note:** WebSearch, WebFetch, and Bash tools were unavailable in this session.
All findings are based on training data through August 2025. Items requiring active version
verification are flagged LOW or MEDIUM confidence with a `[VERIFY]` marker. Before coding
starts, a human must validate all `[VERIFY]` items.

---

## 1. Client / Game Engine

### Recommendation: Godot 4.x (MIT license)

**Version:** Godot 4.3 stable (released August 2024) — GDScript or C# [VERIFY exact latest patch]

**Why Godot over Unity:**
- MIT license — no runtime fee, no revenue share, no subscription. Unity's 2023 Runtime Fee
  crisis (ultimately partially walked back in late 2023/early 2024) permanently damaged trust
  and created ongoing contractual risk for solo devs. Godot has no licensing surprises. [VERIFY
  current Unity Personal tier terms as of 2026 — they changed multiple times 2023-2025]
- Godot 4's 2D engine is excellent. BarraBrava is primarily a 2D strategy/management game
  (Clash of Clans tempo, map view, character cards) — not a 3D title. Godot 4's CanvasItem
  renderer and TileMap system cover all required visual surfaces.
- Single-person cognitive load: Godot's scene/node system is simpler to reason about than
  Unity's GameObject/Component/Prefab/Addressables stack. Less time managing project config,
  more time building features.
- Export to iOS + Android natively supported. Android export is straightforward. iOS requires
  a macOS machine for Xcode signing (same constraint as Unity or Flutter).
- File size: Godot export binaries are significantly smaller than Unity (often 20-40 MB vs
  Unity's 60-100+ MB base). Matters in Argentina where data costs and device storage are
  real constraints.
- GDScript is fast to prototype in. C# export is available if performance demands it.
- Active community, Discord, docs are comprehensive as of 2025.

**Key Godot 4 mobile capabilities:**
- Godot 4.x: Android/iOS export templates built-in
- HTTP client, WebSocket client built into engine (for backend comms)
- Notification plugins available via community (godot-android-plugin-firebase or similar)
  [VERIFY current plugin ecosystem for Godot 4 notifications]
- In-app purchase plugins exist (godot-iap for Android, iOS) [VERIFY maturity for Godot 4.3]
- GPS/location: requires native plugin (GodotAndroidPlugin pattern or GDNative bridge).
  Not built-in — plan 1-2 days integration effort per platform.

**Pitfall (solo dev):** Godot's mobile IAP and GPS plugins are community-maintained, not
first-party. Some are behind on Godot 4 compatibility. Audit each plugin's Godot 4.x support
before committing. Budget time to fork and patch if needed.

**Argentine market concern:** Godot produces smaller APKs. Argentina has significant low-end
Android device penetration (Motorola Moto G series dominates). Godot 4 minimum Android API
level is 21 (Android 5.0) which covers ~99% of active devices. [VERIFY current Godot 4 min
API requirement]

**Alternatives considered:**

| Option | Trade-off |
|--------|-----------|
| Unity 2022 LTS / 6 | Larger ecosystem, more mobile plugins, better IL2CPP performance. But: Runtime Fee history, heavier project overhead, Unity Personal tier revenue caps create future risk. Fine if you accept the terms — but adds legal/financial uncertainty for a solo commercial project. |
| Flutter + Flame | Flutter is excellent for UI-heavy apps. Flame (Flutter game engine) works for 2D games. However: Flame is not battle-tested for multiplayer game state management at this complexity level. The game loop, networking, and map systems would require significant custom work that Godot handles natively. Use Flutter only if you already know it deeply. |
| React Native + Reanimated | Not a game engine. Inappropriate for this project. Would require building every game primitive from scratch. Reject. |
| Native Swift + Kotlin | Two codebases for one solo dev. Double maintenance. Reject for v1. |

---

## 2. Backend — Real-time Multiplayer Service

### Recommendation: Nakama (self-hosted on Railway or Fly.io, then migrate to Heroic Cloud)

**Version:** Nakama 3.x (open source, Apache 2.0) [VERIFY current Nakama version — was 3.x
series as of 2025]

**Why Nakama:**
- Purpose-built for games: built-in match-making, authoritative server-side match logic,
  leaderboards, social graph (friends, clans/groups), in-game notifications, session
  management, wallet/virtual currency, storage engine. Covers ~70% of BarraBrava's backend
  needs out of the box.
- Clash of Clans tempo = async multiplayer. Nakama handles both real-time (WebSocket
  matches) and async turn-based patterns natively. For BarraBrava's attack windows (90-minute
  match duration, plan-then-execute raids), Nakama's match handler + storage API is the right
  abstraction.
- Groups API: maps directly to clubs/barras. Leader roles, member management, group chat all
  built in.
- Leaderboards: native per-season leaderboards with expiry support.
- Storage: flexible key-value + object store for player state (pibe inventory, trapos,
  aguante totals).
- Wallet: virtual currency system for Moneda Premium tracking.
- Self-hosted: $0 infra at start on Railway.app free tier or Fly.io (Nakama + PostgreSQL).
  Migrate to Heroic Cloud (managed Nakama) when revenue justifies it.
- Godot SDK: Official Godot client SDK exists (nakama-godot). [VERIFY Godot 4 compatibility
  — the SDK was being updated for Godot 4.x as of 2024]

**Authoritative server architecture:** Nakama's server-side Lua/TypeScript/Go runtime handles
authoritative logic. Battle outcomes, resource changes, territory control — all computed
server-side. Client sends intent, server validates and applies. This prevents cheating on
attack outcomes and territory changes.

**Argentine market latency concern:** Self-host on a São Paulo AWS region node (sa-east-1)
or Railway's São Paulo region. Argentina → São Paulo ping is typically 20-60 ms — acceptable
for Clash of Clans tempo gameplay. Real-time FPS-level sync is not required. [VERIFY Railway
and Fly.io SA region availability as of 2026]

**Pitfall (solo dev):** Nakama's server-side runtime requires writing TypeScript or Go for
custom match logic. TypeScript runtime is easiest for solo dev. Budget time to learn Nakama's
runtime API — it's well-documented but has a learning curve. Start with the TypeScript
runtime hooks, not Go.

**Pitfall:** Nakama + PostgreSQL requires a VPS or managed container. Railway's free tier has
sleep/cold-start behavior — not acceptable for production. Even $10-20/month Railway Pro tier
fixes this. Total infra cost at launch: ~$20-40/month (Nakama + Postgres + Redis optional).

**Alternatives considered:**

| Option | Trade-off |
|--------|-----------|
| Firebase Realtime DB / Firestore + Cloud Functions | Firebase is fast to start but expensive to scale with frequent writes (territory updates, attack resolutions). Firestore's per-document-write pricing punishes game state mutation patterns. No built-in authoritative match logic — you write all of it in Cloud Functions. Cloud Functions cold starts hurt real-time feel. |
| PlayFab (Microsoft) | Good feature set (title data, economy, matchmaking, leaderboards). Free tier is generous. BUT: vendor lock-in to Azure, no self-hosting option, Godot SDK is community-maintained and less mature than Nakama's official SDK. Microsoft acquisition risk. |
| Photon (PUN/Fusion/Quantum) | Excellent for real-time action games. Overkill and wrong abstraction for async strategy game. Photon Fusion/Quantum are Unity-centric. Photon Cloud has per-CCU pricing that gets expensive faster than Nakama self-hosted. |
| Supabase Realtime | Great for traditional web apps. Not purpose-built for game patterns. Would require custom implementation of matchmaking, leaderboards, groups, wallets. More work than Nakama. Postgres is solid but you're reinventing the game backend layer. |
| Colyseus | Good Node.js game server. Lighter than Nakama, more code to write. Requires hosting separately. Less battle-tested at scale. Fine alternative if you prefer Node.js, but more DIY. |

---

## 3. Database

### Recommendation: PostgreSQL 16 (via Nakama's bundled instance)

**Why:** Nakama bundles and manages PostgreSQL as its storage layer. You get a relational DB
for free within the Nakama stack. Player state, social graph, leaderboards, and session data
all live here.

**Data model strategy:**
- Player profile, pibe roster, territory ownership, season state → Nakama Storage Objects
  (JSON blobs on top of PostgreSQL). Nakama handles indexing.
- Leaderboards → Nakama Leaderboard API (built on PostgreSQL).
- Social graph (club membership, barra hierarchy) → Nakama Groups API.
- AFA fixture/results cache → Separate PostgreSQL table (custom schema, populated by a
  scheduled job/edge function). Keep fixture data separate from Nakama's managed tables.
- Asset metadata (trapo catalog, cosmetic items) → PostgreSQL table, cached in Nakama's
  storage for client delivery.

**Pitfall:** Nakama Storage Objects are JSON blobs. Complex queries across objects require
careful indexing or moving data to raw PostgreSQL tables. For the territory map (Argentina),
use a denormalized territory state table in PostgreSQL directly — Nakama's storage query API
is not ideal for spatial/graph queries across all territories.

**Alternative:** Redis for session cache and real-time territory state (optional, add when
needed). Not required at MVP scale.

---

## 4. Push Notifications + Real-time Triggers

### Recommendation: Firebase Cloud Messaging (FCM) + Nakama Notification API

**Why FCM:**
- FCM covers both iOS (via APNs bridge) and Android with one API. Free tier is unlimited for
  basic push. No per-notification pricing.
- Integration path: Nakama server-side runtime sends FCM push directly via HTTP v1 API when
  match windows open, attacks land, or season events trigger. One server integration, covers
  both platforms.
- In-game notifications (attack received, trapo stolen): use Nakama's native notification
  system for in-app delivery. Use FCM only for background/push when app is closed.

**Trigger architecture:**
- Match window open (AFA fixture start time): scheduled job polls fixture data → triggers
  Nakama server function → sends FCM push to all affected club members.
- Attack received: Nakama match resolution hook → FCM push to defender.
- Season events (clásico double XP): cron job → Nakama server → FCM batch push.

**Argentine market concern:** FCM works in Argentina. Apple APNs requires your app to be
approved (content policy risk — see PITFALLS.md). No Argentina-specific push service needed.

**Pitfall (solo dev):** FCM v1 API replaced the legacy FCM API (deprecated June 2024, shut
down July 2024). Ensure any Nakama FCM plugin uses v1 API. [VERIFY Nakama's FCM integration
uses v1 API as of current version]

**Alternative:** OneSignal (free tier 10K subscribers, simpler dashboard). Good alternative
if Nakama-FCM integration is complex to set up. OneSignal abstracts FCM + APNs. Trade-off:
adds another vendor dependency.

---

## 5. AFA Fixture + Results Data

### Recommendation: API-Football (RapidAPI) — Free tier, then paid

**Why API-Football:**
- API-Football (api-football.com, distributed via RapidAPI) covers Argentine Primera División,
  Primera Nacional (B Nacional), and cup competitions.
- Free tier: 100 requests/day. Sufficient for polling fixture schedules (which change weekly
  at most) and match results (one result per match, ~30 AFA Primera matches/round).
- Paid tier: ~$10-15/month for 500 req/day or more. Affordable even pre-revenue.
- Data includes: fixture schedules, kickoff times (critical for battle windows), live scores
  (for mid-match state), final results (for winner buff logic).
- API stability: well-established, used by many apps. Has been operating since ~2018.

**Integration pattern:**
1. Poll fixture schedule once per week (Monday morning) → cache in PostgreSQL.
2. Poll live score endpoint every 5 minutes during active match windows → update match state.
3. On final whistle (status = "FT"): trigger winner buff computation server-side.
4. Expose fixture data to clients via Nakama RPC (don't expose raw API-Football to clients).

**Alternative: SofaScore unofficial API**
- SofaScore has no official public API. Any "SofaScore API" is scraping with reverse-
  engineered endpoints. Legally risky (ToS violation), fragile (breaks on frontend changes).
  Do not use for a commercial product.

**Alternative: Scraping afa.com.ar**
- AFA's website is minimally maintained. Scraping is fragile, legally uncertain under
  Argentine law, and AFA does not publish machine-readable data. Avoid as primary source.
  Can use as a validation fallback only.

**Alternative: Football-data.org**
- Free tier covers major European leagues. Argentine coverage is limited or absent in the
  free tier. Less suitable than API-Football for this project.

**Pitfall:** API-Football's Argentine timezone handling: fixture times are in UTC. Argentina
is UTC-3 (no daylight saving since 2008). Convert all fixture times to America/Argentina/
Buenos_Aires on the server before storing and computing battle windows.

**Pitfall (solo dev):** API-Football coverage of lower AFA divisions (Nacional B, Primera C)
may be incomplete. For v1, limit to Primera División (26 clubs). Expand later.

**Legal note:** Using a licensed API aggregator like API-Football is legally safer than
scraping AFA directly. API-Football licenses data from official sources. However, check
their ToS for commercial app use. [VERIFY API-Football commercial use terms]

---

## 6. Geo-location Service

### Recommendation: Native device GPS via Godot geo-location plugin (no third-party service)

**Why no third-party service:**
- Stadium proximity check is a simple radius calculation. Given a list of ~26 AFA Primera
  División stadium coordinates (hardcoded or fetched once), check if device GPS position is
  within X meters (e.g., 500m) of the nearest stadium on match day.
- No need for Google Maps API, Mapbox, or HERE — those are for map rendering and routing.
  A distance calculation is pure math on lat/lng coordinates (Haversine formula).
- Zero ongoing cost. Zero API dependency.

**Implementation:**
1. Request location permission (Android: ACCESS_FINE_LOCATION, iOS: NSLocationWhenInUseUsageDescription).
2. Get one-shot position reading (not continuous tracking) — reduces battery drain and
   privacy surface.
3. Server-side validation: client sends claimed position + timestamp. Server independently
   verifies the claim is plausible (not teleporting, not in wrong timezone, etc.). Never
   trust client position alone for bonus granting.
4. Argentine privacy law compliance: Ley 25.326 (Personal Data Protection) requires informed
   consent for location data. Show clear consent dialog explaining geo-bonus purpose. Store
   no persistent location data — use only for point-in-time validation.

**Map of Argentina (interactive territory map):**
- Render the territory map inside Godot using a static background image of Argentina divided
  into provinces/regions as a TileMap or polygon overlay. No third-party map SDK needed.
- Territory ownership state is stored server-side in Nakama/PostgreSQL and pushed to
  clients via Nakama real-time socket updates.
- For MVP: stylized cartoon map, not satellite. No Mapbox needed.

**Godot GPS plugin:** Godot 4 requires an Android plugin for GPS. Options:
- godot-android-plugin (community). Review GitHub for Godot 4.x compatibility. [VERIFY]
- iOS: CLLocationManager via GDNative/Swift bridge. More complex — budget extra time.

**Pitfall (solo dev):** iOS location permission requires privacy usage descriptions in
Info.plist and App Store review scrutiny. Keep location use minimal and clearly explained.
Anti-cheat: never give bonus if location permission is denied — just skip the bonus, don't
block gameplay. Location should be optional-but-rewarding per project requirements.

---

## 7. Asset Pipeline + Cosmetic System

### Recommendation: Godot's built-in Resource system + Cloudflare R2 (S3-compatible CDN)

**Asset pipeline strategy:**

**Static assets (shipped in app):**
- Core game assets (UI, character base sprites, stadium backgrounds, map): bundled in Godot
  export. Godot's import pipeline handles PNG/WebP spritesheets, audio (OGG), fonts.
- Initial trapo catalog (launch cosmetics): bundle ~50-100 trapos in-app to avoid CDN
  dependency for core content.

**Dynamic assets (cosmetic drops, new trapos):**
- New cosmetics released post-launch: stored on Cloudflare R2 (S3-compatible object storage).
- R2 pricing: free egress (unlike S3), $0.015/GB storage. For image assets, costs are
  negligible at thousands of users.
- Asset manifest: Nakama storage holds the cosmetic catalog (JSON: item ID, CDN URL,
  unlock condition, price in Moneda Premium). Client fetches manifest on login, downloads
  new assets on demand.
- Godot's HTTPClient downloads assets at runtime. Cache locally on device using
  user://cache/ directory.

**User-generated trapos (custom banners):**
- Client renders trapo preview locally using Godot's Image API (text on template).
- On submission: upload PNG to Cloudflare R2 via signed URL (server generates URL, client
  uploads directly — server never handles the binary).
- Moderation queue: flag all UGC. Run async moderation (see below) before making visible.
- Never serve UGC directly from your origin. Always from R2/CDN to isolate attack surface.

**UGC Moderation:**
- Text moderation: server-side before accepting trapo name/text. Use a lightweight profanity
  filter library (Node.js: bad-words or similar) in Nakama TypeScript runtime.
- Image moderation: Google Cloud Vision SafeSearch API (free tier: 1,000 units/month) or
  Amazon Rekognition. Flag NSFW content before publishing. [VERIFY pricing tiers]
- Human review queue for edge cases. As solo dev, accept that some manual review is needed
  daily. Consider limiting custom trapos to trusted/verified accounts initially.

**Pitfall (solo dev):** UGC moderation at scale is a full-time job. Keep custom trapo
creation behind a progression gate (unlock after X aguante points) to limit volume early.

---

## 8. IAP + Analytics

### Recommendation: RevenueCat + GameAnalytics

**In-App Purchases: RevenueCat**

**Version:** RevenueCat SDK 5.x (check current version) [VERIFY]

**Why RevenueCat:**
- Single SDK abstracts Apple StoreKit 2 and Google Play Billing 6+. Without RevenueCat,
  you write and maintain two separate billing integrations.
- Handles receipt validation server-side (critical: never validate receipts client-side).
- Entitlements system: map purchases to unlocked cosmetics cleanly.
- Free tier: up to $2,500 MTR (monthly tracked revenue) at no cost. This covers the entire
  early phase.
- Dashboard: subscription analytics, refund tracking, conversion funnels out of the box.
- Godot integration: RevenueCat does not have an official Godot SDK. You will need to call
  RevenueCat's REST API from the Nakama server-side runtime after native purchase is
  confirmed via platform plugin. Pattern:
  1. Client completes native IAP (via Godot IAP plugin).
  2. Client sends receipt to Nakama server-side RPC.
  3. Nakama RPC validates receipt with RevenueCat API.
  4. Nakama credits Moneda Premium to player wallet.
  This is the correct architecture — never credit currency client-side.

**Argentine market concern — MercadoPago:**
- Apple App Store and Google Play do NOT integrate with MercadoPago directly for IAP.
  All iOS IAP goes through Apple ID payment method (credit card, MercadoPago Checkout Pro
  is not an Apple option). Google Play allows local payment methods in Argentina — Google
  Play accepts Mercado Pago as a payment method in Argentina (as of recent years) [VERIFY
  current Google Play Argentina payment method support]. This is Google's problem, not yours
  — you receive payouts in USD from Google/Apple. RevenueCat handles this transparently.
- Argentine peso inflation: IAP prices are set in USD on both stores. Apple and Google
  convert at local rates. In hyperinflationary Argentina, stores adjust local prices
  periodically. You set USD price, stores handle conversion. RevenueCat tracks revenue in USD.
  No special handling needed from your side.
- Apple App Store Argentina: fully operational. Google Play Argentina: fully operational.
  Both accept local cards. [VERIFY no new store restrictions as of 2026]

**Analytics: GameAnalytics**

**Why GameAnalytics:**
- Free tier: unlimited events, 5 million monthly users. Designed specifically for games.
- Built-in: DAU/WAU/MAU, session length, retention cohorts, funnel analysis, resource
  flow (Moneda Premium earned/spent), progression events. All relevant to BarraBrava's
  economy.
- Godot SDK: available (community-maintained, check Godot 4 compatibility). [VERIFY]
- Supplement with RevenueCat's built-in revenue analytics for IAP metrics.

**Alternative:** Firebase Analytics — free, tight FCM integration, but less game-specific.
Amplitude — powerful but expensive at scale. Use GameAnalytics as primary, add Firebase
Analytics for push notification attribution if needed (free anyway).

**Pitfall (solo dev):** Don't over-instrument. Start with: session start/end, IAP purchase,
resource delta events (aguante gained/lost, trapo stolen). Add more events once you have
a question to answer.

---

## 9. CDN + Asset Hosting

### Recommendation: Cloudflare R2 + Cloudflare CDN

**Why Cloudflare R2:**
- Zero egress fees. This is the killer feature vs AWS S3 or GCP Cloud Storage, which charge
  per GB of outbound traffic. For a game serving cosmetic images to mobile clients, egress
  is the dominant cost.
- Storage: $0.015/GB/month. At 1,000 cosmetic assets averaging 200KB each = 200MB = $0.003/
  month. Negligible.
- S3-compatible API: standard tooling works.
- R2 public buckets are served via Cloudflare's global CDN automatically. Brazilian/Argentine
  PoPs (São Paulo, Buenos Aires) mean fast delivery to target audience.
- Workers integration: if you need server-side asset transforms (resizing trapo images), use
  Cloudflare Workers + R2. Generous free tier (100K requests/day free).

**Signed URL pattern for UGC uploads:**
Nakama server generates a pre-signed R2 upload URL → returns URL to client → client uploads
binary directly to R2 → Nakama gets upload completion callback via R2 event notification →
triggers moderation pipeline.

**Alternative:** AWS S3 + CloudFront. More expensive (egress fees), more complex, overkill
at early scale. Consider when you need AWS-specific services (Rekognition for moderation).

**Alternative:** Bunny.net CDN. Also zero/near-zero egress pricing, simpler UI, Argentina
PoP available. Valid alternative to Cloudflare R2 if you prefer a simpler storage product.

---

## 10. CI/CD + Store Submission

### Recommendation: GitHub Actions + Fastlane (iOS) + Google Play API (Android)

**Why this stack:**

**GitHub Actions:**
- Free tier: 2,000 minutes/month (Linux), 0 minutes free for macOS. iOS builds require
  macOS runners, which consume minutes quickly.
- Strategy: Android builds on Linux runners (free). iOS builds either on macOS self-hosted
  runner (your own Mac) or GitHub Actions macOS (paid minutes). As a solo dev, building
  iOS locally and submitting via Fastlane from your Mac is fine for v1.
- Triggers: push to `main` → Android build + upload to Play internal track. Tag push →
  iOS Archive + TestFlight upload.

**Fastlane:**
- Automates iOS code signing (match), TestFlight uploads, App Store submissions.
- Android: automates Play Store track promotions via supply plugin.
- Godot export: use Godot's command-line export (godot --export-release) in CI pipeline.
  Godot 4 supports headless export via CLI with export templates.

**Godot-specific CI:**
- Use the `abadie/godot` Docker image (or official Godot CI Docker images) for Linux-based
  Godot builds in GitHub Actions. [VERIFY current recommended CI Docker image for Godot 4.3]
- Export templates must be installed in the CI image for headless export.

**Alternative: Expo EAS** — only relevant for React Native/Expo projects. Not applicable for
Godot.

**Argentine market concern:** Google Play internal testing track → Argentina device testing.
Ensure your closed beta includes Argentine testers (Buenos Aires, Córdoba, Rosario) to
validate latency, device compatibility (Motorola, Samsung mid-range), and Spanish locale.

**Pitfall (solo dev):** iOS CI on GitHub-hosted macOS runners is expensive (~10x Linux).
Use your own Mac as a self-hosted runner for iOS builds to keep CI costs near zero.

**Pitfall:** Godot 4's Android export requires setting up the Android SDK, NDK, and JDK in
the CI environment. Use a pre-built Docker image that includes these. Plan 1-2 days for
CI pipeline setup.

---

## MVP End-to-End Path (v1)

This is the concrete path from zero to a playable multiplayer game:

```
DEVELOPMENT MACHINE SETUP
├── Godot 4.3 installed locally
├── Android SDK + NDK configured (via Android Studio or sdkmanager)
├── Xcode installed (macOS required for iOS builds)
└── Docker Desktop for local Nakama stack

LOCAL STACK (development)
├── Nakama + PostgreSQL via Docker Compose
├── Nakama TypeScript runtime (custom match logic, RPC hooks)
├── Local fixture data seeded from API-Football JSON

GODOT CLIENT
├── nakama-godot SDK integrated
├── Scenes: LoginScreen, ClubSelect, BaseView (cancha), MapView, AttackPlan, CosmicShop
├── Native GPS plugin integrated for Android (iOS added in sprint 2)
├── FCM push plugin integrated
├── IAP plugin integrated (Android first, iOS after)

BACKEND SERVICES
├── Nakama (Railway $20/mo): player auth, groups, leaderboards, notifications, wallets
├── PostgreSQL (Nakama-managed): all player state
├── Cloudflare R2: cosmetic assets, UGC trapos
├── API-Football cron: weekly fixture sync + live score polling during matches

EXTERNAL INTEGRATIONS
├── Firebase project: FCM push certificates (iOS + Android)
├── RevenueCat: receipt validation + entitlements
├── GameAnalytics: event tracking

CI/CD
├── GitHub repo → GitHub Actions
├── Android: Linux runner → APK → Play internal track
├── iOS: local Mac + Fastlane → IPA → TestFlight

TOTAL MONTHLY COST AT LAUNCH (est.)
├── Railway (Nakama + Postgres): ~$20-40/month
├── API-Football: $0 (free tier covers ~100 req/day)
├── Cloudflare R2: <$1/month (tiny asset volume at launch)
├── GameAnalytics: $0 (free tier)
├── RevenueCat: $0 (free tier up to $2,500 MTR)
├── Firebase FCM: $0 (free tier)
├── GitHub Actions: $0 (Linux) + local Mac for iOS
└── TOTAL: ~$20-40/month until revenue justifies scaling
```

---

## Summary Table

| Layer | Recommended | Version | License/Cost | Confidence |
|-------|-------------|---------|--------------|------------|
| Game engine | Godot | 4.3+ | MIT, free | HIGH |
| Backend | Nakama | 3.x | Apache 2.0 / hosted | MEDIUM [VERIFY Godot 4 SDK status] |
| Database | PostgreSQL | 16 (Nakama-managed) | Open source | HIGH |
| Push | FCM via Firebase | v1 API | Free tier | HIGH |
| Fixture data | API-Football | current | $0 free tier | MEDIUM [VERIFY AFA coverage] |
| Geo-location | Native GPS (no third party) | platform native | Free | HIGH |
| Asset CDN | Cloudflare R2 | current | $0.015/GB, free egress | HIGH |
| IAP validation | RevenueCat | 5.x | Free <$2.5K MTR | MEDIUM [VERIFY Godot integration path] |
| Analytics | GameAnalytics | current | Free | MEDIUM [VERIFY Godot 4 SDK] |
| CI/CD | GitHub Actions + Fastlane | current | Free (Linux) | HIGH |

---

## Argentine Market Specific Notes

| Concern | Assessment | Mitigation |
|---------|-----------|------------|
| Device landscape | Mid-range Android dominates (Motorola Moto G, Samsung A series). Low RAM (2-3 GB common). | Godot's small binary + 2D renderer fits. Target minimum 2GB RAM. Test on Moto G Power spec. |
| Network quality | 4G LTE widespread in AMBA (Buenos Aires metro). 3G in interior. Wi-Fi in homes. | Clash of Clans tempo = tolerates high latency. Design for 200-300ms round trips gracefully. |
| Payment methods | MercadoPago dominant. Not available for Apple IAP. Google Play accepts MP in AR. | Revenue from both stores. No MercadoPago SDK integration needed on your side. |
| App Store availability | Both stores fully operational in Argentina. | No special handling needed. |
| Data privacy (Ley 25.326) | Argentine data protection law requires consent for location, notification opt-in. | Show explicit consent dialogs. No persistent location storage. FCM opt-in. |
| Content moderation | AGESIC/ENACOM not specifically relevant but App Store/Google Play content policies apply globally. | UGC gates, profanity filters, image moderation pipeline. |
| Latency to server | Argentina → São Paulo (AWS sa-east-1 or Railway SA): ~25-60ms | Acceptable for strategic game tempo. |
| Spanish localization | 100% required. Argentine Spanish (vos, lunfardo, "pibe", "cancha") is core identity. | Ship only in es-AR. Avoid "neutral" Spanish that sounds foreign. |

---

## Items Requiring Human Verification Before Coding [VERIFY Checklist]

1. **Godot 4 iOS/Android IAP plugins:** Confirm current best Godot 4.x IAP plugin (community vs paying for GodotSteam's mobile equivalent). Check GitHub for active maintenance as of 2026.
2. **nakama-godot SDK:** Confirm Godot 4.3 compatibility of official nakama-godot SDK. Check GitHub heroiclabs/nakama-godot.
3. **Unity Runtime Fee status 2026:** Confirm current Unity Personal tier terms if Unity is reconsidered.
4. **API-Football Argentine coverage:** Create free account and verify AFA Primera División fixture data quality and completeness.
5. **Railway.app SA region:** Confirm São Paulo region availability and pricing on current Railway plans.
6. **Fly.io vs Railway for Nakama:** Compare current pricing — both have changed pricing models in 2024-2025.
7. **RevenueCat Godot integration:** Confirm whether RevenueCat now has a Godot SDK (was absent as of mid-2025) or validate the server-side REST API integration path.
8. **GameAnalytics Godot 4 SDK:** Check godot-analytics or GameAnalytics GitHub for Godot 4.x plugin status.
9. **FCM v1 API in Nakama:** Confirm Nakama's notification sender uses FCM v1 API (legacy was deprecated July 2024).
10. **Google Play MercadoPago Argentina:** Verify current payment method availability in Google Play Store Argentina.

---

## Sources

All findings based on training data through August 2025. Web verification was unavailable
during this research session due to tool restrictions. Confidence levels reflect this.

Primary knowledge sources used:
- Godot 4.x official documentation (training data)
- Nakama documentation and GitHub (heroiclabs/nakama, heroiclabs/nakama-godot)
- RevenueCat documentation (revenuecat.com)
- Cloudflare R2 documentation
- API-Football (api-football.com) feature set
- Firebase Cloud Messaging v1 API documentation
- GameAnalytics documentation
- Fastlane documentation (fastlane.tools)
- Unity Runtime Fee controversy coverage (September 2023 onward)
- Argentine mobile market research (CÁMARA ARGENTINA DE COMERCIO ELECTRÓNICO reports)
- Argentine data protection: Ley 25.326

**Note on Unity Runtime Fee:** Unity announced in September 2023 a per-install runtime fee
that caused significant developer backlash. By November 2023 Unity had significantly walked
back the policy for Unity Personal tier users (revenue under $200K/year). However, the
incident demonstrated Unity's willingness to change licensing terms on shipping products.
For a solo dev with no capital, Godot's MIT license eliminates this class of risk entirely.
This is the primary reason Godot is recommended over Unity, not technical capability.
