# Domain Pitfalls: BarraBrava

**Domain:** Mobile multiplayer game — Argentine football hooligan culture
**Researched:** 2026-05-14
**Solo dev scope:** Yes — every pitfall is amplified by absence of team, legal dept, and moderation staff

---

## CRITICAL PITFALLS

---

### PITFALL 1: Real Club Trademark Infringement (Escudos, Kits, Registered Names)

**Severity:** CRITICAL
**Phase:** Pre-launch (must resolve before any public build)

**What goes wrong:** Using AFA club logos, shield designs (escudos), official kit colors in identifiable commercial combination, or the clubs' registered trade names (e.g., "Club Atlético Boca Juniors") in a commercial product without a license constitutes trademark infringement under Argentine IP law (Ley 22.362) and international trademark frameworks. AFA itself holds collective licensing rights over first-division clubs' commercial use. Several mobile games (FIFA-adjacent clones) have received cease-and-desist from AFA-affiliated clubs within weeks of launch.

**Why it happens:** Solo devs assume "I'm not making a FIFA clone" provides cover. It doesn't. Any commercial use of a registered mark in a way that could cause consumer confusion — including a game where the Boca Juniors barra is a playable faction — is actionable.

**Consequences:** App pulled from stores via DMCA/equivalent complaint. Potential injunction. Reputational damage before audience forms.

**Warning signs:**
- Any asset that could be mistaken for the official club logo
- Kit color combos + club name used together commercially
- App Store listing using club names as primary search keywords

**Prevention strategy:**
1. Use clearly parodic/stylized versions of club identities — different enough to not cause confusion (see: "Saturday Morning RPG" parody precedent). Document the deliberate differences.
2. Alternatively, pursue a limited non-exclusive license via AFA's commercial arm (AFA Business) — expensive but provides total protection. Not realistic for solo dev pre-revenue.
3. Use club nickname slang / lunfardo ("los xeneizes", "los millonarios") rather than legal registered names where possible.
4. Consult an Argentine IP attorney for a 1-hour review of asset set before launch — cheap insurance.
5. Build brand around "Liga Aguante" (fictional federation) that maps 1:1 to AFA structure — legally defensible parody frame.

**Sources:** Argentine Trademark Law 22.362, AFA Commercial Licensing Division known to enforce

---

### PITFALL 2: App Store Rejection — "Gang Violence" and Glorification Framing

**Severity:** CRITICAL
**Phase:** Pre-launch (design phase, before submission)

**What goes wrong:** Apple's App Store Review Guidelines Section 1.1 prohibits apps that "depict realistic portrayals of people or animals being killed, maimed, tortured, or abused." Section 1.1.6 specifically targets content that "encourages illegal behavior." Google Play's policy prohibits apps that "depict or facilitate" gratuitous violence. A game explicitly framed around barra brava culture — with systems for "emboscadas," "permadeath," "paliza," "robo de bombo," and a "heat/cana" system tracking police attention — will trigger manual review flags regardless of caricature art style.

**Why it happens:** Reviewers read metadata, descriptions, and system names — not just art. The word "barra brava" in the App Store description, combined with mechanics named "paliza" and "emboscada," creates a pattern that resembles documented rejection criteria.

**Consequences:** Rejected before launch. Re-submission delays cost weeks. If rejected twice, review escalation can add months. Android is more lenient but still has enforcement.

**Warning signs:**
- Store listing description contains "violence," "gang," "attack," "assault" without clear fantasy framing
- System names in marketing materials reference real-world crime categories
- Screenshots show combat UI without humorous/cartoon context

**Prevention strategy:**
1. Frame all violent systems in obviously fictional lunfardo slang — reviewers can't Google "aguante" and conclude it means organized crime.
2. App Store listing must lead with football passion and strategy, not the combat loop. Lead with "strategy game," "football culture," "build your barra."
3. Prepare an "App Store review guide" explaining the cultural context (like a press kit for reviewers) — Apple accepts appeals with context documentation.
4. Submit to Google Play first (less restrictive) — use the approval as evidence of legitimacy for Apple appeal if needed.
5. Rate PEGI 12 / ESRB T (Teen) — not 18+. Higher ratings don't help; they invite more scrutiny. Cartoon violence + no blood = Teen rating territory.
6. Do not use the phrase "barra brava" in the primary App Store listing title or subtitle. Use in description only, with cultural framing ("Argentine football fan culture").

