# Feature Landscape: BarraBrava

**Domain:** Mobile multiplayer strategy game — Argentine football hooligan culture
**Researched:** 2026-05-14
**Confidence:** HIGH (reference games well-documented; Argentine cultural specifics from deep domain knowledge)

---

## Reference Game Analysis Summary

| Game | Key Mechanic Borrowed |
|------|----------------------|
| Clash of Clans | Base building, async raids, clan wars, resource loops, upgrade timers |
| Clash Royale | Real-time card-based PvP, ladder, deck limits |
| Hooligans: Storm Over Europe (2002) | Firm management, tactical ambush, role-based squads, ambush/patrol loop |
| Pokemon GO | GPS geo-bonus, location-gated rewards, stadium proximity |
| Fortnite | 100% cosmetic monetization, battle pass, seasonal item shop rotation |
| FIFA Mobile / EA FC Mobile | Real fixture calendar integration, live match events, result-tied rewards |
| Hattrick / Football Manager Mobile | Season structure mirroring real football calendar, long-term planning |
| Mafia City / Last Empire War Z | MMO map control, alliance warfare, FFA zone capture |
| Top Eleven | Real-time events tied to real football, manager identity |

---

## Category 1: Onboarding + Club Selection

### TABLE STAKES

**F-001 — Club Picker with Real AFA Clubs**
- Player selects their club from a list of real AFA Primera Division clubs (at minimum 26 clubs)
- Club determines starting territory, rival clubs, and seasonal events
- Visual: club colors, escudo-style logo (parodied/stylized, not licensed — see legal constraints), home barrio
- Complexity: MEDIUM
- Dependencies: none
- Cultural note: Club identity in Argentina is quasi-religious. The pick must feel weighty — show stadium shot, cántico preview, barra nickname. This is the player's identity for the season.
- Sensitive: avoid using actual club trademarks without license; use stylized parody approach

**F-002 — Named Pibe Creation (Character)**
- Player creates their own pibe (hooligan character): name, look, starting role assignment
- Not a generic avatar — they are a person in the barra, not the club manager
- Complexity: LOW
- Dependencies: F-001

**F-003 — Tutorial: La Primera Salida**
- Guided first experience: join the barra, build first rancho, recruit first 3 pibes, survive a tutorial ambush (scripted PvE)
- Teaches: resource gathering, pibe roles, attack/defense basics, trapo mechanics
- Must complete in under 10 minutes to hit Day 1 retention
- Complexity: MEDIUM
- Dependencies: F-001, F-002, F-010 (base), F-020 (pibes)

**F-004 — First-Session Reward Hook**
- Within 30 minutes: player earns their first trapo (club flag cosmetic), hears first cántico unlock
- Emotional payoff tied to club identity — not generic "you earned 100 gold"
- Complexity: LOW
- Dependencies: F-003

### DIFFERENTIATORS

**F-005 — Rival Club Pre-Assignment**
- At club selection, show historical rivals prominently (e.g., Boca → River, Racing → Independiente, San Lorenzo → Huracán)
- Pre-seed rivalry enmity — game acknowledges real clásicos before player knows game mechanics
- Complexity: LOW
- Dependencies: F-001

**F-006 — Barrio of Origin Selection**
- Within their club, player picks a barrio (neighborhood) faction — La Doce Zona Sur vs La Doce Zona Norte style
- Creates intra-club social tension without breaking club unity
- Complexity: MEDIUM
- Dependencies: F-001, F-002

---

## Category 2: Base / Cancha Building

### TABLE STAKES

**F-010 — Rancho Construction (Base Building)**
- Player's personal space within the barra compound: rancho (headquarters), bodega (resource storage), guardia (defense post), vestuario (pibe recovery), bandera room (trapo display)
- Async upgrade timers (Clash of Clans model): queue one upgrade at a time (solo dev: start with this, builder slots are monetization opportunity later)
- Complexity: HIGH
- Dependencies: F-001

**F-011 — Resource Nodes: Aguante Income**
- Aguante (primary resource) generated passively from rancho upgrades + activity bonuses
- Collected periodically (like CoC gold mines) — creates daily login hook
- Complexity: MEDIUM
- Dependencies: F-010

**F-012 — Base Defense Layout**
- Player arranges guardia posts, trampas (traps), and pibe positions to defend rancho against raids
- Asynchronous defense — pibes defend automatically when player is offline
- Complexity: HIGH
- Dependencies: F-010, F-020 (pibes needed to staff defenses)

**F-013 — Resource Sinks (Upgrade Economy)**
- Aguante spent on: pibe recruitment, rancho upgrades, ambush supplies, abogado retainer
- Trapos/Banderas spent on: special raids, territory claims, season events
- Must have enough sinks to prevent resource stagnation at mid-game
- Complexity: MEDIUM
- Dependencies: F-010, F-011

### DIFFERENTIATORS

**F-014 — Bandera Room (Trophy Display)**
- Dedicated space in rancho to exhibit stolen trapos from defeated clubs
- Stolen trapos appear in your bandera room AND in the social feed — public humiliation loop
- Complexity: MEDIUM
- Dependencies: F-010, F-040 (trapo system)
- Cultural note: Displaying an enemy's trapo is the ultimate flexeo. Museums of stolen trapos exist in real barras.

**F-015 — Barricada (Defensive Fortification)**
- Paravanchas (crowd barriers used as shields) as defensive structures specific to this genre
- Not just CoC walls — culturally coded as tribuna barriers
- Complexity: MEDIUM
- Dependencies: F-010, F-012

**F-016 — Cancha Upgrades Tied to Real Club Performance**
- If your real club wins a match, cancha earns a temporary +10% Aguante generation bonus next day
- If club is relegated, cancha suffers debuff until next season promotion
- Complexity: HIGH (requires real fixture sync — F-090)
- Dependencies: F-010, F-090

