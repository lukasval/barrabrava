# Research Summary — BarraBrava

**Synthesized:** 2026-05-14
**Inputs:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Stack (Recommended)

| Layer | Pick | Cost MVP |
|-------|------|----------|
| Game client | **Godot 4.3** (MIT, no runtime fee) | $0 |
| Backend multiplayer | **Nakama 3.x** self-host on Railway São Paulo | ~$20-40/mo |
| Database | **PostgreSQL 16** (bundled w/ Nakama) | included |
| Push | **FCM v1 API** + Nakama Notifications | $0 |
| Fixture data | **API-Football** (RapidAPI) free tier | $0 (paid ~$15/mo at scale) |
| Geo-location | **Native GPS** + server-side validation (no third party) | $0 |
| Asset CDN | **Cloudflare R2** (zero egress) | <$1/mo |
| IAP | **RevenueCat** REST API (server-side validation) | $0 until $2.5K MTR |
| Analytics | **GameAnalytics** free tier | $0 |
| CI/CD | **GitHub Actions** (Linux free) + Fastlane (local Mac) | $0 |

**Total infra MVP: ~$20-40/month**

**Key VERIFY items before coding:**
- nakama-godot SDK Godot 4.x maturity
- Godot 4 mobile IAP/GPS plugin status
- RevenueCat Godot integration path
- API-Football AFA Primera coverage quality

---

## Feature Architecture (Core Loop)

**The game's spine:**
1. **AFA Fixture Feed (F-090) is foundational** — every system depends on it
2. **Match Window** opens 2h before kickoff, closes 2h after final whistle
3. **Live match window (90 min)** = peak engagement: doubled rewards, faster combat
4. **Real result bonus** propagates to all club members for 6h post-match
5. **Season** = AFA Apertura or Clausura. Champion → next season buff. Relegation → penalty.

**Player loop:**
- Pick club (real AFA Primera) → create pibe → enter barra hierarchy at lowest rung
- Build rancho (base) + recruit roster of role-based pibes
- **Día de partido**: turno de barra (work shift) → genera pozo grupal + prestigio
- **Días sin partido**: profesión libre → plata personal → cosméticos
- Plan ambushes during match windows → win/lose Aguante, Trapos, pibes
- Scale through hierarchy: trapito → vendedor → patovica → trompada → mano derecha → capo → líder

**Reference DNA:**
- Clash of Clans: base + async raids + clan wars + resources
- Hooligans: Storm Over Europe: tactical ambush planning, roles, intel
- Fortnite: cosmetic monetization + battle pass
- Pokémon GO: stadium geo-bonus
- FIFA Mobile: real fixture calendar tie-in
- Mafia City: free-for-all territorial wars
- *Original layer*: Carrera con trabajos + Mesa Chica democracy

**MVP must-have features (table stakes):** F-001/2/3 (onboarding), F-010/11 (rancho+aguante), F-020/21 (pibes+roles), F-030/31/32 (combat), F-040/41 (trapos), F-050/51/52 (heat/cana/abogado), F-060/61 (territory map), F-070/71 (club hierarchy), F-080/82 (seasons), F-090 (AFA feed), F-100 (auto-feed), F-120/121/122 (moderation), **+ Sistema Carrera (trabajos + Mesa Chica)**.

**Defer to post-MVP:** Custom trapo UGC (F-043), GPS geo-bonus (F-093), Selección events (F-094), audio cántico recording (F-114), advanced formations (F-036/37).

---

## Architecture (Server-Authoritative, Managed-Services-First)

**Client is a display terminal. Server decides everything that matters.**

**Core services:**
- **Scheduler** (cron + pg_notify) — AFA poll, match window triggers, season transitions, heat decay
- **Combat Engine** — plan validation, async resolution, outcome storage, permadeath logic
- **Player State** — pibe roster, resources, heat status, hierarchy position, profession progress
- **World State** — territory ownership, zone control (Redis-cached, 60s TTL)
- **Social Feed** — combat events, trapo theft virality, replay seeds
- **Commerce** — IAP receipt validation, premium currency ledger, cosmetic entitlements
- **Moderation** — UGC queue, image classifier integration, report triage

**Server decides:** resources, combat outcomes, match windows, permadeath, GPS bonus eligibility, IAP entitlements, heat escalation, territory ownership, season transitions.

**Client decides:** UI nav, replay rendering (from server seed), cosmetic effects, asset prefetch.

**Realtime channels:**
- WebSocket (only when player in match-window screen) — battery-conscious
- Push notifications (FCM topics per club + direct tokens for personal events)
- REST for everything else

**Build order (22-week solo dev path):**
- Weeks 1-2: Auth + schema + club seed + player creation
- Weeks 3-6: AFA Scheduler + match windows + basic combat + FCM
- Weeks 7-10: Territory + GPS + social feed + permadeath + heat
- Weeks 11-14: IAP + entitlements + CDN + battle pass
- Weeks 15-18: UGC trapos + moderation pipeline + reports
- Weeks 19-22: Season transitions + leaderboards + replay + hierarchy mechanics

**Disaster handling already designed:** AFA feed death = pre-cached windows continue, manual override admin panel; FCM outage = TTL'd messages, in-app banner fallback; DB load = Redis read cache + rate limiting.

---

## Pitfalls (Things That Kill This Project)

### 5 CRITICAL (will sink the launch if not addressed)

1. **Real club trademark infringement** — DO NOT use AFA escudos/names/kits directly. Solution: parodic stylized identities + lunfardo nicknames + optional "Liga Aguante" fictional umbrella. Consult Argentine IP lawyer 1h pre-launch.