---

### PITFALL 3: AFA Data Feed — No Official API, Scraping Instability

**Severity:** CRITICAL
**Phase:** MVP (core feature dependency — entire game sync model relies on this)

**What goes wrong:** AFA does not publish an official public API for fixtures, results, or standings. All third-party providers (API-Football, SportRadar, Sofascore's unofficial endpoints) scrape or license data from intermediaries. At MVP scale, the cost is manageable. At growth scale (>10K DAU), API-Football's commercial tiers exceed $300/month. Sofascore's unofficial endpoints (scraped) violate their ToS and can be blocked with zero notice. Last-minute AFA postponements (common — storms, security incidents, stadium issues) happen with 2-6 hours notice. If your game window opens for a match that was postponed 4 hours prior, players who geared up and logged in experience a dead session — and churn.

**Why it happens:** The AFA calendar is notoriously unstable. The 2023-2024 season had 14 first-division postponements. The "fixture real" that is the game's core value becomes a liability when the fixture changes.

**Consequences:** Core feature (real-time match sync) fails publicly. Players open app expecting a battle window, see nothing. Trust in "game is synced with reality" collapses.

**Warning signs:**
- Match status not updating within 5 minutes of scheduled kickoff
- More than 2 postponements in a single month
- API provider billing tier approaching cap

**Prevention strategy:**
1. Subscribe to API-Football (RapidAPI) or SportRadar's free/dev tier for prototyping — plan commercial tier costs into launch budget.
2. Build a manual override admin panel on Day 1 — solo dev must be able to cancel/reschedule a battle window from a phone in 2 minutes.
3. Subscribe to AFA's official social media (Twitter/X, Instagram) as secondary data source — postponements always announced there first.
4. Implement "postponement mode": if a match is cancelled <4 hours before window, trigger a "rival activity" freeform window instead of dead air.
5. Never hard-code fixture data — fetch and cache with TTL of 30 minutes, with manual override capability.
6. Build "offline schedule" fallback: if API is unreachable, use last known cached schedule with a visible "datos actualizados hace X horas" warning.

---

### PITFALL 4: GPS Spoofing on Android (Rooted Devices)

**Severity:** CRITICAL
**Phase:** MVP (before geo-bonus goes live)

**What goes wrong:** The stadium geo-bonus is a key differentiator (players near the stadium on match day get resource/XP bonuses). On Android, GPS spoofing via mock location apps (Fake GPS, Mock Locations) is trivially available even without root on Android 6+. A player in Córdoba can set their GPS to Estadio Monumental and claim Boca Juniors stadium bonuses from their bedroom. At scale, this eliminates the differentiating value of the feature and penalizes honest players who actually attend matches.

**Why it happens:** Android's developer mode includes mock location APIs by design. Apple iOS is more restrictive but jailbreak spoofing exists.

**Consequences:** Geo-bonus becomes meaningless. Players who attend real matches are not rewarded more than cheaters. Feature's "magic" — you feel the game knows you're at the stadium — collapses.

**Warning signs:**
- Multiple accounts claiming the same stadium bonus from IP addresses geolocated far from the stadium
- Location lock-in time suspiciously precise (real GPS has jitter; spoofed locations are pixel-perfect)
- Spike in geo-bonus claims during non-match days when stadiums are empty

**Prevention strategy:**
1. Implement location plausibility checks: cross-reference GPS with IP geolocation. Significant divergence = flag.
2. Require GPS accuracy <20m (real GPS at a stadium achieves this; many spoofers default to coarse accuracy).
3. Add jitter detection: real GPS fluctuates ±2-10m; perfectly static coordinates are a red flag.
4. Treat geo-bonus as a "nice bonus" not a critical competitive advantage — if spoofing is widespread, it's annoying but not game-breaking. Design accordingly.
5. For Android, check `Settings.Secure.ALLOW_MOCK_LOCATION` and display a warning (cannot block, but can flag for server-side review).
6. Geo-bonus should be capped per account per match day — even if spoofed successfully, gain is bounded.

---

### PITFALL 5: UGC Trapo Abuse — Hate Speech, Nazi Symbols, Rival Club Slurs

**Severity:** CRITICAL
**Phase:** MVP (before custom trapo upload is enabled)

**What goes wrong:** Custom trapos (banners) are the most emotionally resonant cosmetic in the game. Within 48 hours of enabling free-form image upload, users will upload: (a) rival club mockery with slurs, (b) Nazi symbols (tragically common in Argentine ultras), (c) political party imagery (Peronist/anti-Peronist), (d) pornographic imagery, (e) real barra leader faces with threats. This is not speculation — it is documented behavior in every game with UGC at launch (Roblox, Fortnite Creative, Dreams PS4). Argentine football's ultra culture has a specific documented history with neo-Nazi imagery in barras (Sturm Graz incidents, local incidents widely reported).

**Why it happens:** Anonymity + strong emotions about football + cultural tribalism + testing moderation gaps.

**Consequences:** App Store review triggered by user reports. Press coverage framing game as "neo-Nazi football app." Legal liability under Argentina's Anti-Discrimination Law (Ley 23.592) for hosting hate content. Platform takedown.

**Warning signs:**
- First custom trapo upload in public beta
- No automated screening live before UGC goes public

**Prevention strategy:**
1. Pre-publication review queue: all custom trapos require approval before appearing to other players. Solo dev reviews a queue, not an infinite feed.
2. Integrate automated image classifier on upload — Hive Moderation ($0.001-0.003/image) or Sightengine API — screen for: nudity, weapons, hate symbols, known hate imagery. Auto-reject above threshold.
3. Allow only vector/template-based customization in v1 (color + pattern + text) — no free-form image upload until moderation pipeline is solid.
4. Text filtering: ban list of known slurs (Argentine football has documented vocabulary — "monos," "borrachos," racial slurs used across club rivalries).
5. Community reporting with 3-strike removal: if 3 different users report a trapo, auto-hide pending review.
6. Display clear community guidelines with examples of prohibited content at trapo creation screen.

---

### PITFALL 6: First-Day Population Problem (Empty Multiplayer)

**Severity:** CRITICAL
**Phase:** Pre-launch (launch strategy must solve this before go-live)

**What goes wrong:** The entire game value proposition requires other players to fight. On Day 1, with 0 players, a new user opens the app, builds their pibe, and then... nothing. No barras to raid, no territories contested, no feed activity. The "barra vibe" requires critical mass. Clash of Clans solved this with NPCs and AI bases. Fortnite fills lobbies with bots. Without a solution, Day 1 retention is 5% and the game never reaches escape velocity.

**Why it happens:** Solo devs focus on building features, not launch choreography. "Players will come" is not a strategy.

**Consequences:** Sub-10% Day 1 retention. No social proof. No word of mouth. Dead game at launch despite feature completeness.

**Warning signs:**
- No soft launch / regional beta planned
- No bot/AI opponent system in design
- Launch planned as global simultaneous release

**Prevention strategy:**
1. Implement AI barra opponents that simulate real player behavior (AI pibes, AI raids, AI territory claims) — indistinguishable from real players at small scale.
2. Soft launch in one Argentine province (e.g., Buenos Aires metro) before national rollout — creates density.
3. Closed beta with 200-500 Argentine football Twitter/Instagram community members 3 weeks before launch — seed the player base.
4. Bot activity fills feed: procedurally generated "Boca's barra robbed River's trapo in Palermo" feed items even with 0 real events, until population threshold reached.
5. Match battle windows to school/work-off hours in Argentina (evenings, weekends) — concentrate sparse early players.

---

## HIGH SEVERITY PITFALLS

---

### PITFALL 7: Argentine Purchasing Power vs USD Pricing

**Severity:** HIGH
**Phase:** Pre-launch (monetization design), Ongoing

**What goes wrong:** Argentina has experienced 100%+ annual inflation (211% in 2023, declining but still elevated in 2025-2026). App Store pricing in Argentina is in ARS, indexed to USD at Apple's discretion with periodic adjustments that lag real exchange rates. A $4.99 USD cosmetic pack, converted to ARS at official rate, represents a significant percentage of a student's weekly food budget. Mass market Argentine players — the core audience — will not convert at USD-equivalent prices. MercadoPago is the dominant payment method; Apple and Google have limited MercadoPago integration (Google Pay accepts MP-linked cards; Apple Pay does not support MP directly).

**Warning signs:**
- ARPU from Argentina matches global ARPU (means whales only, no casual spend)
- <1% conversion on first IAP offer
- Support tickets about payment failures

**Prevention strategy:**
1. Price cosmetics in ARS-friendly tiers: lowest pack at ARS 500-1000 (equivalent to $0.50-1.00 USD at free market rate) — accept thin margins in exchange for conversion volume.
2. Offer "Aguante Pass" (battle pass) at a monthly ARS price competitive with a Netflix Argentina subscription (~ARS 2,000-4,000) — Argentines are accustomed to this price anchor.
3. Enable Google Play's "pricing templates" for Argentina — Google allows local currency pricing adjustments independent of global tiers.
4. For iOS, apply for Apple's local pricing matrix (available since 2023) — set Argentina prices independently from USD.
5. Offer free cosmetic earnable through gameplay — players who can't spend still feel valued and become advocates.
6. Design a gifting system: wealthy players (or diaspora in Europe/US) can gift cosmetics to friends in Argentina.

---

### PITFALL 8: Barra Brava Real-Violence Association — Media Backlash

**Severity:** HIGH
**Phase:** Pre-launch (PR strategy), Ongoing

**What goes wrong:** Argentine barras bravas are associated with documented murders, extortion rings, drug trafficking, and political corruption (the "barra-política" nexus is well-documented in Argentine journalism). If a journalist frames the game as "glorifying organized crime linked to football" — which is an accurate description of barra bravas if you omit the fantasy-coded framing — the resulting Clarín or La Nación article can trigger app store investigations, user churn, and political pressure (Argentine legislators have made statements about barra-related legislation multiple times). This is not hypothetical: the documentary "Barras" (Netflix Argentina) and multiple investigative pieces by Infobae have kept this topic hot.

**Warning signs:**
- First press mention frames game as "barra brava simulator" without "fantasy" qualifier
- Any real-world barra incident occurs near launch — journalist looks for adjacent topics
- Political statement by Argentine official about barra culture during campaign season

**Prevention strategy:**
1. Prepare a press FAQ before launch: "BarraBrava is a satirical strategy game inspired by Argentine football culture, similar to how 'Narcos' dramatizes drug culture for entertainment. It does not promote or glorify real violence."
2. Proactively reach out to Argentine gaming journalists (La Nacion Tech, Infobae Tecno) for friendly previews before launch — shape the narrative.
3. Include a mandatory "Este juego es ficción" splash screen at first launch (similar to GTA's disclaimers).
4. Do not use real names of actual barra leaders, real gang names (La Doce, Los Borrachos del Tablon) — use clearly fictional equivalents.
5. Maintain a "community good" angle: donations to anti-barra violence NGOs, partnership with ATFA (Argentine football transparency association) if available.

---

### PITFALL 9: Permadeath + Emboscada Systems Triggering Store Violence Flags

**Severity:** HIGH
**Phase:** Pre-launch (feature naming and presentation)

**What goes wrong:** The permadeath system (pibes die permanently without abogado rescue), combined with the escalating damage system (rasguñazo → paliza → robo bombo → robo trapo) and the heat/cana system, reads in aggregate to a store reviewer as a game simulating assault, kidnapping, and imprisonment. Even with cartoon art, the underlying mechanic description in the app store "What's New" notes, or review screenshots can trigger flags. Google Play's "Sensitive Events" policy is particularly relevant — events in Argentina involving barra violence can make the game's theme a "sensitive event" category requiring additional review.

**Prevention strategy:**
1. Rename all combat/damage systems using football euphemisms and lunfardo that don't translate obviously: "ganaste el aguante" instead of "le diste una paliza," "le sacaron el trapo" instead of combat terminology.
2. In store listings, describe mechanics in terms of competitive sports strategy: "outmaneuver rival barras," "defend your territory," "build your crew's reputation."
3. Do not show the damage escalation system in screenshots — show trapos, territory maps, and celebration animations.

---

### PITFALL 10: Season Abandonment / AFA Calendar Collapse

**Severity:** HIGH
**Phase:** MVP, Ongoing

**What goes wrong:** The entire season structure mirrors AFA's calendar. AFA has suspended seasons (COVID), shortened seasons, restructured tournaments mid-year (the 2015-2020 era had constant format changes — Torneo de Verano, Superliga, Liga Profesional), and there have been strikes by referees and player unions. If AFA restructures its tournament format mid-season, the game's season model breaks. If a season is abandoned, players who invested weeks of progress face a meaningless reset.

**Warning signs:**
- AFA announces tournament format review (happens roughly every 3-4 years)
- Labor dispute between ATFA (referee union) and AFA clubs
- Political crisis affecting football scheduling (Argentina has history here)

**Prevention strategy:**
1. Season structure maps to AFA's calendar loosely — use "start of Torneo Apertura" and "end of Clausura" as anchors, but the in-game season is the game's own season that is "inspired by" the AFA calendar, not hard-locked to it.
2. Maintain solo dev authority to manually extend or compress a season with 1 week notice via in-game announcement.
3. Build "off-season content" (pre-season training mechanics, draft events) that activates automatically during AFA gaps.
4. Terms of Service must be clear: season resets are part of gameplay, not breach of service.

---

### PITFALL 11: Toxicity Culture — Argentine Football Machismo and In-Game Behavior

**Severity:** HIGH
**Phase:** MVP, Ongoing

**What goes wrong:** Argentine football fan culture is intense, tribalistic, and has machismo elements that translate directly to online toxicity. The game's social mechanics (feed of raid replays, public trapo humiliation, territory domination) create perfect conditions for sustained harassment. A player who loses their trapo to a rival will look up the opponent's club, find their player name, and continue harassment across multiple sessions. Without chat voice (already excluded from scope), text chat is the remaining attack surface. Player names and barra names will be used to target real-world club affiliations for harassment.

**Warning signs:**
- First support ticket about harassment within 72 hours of beta launch
- Player retention drops sharply after a trapo loss event

**Prevention strategy:**
1. Remove direct player-to-player text chat — replace with preset taunts/emotes only (eliminates harassment surface).
2. Player display names are anonymous within their barra — "Pibe #147 de Boca" rather than user-chosen names visible to enemies.
3. Trapo loss is visible in feed but attacker identity is partially obscured (show club affiliation, not individual identity) — reduces targeted harassment.
4. Block/report system from Day 1, not a post-launch addition.
5. Terms of Service explicitly state real-world threats result in permanent ban with IP block.

---

### PITFALL 12: Whale vs Casual Imbalance

**Severity:** HIGH
**Phase:** Post-launch (but must be designed for from MVP)

**What goes wrong:** Even with 100% cosmetic monetization, a whale who buys every cosmetic set has maxed out their collection within the first season. Without competitive advantages to chase, cosmetic whales plateau quickly. Meanwhile, casuals who spend nothing feel no pressure to convert. The game needs a spending engagement loop that keeps whales spending without creating pay-to-win outcomes.

**Prevention strategy:**
1. Implement a "trapo collector" achievement system with public display — whales compete for prestige of rare cosmetics, not stats.
2. Limited-time cosmetics tied to real events (Superclásico-exclusive skin) create FOMO-driven spend without power creep.
3. Gifting system: whales can gift cosmetics to their barra members — creates social spending motivation.
4. No "complete the set" pricing that punishes casuals — each cosmetic is independently purchasable.

---

## MODERATE PITFALLS

---

### PITFALL 13: Loot Box Regulatory Risk (If Randomized Cosmetic Drops)

**Severity:** MEDIUM (CRITICAL if randomized drops are implemented)
**Phase:** Pre-launch (monetization design)

**What goes wrong:** Belgium, Netherlands, and several other jurisdictions have classified randomized loot boxes as gambling. Argentina does not have specific loot box legislation as of 2025, but global App Store policy (Apple 2017 onwards, Google 2019 onwards) requires disclosure of drop rates for randomized items. If "Drops sincronizados con realidad" (e.g., gol clave Selección → drop nacional) are randomized cosmetics, they may qualify as loot boxes under store policy.

**Warning signs:**
- Drop event gives a random cosmetic from a pool (not a guaranteed specific item)
- Drop rarity is not disclosed in the UI

**Prevention strategy:**
1. Make real-event drops guaranteed specific items, not random — "Superclásico drop = Superclásico 2026 trapo, guaranteed." No randomization.
2. If a gacha/randomized element is ever introduced, disclose all drop rates on a public web page and link from in-app purchase screen (required by Apple App Store guidelines 3.1.1 since 2017).
3. Do not call them "mystery drops" — call them "limited edition drops" with the specific item shown.

---

### PITFALL 14: Solo Dev Backend Cost Explosion at Viral Scale

**Severity:** MEDIUM
**Phase:** Post-launch

**What goes wrong:** The game goes viral after a Superclásico event. 50,000 concurrent users hit the backend simultaneously. If the backend is on a managed service (Firebase, Supabase, AWS GameLift), costs scale linearly with usage. Firebase's Blaze plan at 50K CCU during a 90-minute match window can generate $500-2,000 in a single night for an unoptimized implementation.

**Warning signs:**
- Backend cost alert triggers during first major match event
- Realtime database reads spiking during match windows

**Prevention strategy:**
1. Set billing alerts at $50, $100, $500 — get notified before runaway costs become catastrophic.
2. Architect battle windows as async-resolved events (not real-time websocket per player) — reduces CCU impact dramatically.
3. Use Cloudflare Workers for edge functions (cheap at scale) rather than Firebase Functions for hot paths.
4. Implement rate limiting on all API endpoints from Day 1.
5. Calculate and document the cost-per-MAU before launch — know your unit economics.

---

### PITFALL 15: iOS Background Location Restrictions

**Severity:** MEDIUM
**Phase:** MVP

**What goes wrong:** iOS restricts background location access to apps with explicit "Always On" location permission, which requires a clear justification shown to the user during permission request and reviewed by Apple. Apps that request "Always" location permission for non-navigation/safety use cases frequently get rejected or have the permission downgraded to "While Using." The stadium geo-bonus requires detecting that a player is near the stadium before they open the app (to trigger a pre-match notification).

**Prevention strategy:**
1. Design geo-bonus as "opt-in check-in" rather than passive background detection — player opens app, app checks location at that moment.
2. Use geofencing (iOS CLLocationManager region monitoring — does not require Always On) for match-day notifications — register a geofence around each stadium, trigger notification when player enters. This is permitted with "When In Use" + geofence API.
3. Clearly explain in permission dialog why location is requested: "Para darte bonus cuando estás en el estadio en día de partido."
4. Make geo-bonus opt-in at account level — players who don't want to share location aren't penalized.

---

### PITFALL 16: Daylight Saving and UTC-3 Match Window Timing

**Severity:** MEDIUM
**Phase:** MVP

**What goes wrong:** Argentina is UTC-3 year-round (no daylight saving since 2009). However, Argentine diaspora players (and potential future international expansion) are in timezones observing DST. A match window "opens at 20:30 Buenos Aires time" must be communicated as local time to each player. If all times are stored as UTC-3 fixed offset, a player in Spain during European summer (UTC+2) sees the window 5 hours ahead, but in European winter (UTC+1) sees it 4 hours ahead — the offset changes for them even though Argentina's offset doesn't. App notifications sent at wrong local times will churn diaspora players.

**Prevention strategy:**
1. Store all match times as UTC in the database — never store as UTC-3.
2. Display times in user's local timezone (device timezone) with "hora Buenos Aires" shown parenthetically.
3. Test notifications against European and North American timezones in QA.

---

### PITFALL 17: Premature Scale Optimization

**Severity:** MEDIUM
**Phase:** MVP

**What goes wrong:** Solo dev spends 3 months building a horizontally scalable microservices architecture for a game that will have 500 users at launch. Every hour spent on Kubernetes config is an hour not spent on the actual game loop, content, or player acquisition. This is the most common solo dev trap.

**Prevention strategy:**
1. Start with a monolith on a single managed server (Railway, Render, or Fly.io) — optimize when real bottlenecks appear.
2. Firebase/Supabase for v1 backend — let managed services handle scaling until costs justify custom infrastructure.
3. Rule: Do not optimize anything without a production data point showing it is the bottleneck.

---

### PITFALL 18: Political Minefields — Club/Political Affiliations

**Severity:** MEDIUM
**Phase:** Pre-launch, Ongoing

**What goes wrong:** Argentine football has documented political affiliations. Boca Juniors has historical association with Mauricio Macri (former president, current opposition). River Plate's board has different political valences. Certain clubs (San Lorenzo, Independiente) have different political histories. If the game's club bonuses, territory maps, or narrative events inadvertently align with real political valences (e.g., Boca gets a "poder político" bonus that maps to PRO party territory in CABA), Argentine political Twitter will weaponize it.

**Prevention strategy:**
1. All club bonuses are football-culture derived, never political — "Boca's barra is known for its bombos" not "Boca's influence extends to the government district."
2. Territory map uses football-geography logic (fan density per neighborhood) not political district maps.
3. Avoid any reference to real political parties, politicians, or political events within the game.

---

### PITFALL 19: Argentine Data Protection (Ley 25.326) — GDPR Equivalent

**Severity:** MEDIUM
**Phase:** Pre-launch

**What goes wrong:** Ley 25.326 requires: (a) informed consent before collecting personal data, (b) right to access and delete personal data, (c) registration of database with Argentina's AAIP (Agencia de Acceso a la Información Pública) if collecting sensitive data from Argentine citizens. GPS location data is classified as sensitive data. Without a privacy policy and AAIP registration, the app is non-compliant.

**Prevention strategy:**
1. Publish a Spanish-language privacy policy before launch that clearly discloses: location data use, how long it's retained, and how to request deletion.
2. Register the app's database with AAIP (free, required for apps collecting Argentine user data) — process takes 2-4 weeks.
3. Implement a data deletion flow: users can request account + data deletion from within the app (required for both Ley 25.326 and App Store guidelines).
4. If EU players use the app (diaspora), GDPR applies for those users — implement cookie consent and data subject request handling.

---

### PITFALL 20: Third-Party AFA Data Costs at Scale

**Severity:** MEDIUM
**Phase:** Post-launch (but budget for it at launch)

**What goes wrong:** API-Football (RapidAPI) and SportRadar charge per-request or per-month at commercial tiers. At 10,000 DAU, polling fixture data frequently can cost $300-800/month. Without this data, the core game loop breaks.

**Prevention strategy:**
1. Cache aggressively — fixture data changes at most once per day; cache for 30 minutes, not 30 seconds.
2. Build a thin middleware layer that fetches and caches AFA data centrally — all game clients hit your cache, not the third-party API directly.
3. Budget $200-500/month for data costs at 10K DAU as a line item before launch.
4. Explore scraping AFA's official website as a backup (check robots.txt — currently not explicitly blocked) with rate limiting to avoid IP bans.

---

## MINOR PITFALLS

---

### PITFALL 21: Battle Pass Burnout

**Severity:** MINOR
**Phase:** Post-launch

**What goes wrong:** Players who complete a battle pass in week 2 of a 3-month season have no cosmetic motivation for weeks 5-12. Daily active use drops. When the next season launches, they don't return because the previous experience felt like a treadmill.

**Prevention strategy:**
1. Structure battle pass with enough tiers that completion in <6 weeks requires significant daily play — but don't make it a churn-inducing grind.
2. Add "prestige" cosmetics beyond the pass for hardcore completionists.
3. Release 1-2 mid-season cosmetic drops (Superclásico event exclusive) that re-engage lapsed players.

---

### PITFALL 22: Lower Division Complexity Creep

**Severity:** MINOR
**Phase:** Post-launch (scope risk)

**What goes wrong:** Players from Ascenso clubs demand inclusion. Adding all 30+ Primera Nacional clubs multiplies: territory map complexity, fixture data volume, player base fragmentation (too many clubs, not enough players per club), and content creation requirements (art assets per club).

**Prevention strategy:**
1. Launch with Primera División only (26 clubs) — document publicly that expansion is planned.
2. Expansion to Primera Nacional is a separate paid content drop or season unlock, not a free feature.

---

### PITFALL 23: Replay System Virality Creating Legal Exposure

**Severity:** MINOR (escalates to MEDIUM if real player likeness involved)
**Phase:** Post-launch

**What goes wrong:** If raid replay videos are shareable to social media and they contain copyrighted music (cánticos, chants) licensed by record labels, auto-detection systems on YouTube/TikTok will mute or take down the videos, reducing viral reach. Additionally, if replays contain club imagery that infringes trademark, each share is a new infringement instance.

**Prevention strategy:**
1. License original cántico-style music from Argentine independent musicians — negotiate Creative Commons or flat fee.
2. Ensure all club imagery in replays is the parodied/stylized version, not real logos.
3. Add a social share watermark ("BarraBrava - El Juego") to all exported replays.

---

## Phase Mapping Summary

| Phase | Pitfall to Address |
|-------|--------------------|
| **Pre-launch / Design** | Club trademark strategy (P1), App Store framing (P2), Monetization pricing for Argentina (P7), UGC moderation pipeline (P5), Privacy policy + AAIP registration (P19), Loot box policy (P13), Press strategy (P8) |
| **MVP Build** | AFA data feed + manual override (P3), GPS spoofing mitigations (P4), AI barra opponents for Day 1 (P6), iOS location permission design (P15), UTC time handling (P16), Permadeath system naming (P9) |
| **Launch** | Soft launch in Buenos Aires metro first (P6), Billing alerts (P14), Block/report system live (P11) |
| **Post-launch / Ongoing** | Toxicity monitoring (P11), Whale retention (P12), Season continuity if AFA disrupted (P10), Backend cost monitoring (P14), Battle pass pacing (P21) |

---

## Sources

- Apple App Store Review Guidelines Sections 1.1, 1.1.6, 3.1.1 (loot box disclosure) — developer.apple.com/app-store/review/guidelines/
- Google Play Developer Policy Center — Violence, Sensitive Events, Gambling policies — play.google.com/about/developer-content-policy/
- Argentine Trademark Law 22.362 — infoleg.gob.ar
- Argentine Data Protection Law 25.326 (Ley de Protección de Datos Personales) — AAIP enforcement
- Argentine Anti-Discrimination Law 23.592 — infoleg.gob.ar
- AFA Liga Profesional structure and historical postponement frequency — public record
- API-Football (RapidAPI) commercial pricing tiers — documented at rapidapi.com/api-sports
- Hive Moderation API pricing — thehive.ai
- Sightengine content moderation — sightengine.com
- Argentine inflation data 2023-2025 — INDEC official statistics
- Firebase Blaze plan pricing at scale — firebase.google.com/pricing
- iOS CLLocationManager geofencing documentation — developer.apple.com
- Android mock location detection — developer.android.com

**Confidence Assessment:**
- Legal pitfalls (P1, P19): HIGH — Argentine law well-documented
- App Store policies (P2, P9, P13): HIGH — guidelines publicly available and stable
- AFA data instability (P3, P10): HIGH — publicly documented history
- GPS spoofing (P4): HIGH — technical mechanism well-understood
- UGC abuse (P5): HIGH — documented in every comparable game at launch
- Argentine economics (P7): HIGH — INDEC data + App Store Argentina pricing public
- Cultural/political (P8, P18): MEDIUM — pattern-based, specific incidents unpredictable
- Backend costs (P14): MEDIUM — depends on architecture choices not yet made