---

## Category 3: Pibes Roles + Skills System

### TABLE STAKES

**F-020 — Pibe Roster (Recruit + Manage)**
- Each player has a squad of recruitable pibes (NPCs with persistent stats)
- Max roster size gated by rancho level (e.g., 5 pibes at start, up to 20 at max)
- Pibes have names (procedurally generated lunfardo/Argentine names), appearance, base stats
- Complexity: HIGH
- Dependencies: F-010

**F-021 — Core Role System**
- Eight roles, each with distinct tactical function:
  - **Trompada** (brawler): high attack damage, low speed, front-line
  - **Aguantador** (endurer): high HP, absorbs damage, can't retreat
  - **Corredor** (runner): high speed, flanking, escape specialist
  - **Vigía** (scout): pre-raid intel gathering, reveals enemy composition before attack
  - **Líder de Grupo** (squad leader): buffs adjacent pibes, morale aura
  - **Pirotécnico** (pyro): area-effect smoke/flare, disrupts enemy formation, morale debuff
  - **Abogado** (lawyer): out-of-combat, rescues jailed pibes, reduces cana heat
  - **Barrabrava Viejo** (veteran): high respect stat, slower, mentor bonus (boosts rookie pibes)
- Complexity: HIGH
- Dependencies: F-020

**F-022 — Skill Tree per Role**
- Each role has a small skill tree (3–4 nodes deep) unlockable with Aguante
- Example Trompada tree: Piña Básica → Cachetada Circular (AOE) → Mano de Piedra (stun)
- Cross-role hybrids possible at high level (e.g., Corredor + Vigía = Infiltrado)
- Complexity: HIGH
- Dependencies: F-020, F-021

**F-023 — Permadeath with Recovery Window**
- Pibes defeated in raids go to "cana" (jail) — not immediately dead
- If not rescued by Abogado within 24 hours real time: pibe is "dado de baja" (permadeath)
- Player must pay Aguante or premium currency to hire Abogado rescue
- Creates real tension and meaningful loss without being pure punishment
- Complexity: HIGH
- Dependencies: F-020, F-021, F-050 (heat/cana system)
- Sensitive: permadeath must be clearly framed as fantasy; avoid language framing it as real death

**F-024 — Pibe Loyalty / Morale Stat**
- Pibes have a loyalty meter — drops if they lose fights, aren't used, or are sent on risky missions
- Low loyalty: pibe deserts (soft permadeath, no jail — just leaves)
- High loyalty unlocks special abilities ("por la barra!" moment — clutch buff)
- Complexity: MEDIUM
- Dependencies: F-020, F-021

### DIFFERENTIATORS

**F-025 — Barrabrava Viejo as Mentor System**
- Veteran pibes can be assigned to mentor younger pibes, passing one skill at accelerated rate
- Retiring a viejo permanently grants a legacy bonus to the whole barra (passive buff named after him)
- Complexity: MEDIUM
- Dependencies: F-020, F-022
- Cultural note: The "old guard" (la vieja guardia) archetype is central to real barra culture — respected, feared, consulted.

**F-026 — Vigía Intel System**
- Before any raid, Vigías can be sent on a pre-raid scouting mission (1–2 hours real time)
- Result: partial reveal of enemy rancho layout, pibe count, active traps
- If vigía is caught during scouting (random probability + enemy vigía counter): vigía goes to cana
- Complexity: HIGH
- Dependencies: F-020, F-021, F-050 (cana system)
- This is the core tactical differentiator vs Clash of Clans (where you see everything before raiding)

---

## Category 4: Combat — Calendarized FFA

### TABLE STAKES

**F-030 — AFA-Synced Attack Windows**
- Combat raids are only possible during scheduled windows tied to real AFA fixture calendar
- Match day = attack window opens 2 hours before kickoff and closes 2 hours after final whistle
- Outside match windows: rancho is in "guardia mode" — attacks staged but not resolved
- Complexity: VERY HIGH (requires real-time fixture sync, F-090)
- Dependencies: F-090, F-010, F-020

**F-031 — Async Raid Execution**
- Player configures raid (selects pibes, formation, target, attack route) and queues it
- Raid resolves asynchronously against target's defensive layout
- Replay generated for both attacker and defender to watch
- Complexity: HIGH
- Dependencies: F-030, F-010, F-020

**F-032 — Scaled Damage Outcomes**
- Raids produce one of four outcomes based on performance:
  1. **Rasguñazo** (scratch): minor Aguante loss for defender, no pibes taken
  2. **Paliza** (beating): significant Aguante loss, some pibes go to cana
  3. **Robo de Bombo** (steal the drum): Aguante loss + cosmetic shame event + bombo temporarily lost
  4. **Robo de Trapo** (steal the flag): maximum humiliation — trapo stolen, public feed event, attacker holds trapo in bandera room
- Complexity: HIGH
- Dependencies: F-031, F-040 (trapo system)

**F-033 — Shield / Guardia Mode**
- After being raided, player enters a guardia period (6–12 hours) during which they cannot be raided again
- Shield breaks if player launches their own raid (Clash of Clans model)
- Complexity: MEDIUM
- Dependencies: F-031

**F-034 — FFA Map Targeting**
- Any player can attack any other player (not just rivals) — free-for-all with territory implications
- Target selection via territory map (F-080) or by searching club/barrio
- Complexity: MEDIUM
- Dependencies: F-031, F-080

### DIFFERENTIATORS