2. **App Store "gang violence" rejection** — naming systems in obvious violence language triggers Apple/Google. Solution: rename combat in lunfardo euphemisms, lead store listing with strategy/culture not combat, prepare review-context press kit, target PEGI 12 / ESRB T.

3. **AFA feed instability** — no official API, postponements common. Solution: API-Football paid tier + AFA Twitter as fallback + manual admin override panel + cached fixtures with 30-min TTL + "postponement mode" alternate window.

4. **GPS spoofing trivial on Android** — solution: speed plausibility checks, accuracy threshold <20m, IP geolocation cross-ref, jitter detection, treat as nice-to-have not competitive.

5. **UGC trapo abuse** — within 48h players upload Nazi symbols, slurs, political imagery, porn. Solution: pre-publication review queue + Hive/Sightengine automated classifier on every upload + v1 limited to vector/template customization (no raw image upload) + 3-strike community report removal.

### 7 HIGH (will erode but not kill)

6. **First-day population problem** — Solution: AI barra opponents indistinguishable from real players, soft launch Buenos Aires metro first, closed beta with Argentine football community 3 weeks pre-launch.
7. **Argentine purchasing power** — Solution: ARS-friendly tiers (ARS 500-1000 minimum), battle pass at Netflix Argentina price-anchor (~ARS 2-4K), Google/Apple local pricing matrix.
8. **Media backlash framing as crime glorification** — Solution: press FAQ pre-launch, "ficción" splash screen, no real names, proactive journalist outreach.
9. **Permadeath/emboscada system naming flags store reviewers** — Solution: rename in lunfardo, screenshots show celebration not combat.
10. **AFA calendar collapse** (strikes, format changes) — Solution: game season "inspired by" AFA not hard-locked, manual extension authority, off-season content automatic activation.
11. **Toxicity targeting** — Solution: no free text chat (preset reactions only), anonymous in-feed player names ("Pibe #147 de Boca"), Day-1 block/report system.
12. **Whale vs casual imbalance** — Solution: trapo collector achievements (cosmetic prestige), limited-time event-tied cosmetics, gifting loop.

### MEDIUM

13. **Loot box regulatory risk** if drops randomized → guaranteed specific items only, no gacha
14. **Backend cost explosion at viral scale** → billing alerts at $50/$100/$500, async combat resolution (not WS-per-player), Cloudflare Workers for hot paths
15. **iOS background location restrictions** → opt-in check-in pattern + geofencing for match-day notifications
16. **UTC time handling** → store everything UTC, display in user's TZ, "hora Buenos Aires" parenthetical
17. **Premature scale optimization** → managed monolith, no Kubernetes, optimize only on real bottlenecks
18. **Political minefields** (Boca-Macri, club-party associations) → all bonuses football-derived, never political
19. **Ley 25.326 compliance** → Spanish privacy policy + AAIP database registration + data deletion flow
20. **Third-party AFA data scale costs** → aggressive caching (30-min not 30-sec), single middleware cache layer

---

## Key Decisions Locked In

| Decision | Source | Why |
|----------|--------|-----|
| Godot 4 over Unity | STACK | License safety, smaller APK for Argentine low-end devices, simpler for solo dev |
| Nakama self-hosted São Paulo | STACK + ARCH | Game-purpose-built backend, low latency to Argentina, cost control |
| Server-authoritative everything | ARCH | Anti-cheat baseline, economy integrity |
| Async combat resolution, not real-time PvP | ARCH | Cost control, mobile battery, scope for solo dev |
| Match windows pre-cached, AFA feed is sync not control | ARCH + PITFALL | Resilience to data feed death |
| No free text chat ever | FEATURES + PITFALL | Moderation untenable solo, toxicity vector |
| UGC trapos vector-only v1, raw image v2 | FEATURES + PITFALL | Reduces moderation surface 10x |
| Parodic club identities + Liga Aguante umbrella | PITFALL | Trademark defense |
| ARS-priced cosmetics, ARS battle pass | PITFALL | Argentine market reality |
| AI opponents to solve Day-1 population | PITFALL | Launch viability |
| Cosmetic-only monetization, no gacha | PROJECT + PITFALL | Anti-P2W, anti-loot-box-regulation |
| Career system (trabajos + Mesa Chica) | DESIGN ITERATION | Daily engagement loop tied to real calendar, vertical progression |

---

## Critical Path to v1

```
PHASE 1 (foundation)
  Auth + Club selection + Pibe creation + Schema

PHASE 2 (heartbeat)
  AFA Scheduler + Match Window + Basic Combat + FCM

PHASE 3 (core loop)
  Rancho + Resources + Pibe roles + Trapo basics + Career system + Mesa Chica

PHASE 4 (world)
  Territory map + Heat/cana + Permadeath + Social feed

PHASE 5 (economy)
  IAP + Cosmetic entitlements + CDN + Battle pass

PHASE 6 (safety + season)
  UGC moderation (vector-only trapos) + Season transitions + Leaderboards + Replays
```

Geo-bonus, custom image trapos, Selección events, advanced formations → post-MVP validation.

---

## What Was Not Resolved

- Exact business entity / legal structure (LLC, Argentine SRL, etc.)
- Final art direction for parodied club identities (commission illustrator)
- Specific licensing budget for AFA optional license vs full parody route
- AAIP database registration timeline (2-4 weeks, must start before launch)
- Final ARS price points (needs current FX research at launch month)
- Web verification of all `[VERIFY]` items in STACK.md

These are decisions for the planning phase, not blockers to defining requirements + roadmap.