**F-035 — Clásico Windows (Double-Stake Events)**
- When a real clásico fixture occurs (Boca vs River, Racing vs Independiente, etc.): extended attack window (full match day), double Aguante rewards, special cosmetic drops for both clubs
- Superclásico (Boca vs River only): triple-stake event, week-long territory contest, exclusive cosmetics
- Complexity: MEDIUM (once F-090 and F-030 exist)
- Dependencies: F-030, F-090
- Cultural note: The Superclásico is Argentina's biggest cultural event. This must be the game's biggest seasonal moment.

**F-036 — Formation System (Tactical Depth)**
- Before a raid, player sets formation: flanking attack, frontal assault, decoy+ambush
- Formations interact with role bonuses (e.g., Corredor shines in flanking; Aguantador in frontal)
- Enemy defense layout counters specific formations (Hooligans: SoE inspiration)
- Complexity: HIGH
- Dependencies: F-031, F-021

**F-037 — Emboscada Planning (Ambush Config)**
- Player chooses ambush location on a stylized map of the rival's barrio (not real GPS)
- Location types: under a bridge, outside a train station, near rival bar — each has modifier effects
- Inspired directly by Hooligans: Storm Over Europe's ambush system
- Complexity: HIGH
- Dependencies: F-031, F-026 (vigía intel)

---

## Category 5: Trapo / Bombo / Banner Mechanics

### TABLE STAKES

**F-040 — Club Trapo as Trophy Object**
- Each player has one primary trapo (their barra's flag) and can hold captured trapos from enemies
- Trapo lost = major shame event (public feed post, rancho banner goes blank)
- Trapo recovered = triumph event (feed post, recovery animation)
- Complexity: MEDIUM
- Dependencies: F-010, F-032

**F-041 — Trapo Recovery Quest**
- When trapo is stolen, player enters a "recovery" state: special raid available against the thief within 72 hours
- Recovery raid is buffed (+20% attack strength) — gives hope without guaranteeing return
- If timer expires without recovery: trapo is permanently absorbed into thief's bandera room until next season reset
- Complexity: MEDIUM
- Dependencies: F-040, F-031

**F-042 — Bombo as Secondary Trophy**
- Bombo (bass drum) is a secondary capturable object — less catastrophic than trapo but still a shame event
- Bombo stolen = attacker gets a temporary sound effect cosmetic (rival's bombo beat plays in their raids)
- Recovered or resets at season end
- Complexity: MEDIUM
- Dependencies: F-040

### DIFFERENTIATORS

**F-043 — Custom Trapo Design System**
- Players can design custom trapos: choose base shape, colors, iconography (from a library of fantasy symbols — not real political/gang symbols)
- Custom trapo is player's UGC cosmetic — subject to moderation (F-120)
- Premium option: animated trapos, metallic thread effects, UV glow (cosmetic monetization F-110)
- Complexity: HIGH (requires UGC tooling + moderation pipeline)
- Dependencies: F-040, F-120 (moderation)
- Sensitive: UGC moderation of trapos is critical — players WILL try to put offensive imagery

**F-044 — Banderazo Event (Mass Display)**
- Seasonal event: all players of a club simultaneously "display" their trapos — creates a visual collective rally
- Triggered by: game hitting club milestone, real club reaching a final, special calendar event
- Shows aggregate trapo art as a mosaic — viral shareable image
- Complexity: HIGH
- Dependencies: F-040, F-043

**F-045 — Recibimiento Mechanic**
- When your club's team enters the virtual "estadio" (match window opens), all active club players trigger a "recibimiento" — cascading animation of trapos + bomber-smoke effect
- Purely cosmetic, no gameplay effect — pure spectacle and club pride
- Complexity: MEDIUM
- Dependencies: F-040, F-030

---

## Category 6: Heat / Cana System

### TABLE STAKES

**F-050 — Heat Meter (Police Pressure)**
- Each attack raises the player's heat level (1–5 stars, Lunfardo: "la cana te está mirando")
- High heat: increased chance of pibes going to cana after raids, random patrol events that cost Aguante
- Heat decays over time if player stays inactive (offline = cooling down)
- Complexity: MEDIUM
- Dependencies: F-030

**F-051 — Cana (Jail) State**
- Pibes captured in raids or caught by patrol go to cana
- Cana pibes are unavailable until rescued: either by Abogado role (F-021) or by paying Aguante
- If not rescued within 24h real time: pibe is dado de baja (permadeath)
- Complexity: MEDIUM
- Dependencies: F-020, F-021, F-050

**F-052 — Abogado Rescue Mechanic**
- Abogado role pibe can be sent on rescue missions (costs Aguante + time)
- Success rate scales with Abogado's skill level
- Abogado himself can be caught (small probability) — creating a cascade risk
- Complexity: MEDIUM
- Dependencies: F-021, F-051

### DIFFERENTIATORS

**F-053 — Patrol Events (Scripted Interruptions)**
- During high heat, random patrol events occur: player must "handle" them (spend Aguante, use Corredor to flee, bribe with premium)
- Not a full minigame — a one-tap decision with consequences
- Inspired by: heat system in GTA, Wanted level management
- Complexity: MEDIUM
- Dependencies: F-050

**F-054 — Political Heat (Seasonal)**
- At season events (Superclásico, Copa finals): government security is elevated — heat escalates faster for all players
- Creates a seasonal rhythm: "this week everyone is at higher risk"
- Complexity: LOW (once F-050 exists — just multiplier change)
- Dependencies: F-050, F-035

**F-055 — Abogado Network (Shared Resource)**
- Club leader (F-070) can unlock a shared "abogado de la barra" — a pooled resource that rescues any member for reduced cost
- Creates leader value and club interdependence without requiring real money
- Complexity: MEDIUM
- Dependencies: F-052, F-070, F-080 (club system)

---

## Category 7: Territory Map (Argentina)

### TABLE STAKES

**F-060 — National Map of Argentina**
- Stylized map of Argentina divided into territory zones (approx. 60–80 zones)
- Zones correspond to real cities/barrios where clubs have strong presence (Boca's La Boca, River's Núñez, etc.)
- Each zone is claimable by a club's barra collective
- Complexity: HIGH
- Dependencies: F-001, F-034 (FFA combat)

**F-061 — Zone Control Display**
- Map shows real-time zone ownership: color-coded by club, intensity reflects dominance level
- Changes visually after each major raid result during match windows
- Club with most zones at season end gets season bonus
- Complexity: HIGH
- Dependencies: F-060, F-034

**F-062 — Home Zone (Protected Barrio)**
- Each club has one home zone that is harder to capture (home field advantage)
- Home zone generates bonus Aguante for all members of that club
- Can still be captured if club is completely inactive
- Complexity: MEDIUM
- Dependencies: F-060, F-061

### DIFFERENTIATORS

**F-063 — Contested Zone Events**
- Certain zones are historically contested (e.g., Avellaneda belongs to both Racing and Independiente)
- These zones trigger double-reward events when ownership changes hands
- Special cosmetic drops for the club that captures a rival's home zone
- Complexity: MEDIUM
- Dependencies: F-061

**F-064 — Territorial Prestige Ranking**
- Live leaderboard of clubs by territorial control percentage
- Updates after each match window closes
- Top 3 clubs get visual crown on map until next window
- Complexity: LOW
- Dependencies: F-061

---

## Category 8: Club Hierarchy / Leader System

### TABLE STAKES

**F-070 — Club Barra Structure**
- Each real AFA club has one barra collective in-game, shared by all players who chose that club
- Structure: Jefe de Barra (leader), Lugarteniente (lieutenants, 2–3 max), Socios (members)
- Leader grants buffs to all members: +% Aguante generation, access to shared resources
- Complexity: HIGH
- Dependencies: F-001

**F-071 — Leader Election / Succession**
- Leader elected by active member vote at season start (or mid-season if current leader is inactive 7+ days)
- Player can challenge current leader: challenge accepted = PvP duel (highest-stakes raid) for leadership
- "Aguante vote": players with highest Aguante score can also be auto-nominated
- Complexity: HIGH
- Dependencies: F-070, F-031

**F-072 — Leader Decay (Anti-Inactive)**
- If club leader is offline 5+ days: lugarteniente can call emergency vote
- Prevents dead guilds blocking other players
- Complexity: MEDIUM
- Dependencies: F-070, F-071

### DIFFERENTIATORS

**F-073 — Lugarteniente Role Specialization**
- Each Lugarteniente slot can specialize: Lugarteniente de Logística (Aguante bonus), de Inteligencia (Vigía missions cheaper), de Defensa (shared defense buff)
- Leader assigns specializations — adds strategic layer to officer structure
- Complexity: MEDIUM
- Dependencies: F-070

**F-074 — Internal Barra Politics Feed**
- In-club feed showing: who challenged whom, leadership vote results, member Aguante rankings
- Creates emergent drama within a club without dev intervention
- Complexity: MEDIUM
- Dependencies: F-070, F-071, F-100 (social feed)

**F-075 — El Viejo Consejo (Veteran Council)**
- Top 3 longest-serving members of each barra (by tenure, not just power) form an advisory council
- Council can veto one leader decision per week (cosmetic/mechanical unlock decision, not combat)
- Rewards loyalty and long-term play, counters pure whale-power hierarchies
- Complexity: MEDIUM
- Dependencies: F-070, F-025

---

## Category 9: Seasons (AFA-Synced)

### TABLE STAKES

**F-080 — Season Calendar (AFA-Mirrored)**
- Game season = AFA Torneo Apertura or Clausura (approx. 14–17 rounds over 4–5 months)
- Season starts and ends with real tournament — end-of-season event triggered by real last round
- Creates natural lifecycle: players know season is finite, drives urgency
- Complexity: HIGH (requires F-090 fixture sync)
- Dependencies: F-090

**F-081 — Seasonal Cosmetic Battle Pass**
- Two tiers: free track (everyone) and premium track (paid, cosmetic only)
- Progress via: Aguante earned, raids won, trapos captured, match windows participated in
- Never pay-to-win: premium track = exclusive skins, cánticos, trapo patterns, pibe outfits only
- Complexity: HIGH
- Dependencies: F-080, F-110 (monetization)

**F-082 — End-of-Season Ritual**
- Last match window of real season = "La Gran Final" event: all attack windows open simultaneously for all clubs, double rewards
- Season ends: territorial rankings locked in, season pass closes, champion crowned
- Soft reset: Aguante partially wiped, ranks reset, pibes survive (except permadead)
- Complexity: MEDIUM
- Dependencies: F-080, F-060, F-081

**F-083 — Championship Club Buff**
- Real AFA champion team's barra gets a visible season-long buff in the next season: +15% Aguante generation, exclusive seasonal trapo, champion cosmetic on leader profile
- Complexity: LOW (once F-090 exists)
- Dependencies: F-090, F-080

**F-084 — Relegation Penalty**
- Club relegated in real AFA: barra loses 20% of territorial zones at next season start, gets visible "descendido" shame cosmetic (humorously coded, not cruel)
- Creates stakes beyond the game for real football outcomes
- Complexity: LOW (once F-090 exists)
- Dependencies: F-090, F-060, F-080

### DIFFERENTIATORS

**F-085 — Pre-Season Preparation Window**
- 2-week period before season starts: no combat, only building/recruiting/planning
- New players onboard here — lower entry barrier
- Returning players upgrade base before season violence begins
- Complexity: MEDIUM
- Dependencies: F-080

**F-086 — Season Legacy Record**
- At end of every season: each player gets a "tarjeta de hincha" (fan card) — a shareable season recap card
- Shows: raids won/lost, trapos stolen, Aguante earned, club rank, memorable moment (highest-stake raid)
- Inspired by Spotify Wrapped / Fortnite season recap
- Complexity: MEDIUM
- Dependencies: F-080, F-031

---

## Category 10: Real-World Integration

### TABLE STAKES

**F-090 — AFA Fixture Feed (Real-Time Sync)**
- Integration with a real AFA fixture/results API (or reliable scraping of AFA official data)
- Used for: attack window scheduling (F-030), result bonuses (F-091), season calendar (F-080)
- Must handle: postponements, rescheduling, cup rounds inserted mid-season
- Complexity: VERY HIGH (external dependency, reliability critical)
- Dependencies: none (foundational)
- Sensitive: data sourcing must be legally clean — public fixture data is generally available; avoid scraping AFA if terms prohibit

**F-091 — Real Result Bonus**
- When your club wins a real match: all members get +25% Aguante for next 6 hours
- When your club loses: all members get -10% Aguante income for next 3 hours (creates shared mourning)
- When draw: no bonus, no penalty
- Complexity: LOW (once F-090 exists)
- Dependencies: F-090

**F-092 — Live Match Tension Window**
- During the real match's 90 minutes: special "full alert" mode in-game
- All attacks resolve faster (15 min instead of 1h), heat rises quicker, Aguante rewards doubled
- Creates a reason to be in-game during actual matches — peak concurrent player window
- Complexity: MEDIUM
- Dependencies: F-090, F-030

### DIFFERENTIATORS

**F-093 — GPS Geo-Bonus (Stadium Proximity)**
- Opt-in GPS: if player is within 500m of their club's real stadium on match day, they get:
  - Double Aguante from attacks during that window
  - Exclusive "presente" badge for their profile
  - Unlock a "cancha propia" attack modifier for that session
- Opt-in only, never required, generous privacy handling
- Complexity: HIGH (GPS + privacy handling)
- Dependencies: F-030, F-090
- Sensitive: Must be opt-in; handle Ley 25.326 (Argentine personal data protection); no persistent location tracking

**F-094 — Selección Argentina Integration**
- During World Cup qualifiers / Copa América: Selección window opens — all clubs suspended, temporary "Selección mode"
- Players from all clubs unite temporarily — cross-club cooperation for national event cosmetics
- Creates nationalistic pride moment without breaking club rivalry structure
- Complexity: HIGH (requires separate event system)
- Dependencies: F-090, F-080
- Note: Selección not bound to AFA club licensing — national team data is more freely available

**F-095 — Gol Flash Notification**
- When your real club scores: push notification with animated cántico fragment
- When rival club scores against your club: "aguantá" notification (endurance messaging)
- Keeps players emotionally engaged during real matches even outside the game
- Complexity: MEDIUM
- Dependencies: F-090

---

## Category 11: Social Layer

### TABLE STAKES

**F-100 — In-Game Activity Feed**
- Central feed: raid results (attacker + defender), trapo steals, trapo recoveries, leader changes, season events
- Every player sees their barra's feed + global feed (biggest events across all clubs)
- Feed entries are auto-generated based on game events — no user-generated text in v1 (moderation constraint)
- Complexity: MEDIUM
- Dependencies: F-031, F-040, F-070

**F-101 — Raid Replay Viewer**
- Every raid generates a replay (abstract visual representation of the tactical raid)
- Attacker and defender can both watch; defender sees what formation was used against them
- Shareable as short clip outside the game (social media viral potential)
- Complexity: HIGH
- Dependencies: F-031, F-036

### DIFFERENTIATORS

**F-102 — Trapo Humiliation Card**
- When a trapo is stolen: auto-generated "trapo robado" card — stylized image showing stolen trapo in enemy's bandera room
- Shareable to WhatsApp/Instagram — real-world virality loop
- "La verguenza trasciende el juego" — shame goes beyond the game
- Complexity: MEDIUM
- Dependencies: F-040, F-043

**F-103 — Club Cántico Library**
- Each club has a library of authentic-inspired (not real, parodied) cánticos
- Unlock new cánticos via season pass or achievements
- Cánticos play during victories, raid success notifications, recibimientos
- Players can "adopt" a cántico as their signature (plays in their raids)
- Complexity: MEDIUM
- Dependencies: none
- Sensitive: No real-world chants that have been associated with real violence or political content

**F-104 — Leaderboard by Club + Global**
- Per-club ranking: Aguante earned, raids won, trapos captured this season
- Global ranking: top barras by territorial control, top players globally
- Avoid ranking by money spent — only game achievements
- Complexity: LOW
- Dependencies: F-060, F-070

**F-105 — Comment-on-Raid (Reactions Only)**
- Defenders can leave a preset reaction on their replay after watching a lost raid (limited to pre-approved reactions: "qué raje", "trampa", "re copado", "esto no se olvida")
- No free text — preset reactions only to avoid toxicity/moderation nightmare
- Attacker sees reaction with slight delay
- Complexity: LOW
- Dependencies: F-101
- Sensitive: Free text reactions are an anti-feature (F-150); preset reactions are the safe version

---

## Category 12: Cosmetic Monetization

### TABLE STAKES

**F-110 — Premium Season Pass (Battle Pass)**
- Two tiers: free (all players) and premium (paid, ~ARS equivalent of USD 5–10/month)
- Premium unlocks: exclusive pibe skins, animated trapos, special bombo skins, cántico packs, victory animations
- Progress is skill-based (game activity), not wallet-based
- Never includes gameplay advantages
- Complexity: HIGH
- Dependencies: F-080

**F-111 — In-Game Cosmetic Shop**
- Rotating shop (refreshes weekly): individual cosmetic items purchasable with premium currency
- Items: pibe outfits, trapo patterns, humo colors, bombo skins, rancho decorations
- Some items are club-specific (only Boca fans can buy "azul y oro" skin variants)
- Complexity: MEDIUM
- Dependencies: F-110

**F-112 — Premium Currency (Fichas)**
- Single premium currency "Fichas" purchasable with real money
- Used only for cosmetics — never to accelerate upgrades or buy combat power
- Small Ficha pack given free in season pass progression to introduce the currency
- Complexity: MEDIUM
- Dependencies: none

### DIFFERENTIATORS

**F-113 — Real-Event Drops**
- Tied to real football events: club scores a hat trick → exclusive "hat trick" cosmetic drop available for 48h for that club's players
- Creates FOMO without pay pressure — the trigger is real-world events, not artificial timers
- Complexity: HIGH (requires event detection from F-090)
- Dependencies: F-090, F-111

**F-114 — Custom Cántico Pack (User-Recorded)**
- Premium cosmetic: player records a short cántico fragment (10–15 seconds) which plays on their raids and victories
- Moderated before going live — AI-assisted screening for hate speech, copyrighted content, real identifiable voices
- Ultra-premium tier — high price, high personalization, high virality
- Complexity: VERY HIGH (audio UGC pipeline + moderation)
- Dependencies: F-103, F-120 (moderation)
- Sensitive: audio moderation is hard at solo dev scale — consider as post-MVP feature

**F-115 — Gifted Battle Pass**
- Player can gift a premium season pass to a friend within the same club
- Drives acquisition: social gifting loop (known from Fortnite)
- Complexity: LOW (once F-110 exists)
- Dependencies: F-110

---

## Category 13: Moderation / Safety

### TABLE STAKES

**F-120 — UGC Trapo Moderation Pipeline**
- Every custom trapo submitted goes through: automated image classifier (hate symbols, explicit content, real political imagery, real club official marks) → if flagged, human review queue
- At solo dev scale: use third-party moderation API (AWS Rekognition, Hive Moderation) + report queue
- Players can report trapos; reported trapos hidden pending review
- Complexity: HIGH
- Dependencies: F-043

**F-121 — Pibe Name Filter**
- Procedural pibe names filtered against a deny list (slurs, political figures, real barra leaders, real player names)
- Player-submitted names (if any allowed) go through same filter
- Complexity: LOW
- Dependencies: F-020

**F-122 — In-Game Reporting System**
- Players can report: offensive trapos, inappropriate pibe names, bugs in feed events
- Report queue managed by solo dev with triage priority: trapo image > name > feed
- Complexity: LOW
- Dependencies: F-100, F-120

**F-123 — Club Name / Barra Name Guardrails**
- No player-created club names — clubs are real AFA clubs (no UGC club identity)
- Barra group name within club = preset list of style options, not free text
- Eliminates the most toxic naming attack vector
- Complexity: LOW
- Dependencies: F-001

### DIFFERENTIATORS

**F-124 — Tone Guardian (Anti-Glorification Framing)**
- All narrative text, feed auto-messages, tutorial copy, and event descriptions written in humoristic/caricature register
- Internal style guide: "Los Simuladores" tone, lunfardo humor, never serious "warrior" glorification
- Complexity: LOW (editorial/design discipline, not tech)
- Dependencies: all narrative content

**F-125 — Argentine Ley 25.326 Compliance Layer**
- GPS data: never stored server-side beyond session; bonus computed client-side; no location history
- Users can opt out of geo-bonus at any time with immediate effect
- Privacy policy in Spanish, plain language
- Complexity: MEDIUM
- Dependencies: F-093

---

## Category 14: Endgame / Retention

### TABLE STAKES

**F-130 — Prestige System (Post-Max)**
- Players who max their rancho and pibe roster can "prestige" their pibe — reset stats for cosmetic badge + small passive buff
- Keeps high-engagement players busy without power-creeping on newer players
- Complexity: MEDIUM
- Dependencies: F-010, F-020

**F-131 — Season Legacy Achievements**
- Non-resettable achievements that persist across seasons: "Robó 10 trapos de vida", "Aguantó 50 ataques", "Jefe por 3 temporadas"
- Displayed on player profile — long-term identity markers
- Complexity: LOW
- Dependencies: F-080

**F-132 — Veteran Pibe Hall of Fame**
- Retired pibes (viejo system, F-025) go into a permanent hall in the player's rancho
- Named legacy buffs persist on the barra for all future seasons
- Veterans create player-authored narrative history — "mi barra was forged by El Beto and El Turco"
- Complexity: MEDIUM
- Dependencies: F-025, F-010

### DIFFERENTIATORS

**F-133 — Territorial Legacy Map**
- At season end: snapshot of who controlled what is preserved as a historical record
- Players can view "historia territorial" — past seasons' domination maps
- Creates a narrative of club rise and fall over time
- Complexity: MEDIUM
- Dependencies: F-060, F-080

**F-134 — Cross-Season Reputation Score**
- Separate from Aguante (which resets seasonally): a permanent "Reputación de Barrio" score that accumulates
- Used for: accessing prestige cosmetics, legacy rankings, veteran status
- Cannot be bought — earned only through sustained multi-season play
- Complexity: MEDIUM
- Dependencies: F-080, F-060

**F-135 — Daily Objectives Tied to Real Match Schedule**
- Daily objectives refresh based on upcoming real matches: "Ganale a un hincha de X antes del clásico", "Participá en 3 ventanas de partido esta semana"
- Ties endgame play loops to the real football calendar
- Complexity: MEDIUM
- Dependencies: F-090, F-030

---

## Category 15: Anti-Features

Features to explicitly NOT build — with rationale for each.

### ANTI-FEATURE A-001 — Free Text Chat (Any Form)
**What it is:** Real-time or async free-text chat between players (global, club, or DM)
**Why avoid:** At solo dev scale, moderation of Argentine football fan chat is existential risk. Real barra rivalry chat will produce coordinated harassment, political content, and genuine threats. The cultural context makes this uniquely dangerous — not generic toxicity but organized group aggression.
**What to do instead:** Preset reactions (F-105), auto-generated feed events (F-100), preset cántico reactions. All social expression channeled through game mechanics, never open text.
**Sensitive:** HIGH

### ANTI-FEATURE A-002 — Pay-to-Win Mechanics
**What it is:** Selling Aguante, pibe stats, attack power, or raid advantages for real money
**Why avoid:** Destroys core competitive loop. In a game about territorial dominance, P2W means money = territory = victory. Demotivates non-paying majority. Explicitly excluded in PROJECT.md.
**What to do instead:** All monetization via F-110, F-111, F-112 — cosmetics only.
**Sensitive:** MEDIUM (App Store compliance also requires fair play disclosure)

### ANTI-FEATURE A-003 — Gambling / Loot Boxes with Variable Rewards
**What it is:** Paid packs with randomized power items (like FUT packs in FIFA)
**Why avoid:** Legal risk in Argentina (gambling regulation), App Store risk (Apple/Google loot box policies), ethical risk (addictive mechanics with real money). Explicitly excluded in PROJECT.md.
**What to do instead:** Direct purchase cosmetics (F-111), known season pass content (F-110).
**Sensitive:** VERY HIGH — legal

### ANTI-FEATURE A-004 — Real Violence / Blood / Graphic Combat
**What it is:** Realistic depictions of fighting, blood effects, weapons
**Why avoid:** App Store rejection risk. Contradicts caricature tone. Could be classified as glorifying real violence against real people (barras bravas have real victims). Creates legal exposure.
**What to do instead:** Abstract cartoon combat with humor — flying teeth, stars, "AY!" speech bubbles, Looney Tunes energy.
**Sensitive:** HIGH — store policy + legal

### ANTI-FEATURE A-005 — Real Names of Barra Leaders / Living People
**What it is:** Using real names of current or past barra leaders (e.g., known organized crime figures in Argentine barras)
**Why avoid:** Legal defamation risk. Some barra leaders have criminal associations — naming them connects the game to real organized crime. Could also be read as glorification.
**What to do instead:** Procedural fictional names in lunfardo tradition (F-020, F-121). No reference to real people.
**Sensitive:** VERY HIGH — legal

### ANTI-FEATURE A-006 — Political Content / Party Flags / Ideological Symbols
**What it is:** Argentine political party imagery, Peronism vs. anti-Peronism iconography, Kirchnerism, etc. in player content
**Why avoid:** Argentine political divisions are intense. UGC trapos with political symbols become political messaging inside the game — alienates half the player base, creates content moderation nightmare, and can be seen as political platform (legal exposure).
**What to do instead:** Moderation deny list (F-120) explicitly blocks political imagery. F-124 ensures game tone is apolitical.
**Sensitive:** VERY HIGH — political

### ANTI-FEATURE A-007 — Voice Chat
**What it is:** Real-time voice communication between players
**Why avoid:** Moderation impossible at solo dev scale. Beyond generic toxicity — Argentine football rivalry voice chat risks coordinated harassment, doxxing coordination, real-world threat coordination. Also significant infrastructure cost.
**What to do instead:** Async preset reactions (F-105), cántico unlocks (F-103).
**Sensitive:** HIGH

### ANTI-FEATURE A-008 — Offline / Single-Player Mode
**What it is:** A standalone offline campaign or AI opponent mode
**Why avoid:** The core value is "la realidad del fútbol argentino afecta el juego." Offline mode severs this connection. It's also double the development scope for a solo dev. Explicitly excluded in PROJECT.md.
**What to do instead:** Tutorial (F-003) uses scripted PvE as onboarding only — not a game mode.

### ANTI-FEATURE A-009 — Foreign Clubs / Non-AFA Teams in v1
**What it is:** Premier League, La Liga, Copa Libertadores international clubs as player factions
**Why avoid:** Dilutes Argentine cultural specificity that is the game's entire identity. Explodes content scope for solo dev. Fans of River vs Boca don't want to fight Manchester City supporters.
**What to do instead:** AFA Primera Division only in v1. Libertadores expansion is a post-validation v2 feature.

### ANTI-FEATURE A-010 — Persistent GPS Tracking
**What it is:** Continuous location tracking stored server-side for any purpose beyond the live geo-bonus moment
**Why avoid:** Legal violation of Ley 25.326 (Argentine personal data law). Trust violation. Not necessary — geo-bonus needs only a point-in-time GPS check, not history.
**What to do instead:** Client-side one-time GPS check for stadium proximity; result sent as boolean ("near stadium: yes/no") without coordinates; no storage.
**Sensitive:** HIGH — legal

### ANTI-FEATURE A-011 — Alianzas Permanentes Between Rival Clubs
**What it is:** Formal in-game alliance mechanics allowing Boca and River fans to cooperate permanently
**Why avoid:** Breaks the core cultural lore. Boca-River cooperation is anathema to the entire identity. If players can team up with their mortal rivals, the game loses its soul. Explicitly excluded in PROJECT.md.
**What to do instead:** Temporary truce mechanics for Selección events (F-094) are the single exception — and even then, it's coded as "Argentina unida" not club cooperation.

---

## Feature Dependency Graph

```
F-001 (Club Selection)
  └─ F-002 (Pibe Creation)
  └─ F-005 (Rival Assignment)
  └─ F-010 (Rancho)
       └─ F-011 (Aguante nodes)
       └─ F-012 (Defense layout)
       └─ F-013 (Resource sinks)
       └─ F-014 (Bandera room)
       └─ F-020 (Pibe roster)
            └─ F-021 (Role system)
                 └─ F-022 (Skill trees)
                 └─ F-023 (Permadeath)
                 └─ F-024 (Loyalty)
                 └─ F-025 (Viejo mentor)
                 └─ F-026 (Vigía intel)

F-090 (AFA Fixture Feed) ← FOUNDATIONAL
  └─ F-030 (Attack windows)
       └─ F-031 (Async raids)
            └─ F-032 (Damage outcomes)
            └─ F-033 (Shields)
            └─ F-034 (FFA targeting)
            └─ F-035 (Clásico events)
            └─ F-036 (Formations)
            └─ F-037 (Emboscada config)
  └─ F-080 (Season calendar)
       └─ F-081 (Battle pass)
       └─ F-082 (End-of-season)
       └─ F-083 (Champion buff)
       └─ F-084 (Relegation penalty)
  └─ F-091 (Result bonus)
  └─ F-092 (Live match window)

F-040 (Trapo objects)
  └─ F-041 (Recovery quest)
  └─ F-042 (Bombo capture)
  └─ F-043 (Custom trapo design)
       └─ F-044 (Banderazo)
       └─ F-102 (Humiliation card)

F-050 (Heat meter)
  └─ F-051 (Cana state)
       └─ F-052 (Abogado rescue)
  └─ F-053 (Patrol events)

F-060 (Territory map)
  └─ F-061 (Zone control)
  └─ F-062 (Home zone)
  └─ F-063 (Contested zones)

F-070 (Club hierarchy)
  └─ F-071 (Leader election)
  └─ F-073 (Lugarteniente roles)
  └─ F-074 (Internal feed)

F-100 (Activity feed) ← needs F-031, F-040, F-070
F-101 (Raid replay) ← needs F-031
F-110 (Battle pass) ← needs F-080
```

---

## MVP Prioritization (Solo Dev Lens)

**Must-have for day-one launch (table stakes core loop):**
1. F-001, F-002, F-003 — Onboarding
2. F-090 — AFA Fixture Feed (without this, nothing works)
3. F-010, F-011 — Basic rancho + Aguante
4. F-020, F-021 — Pibes + roles
5. F-030, F-031, F-032 — Attack windows + raids + damage outcomes
6. F-040, F-041 — Trapo basics (steal + recover)
7. F-050, F-051 — Heat + cana
8. F-060, F-061 — Territory map
9. F-070, F-071 — Club hierarchy
10. F-080, F-082 — Season structure
11. F-100 — Feed (auto-generated, no UGC text)
12. F-120, F-121, F-122 — Moderation basics

**Defer to post-MVP (add after validation):**
- F-043 (custom trapo design) — UGC is expensive to moderate; use preset trapos in v1
- F-093 (GPS geo-bonus) — high complexity, add after core loop validated
- F-094 (Selección events) — needs fixture integration robust first
- F-113 (real-event drops) — complex event detection
- F-114 (custom cántico recording) — audio UGC pipeline too complex for v1
- F-036, F-037 (formations + emboscada planning) — add once base raid loop is fun
- F-073, F-074 (lugarteniente specialization) — add once leader system is stable
- F-086 (season recap card) — nice but not core

---

## Sensitive Feature Flags Summary

| Feature | Sensitivity | Why | Mitigation |
|---------|-------------|-----|-----------|
| F-023 (permadeath) | MEDIUM | Real loss framing | Fantasy coding, clear UI language |
| F-043 (custom trapos) | HIGH | UGC visual content | Auto + human moderation pipeline |
| F-060 (Argentina map) | LOW | Geographic territory | Stylized map, not political |
| F-090 (AFA fixture sync) | LOW | External data dependency | Legal data source, handle postponements |
| F-093 (GPS geo-bonus) | HIGH | Personal data / privacy | Opt-in, no storage, Ley 25.326 |
| F-094 (Selección) | MEDIUM | Cross-club mechanic breaks lore | Frame as national exception, not alliance |
| F-103 (cánticos) | HIGH | Real chants have violence/discrimination history | All content parodied/original, not real chants |
| F-113 (event drops) | LOW | FOMO mechanic | No paid randomness, event-triggered only |
| A-003 (loot boxes) | VERY HIGH | Gambling law | Do not build — direct purchase only |
| A-005 (real names) | VERY HIGH | Defamation, organized crime | Deny list + no real person reference |
| A-006 (politics) | VERY HIGH | Argentine political divide | Moderation deny list, apolitical tone guide |

---

## Sources

- PROJECT.md: BarraBrava project specification (all requirements validated against this)
- Clash of Clans: feature model — base building, async raids, upgrade timers, clan war seasons, resource economy (training knowledge, HIGH confidence — game extensively documented)
- Hooligans: Storm Over Europe (2002): firm management, tactical ambush, patrol/ambush loop, role-based squads (training knowledge, MEDIUM confidence — older game, limited recent documentation)
- Fortnite Battle Pass model: cosmetic-only tiers, seasonal progression, item shop rotation (training knowledge, HIGH confidence)
- Pokemon GO: GPS proximity bonuses, stadium-adjacent rewards, opt-in location (training knowledge, HIGH confidence)
- FIFA Mobile / EA FC Mobile: real fixture calendar events, result-tied bonuses, live match events (training knowledge, HIGH confidence)
- Argentine football cultural specifics: trapos, bombos, cánticos, aguante, banderazos, recibimientos, barras bravas structure, real club rivalry geography (training knowledge, HIGH confidence — well-documented cultural domain)
- Argentine data protection law (Ley 25.326): GPS/personal data handling requirements (training knowledge, MEDIUM confidence — verify with legal counsel before launch)
- Apple/Google App Store policies on violence, gambling, loot boxes (training knowledge, MEDIUM confidence — policies evolve; verify at submission time)
