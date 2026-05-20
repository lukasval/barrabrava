# Roadmap: BarraBrava v1 (MVP)

**Project:** BarraBrava — juego mobile multiplayer de barras bravas argentinas
**Target:** v1 MVP playable y monetizable, solo dev + Claude Code, 4-6 meses
**Strategy:** 7 fases. Coarse granularity. Cada fase = increment vertical jugable.

---

## Phase Overview

| # | Phase | Goal | Duration | Requirements Mapped |
|---|-------|------|----------|---------------------|
| 1 | **Foundation** | Backend, auth, club selection, primer pibe creado. End state: jugador puede crear cuenta, elegir club, ver su pibe. | 2-3 semanas | TEC-01..10, ONB-01..04, CLB-01..02, PRV-01..05 |
| 2 | **Heartbeat AFA** | Fixture feed live, ventanas de partido se abren/cierran automáticamente, push notifications funcionando. End state: jugador recibe push "ventana abierta" cuando juega su club. | 2-3 semanas | CLB-03..05, SEA-01..02, CMB-01, DAY-03 |
| 3 | **Core Loop Laboral** | Sistema de carrera, aguantadero, recursos, trabajos diarios. End state: jugador puede laburar día sin partido, ganar plata, hacer turno en día de partido para pozo barra. | 3-4 semanas | AGT-01..05, PIB-01..07, JER-01..04, ONB-05..06 |
| 4 | **Combate Estratégico** | Sistema de combate completo (6 decisiones + loadout + intel + resolución determinística). End state: jugador planifica ambush, ataca, gana/pierde con stakes reales. | 4-5 semanas | CMB-01..10, PIB-08, HEA-01..05, AIB-01..05 |
| 5 | **Mundo Social** | Mapa territorial, feed con cronista LLM, facciones, replays, daily mini-puzzle. End state: jugador ve estado del mundo, lee narrativa, juega daily, participa en facción. | 3-4 semanas | MAP-01..05, SOC-01..06, DAY-01..02, JER-05..07, MOD-01..06 |
| 6 | **Monetización + Seasons** | Battle pass, shop, IAP, seasonal modifiers, end-of-season ritual. End state: jugador puede comprar Fichas, completar battle pass, vivir transición de temporada. | 3-4 semanas | MON-01..07, SEA-03..07 |
| 7 | **Polish + Soft Launch** | AI barras refinadas, anti-cheat, balance, performance, store submission. End state: app en TestFlight + Play Internal, soft launch Buenos Aires. | 2-3 semanas | TEC-09..10 reinforced, balance pass, store assets |

**Total estimated:** 19-26 semanas (≈ 5-6 meses solo dev con Claude Code)

---

## Phase 1: Foundation ✅ COMPLETE (2026-05-17)

**Goal:** Player puede crear cuenta, elegir club entre ~130, crear su pibe, ver pantalla de inicio funcional.

**Requirements:**
- TEC-01..10 (Godot, Nakama, Postgres, FCM, R2, RevenueCat, GameAnalytics, CI/CD, server-auth, anti-cheat baseline)
- ONB-01..04 (registro, club selection, facción inicial, creación pibe)
- CLB-01..02 (identidad paramétrica clubes, disclaimer fiction)
- PRV-01..05 (privacy policy, AAIP registro, account delete, consents)

**Success criteria — FINAL STATUS:**
1. ⏳ App buildea para iOS y Android desde GitHub Actions → DEFERRED to Phase 7 (see DEFERRED-CI.md). Workflow exists at `.github/workflows/build-android-debug.yml` with `workflow_dispatch` trigger only. Local builds work.
2. ✅ Player puede registrarse con email + login — verified via smoke-test.sh against live Nakama
3. ✅ Lista de 133 clubes con identidades paramétricas — seeded idempotently via Nakama TS runtime InitModule
4. ✅ Player puede elegir club, crear pibe con stats base — RPCs `get_clubs` + `create_pibe` LIVE, Godot screens wired via FlowRouter
5. ✅ Datos persisten en Postgres via Nakama — Storage collections `clubs`, `pibes`, `meta`
6. ✅ Privacy policy en español accesible desde app — `web/privacy/index.html` LIVE on GitHub Pages, AuthScreen routes via `OS.shell_open(AppConfig.PRIVACY_URL)`

**Bonus delivered (beyond success criteria):**
- Privacy policy ES + EN (mirror)
- Terms of Service ES
- Password Reset page (stub, Phase 2 wires real Resend)
- PRV-05 consent gate (AcceptTerms CheckBox enforced before register)
- AAIP-REGISTRATION.md checklist (trámite deferred to Phase 6/7)
- LEGAL-NOTES.md (Ley 25.326 + 24.240 + AFA parodia mitigation)
- 8 shield archetypes for parametric club identities

**Outputs:**
- Godot 4.3 project + 7 onboarding screens + 3 reusable components + 7 autoloads
- Nakama 3.21.0 LIVE at https://nakama-production-7ea8.up.railway.app + Postgres
- 5 RPCs registered (get_clubs/create_pibe/delete_account + 2 password_reset stubs)
- 133-club seed (Primera 28, Nacional 38, B Metro 17, Federal A 30, C Metro 20) — lunfardo parody names + paletas + barrios
- Web pages LIVE at https://lukasval.github.io/barrabrava/ (landing + privacy ES/EN + terms + reset-password)
- GitHub Pages deploy workflow auto-triggered on web/** changes
- INFRA-NOTES + DEFERRED-CI + AAIP-REGISTRATION + LEGAL-NOTES docs

**Carried over to Phase 2:**
- Custom domain registration → swap AppConfig.SITE_BASE constant
- Resend SMTP wiring → un-stub `request_password_reset` + `confirm_password_reset` RPCs
- Email contacts in privacy/terms become real (currently placeholder `legal@barrabrava.com.ar`)

---

## Phase 2: Heartbeat AFA ✅ COMPLETE-WITH-DEFERRAL (2026-05-18)

**Goal:** El juego respira al ritmo del fútbol real. Ventanas se abren/cierran automáticamente, jugadores reciben push cuando su club juega.

**Requirements:**
- CLB-03..05 (fixture feed, admin override, cache TTL)
- SEA-01..02 (season = torneo real, start/end automáticos)
- CMB-01 (ventana sincronizada con fixture: 2h pre, 2h post)
- DAY-03 (push notifications: ventana abre, daily reset)

**Success criteria:**
1. Scheduler poll API-Football cada 15 min día de partido, cada 6h otros días
2. Match windows se generan auto al detectar fixtures próximos
3. Admin panel permite override manual (postergaciones)
4. Push notification se dispara cuando ventana abre (FCM topics por club)
5. Soporte para divisiones bajas vía scraping/manual feed (B Metro, Federal A, C Metro)
6. Season detected automáticamente cuando torneo real arranca/termina

**Outputs:**
- AFA Scheduler service (cron + pg_notify)
- Admin override panel (solo dev)
- FCM topics + device token management
- Fixture cache + fallback logic

**Plans:** 9 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0: Storage constants + env vars bootstrap + test fixture RPC + human checkpoint
- [x] 02-02-PLAN.md — Wave 1: Scheduler (leaderboard cron) + API-Football + window state machine + season detection
- [x] 02-03-PLAN.md — Wave 1: FCM v1 OAuth2 integration + topic_name validator + wire sendTopic into windows
- [x] 02-04-PLAN.md — Wave 1: Resend token machinery (un-stub Phase 1 RPCs; RESEND_ENABLED gate)
- [x] 02-05-PLAN.md — Wave 1: Admin override plane (7 RPCs + bearer middleware + audit log)
- [x] 02-06-PLAN.md — Wave 1: User RPCs (register_fcm_token + get_current_window)
- [ ] 02-07-PLAN.md — **DEFERRED to Phase 7** — Android FCM GodotPlugin requires Android Studio + Firebase Android SDK + signed APK toolchain (user-side device-build work)
- [x] 02-08-PLAN.md — Wave 2: Godot client wiring (AppConfig flip + NakamaService + PlayerStore + HomeScreen banner)
- [x] 02-09-PLAN.md — Wave 3: heartbeat-test.sh (20 invariants) + admin-curl-examples + INFRA-NOTES Phase 2 sections

---

## Phase 3: Core Loop Laboral (Executing — Wave 5 complete)

**Goal:** Jugador vive el ciclo diario: día con partido → turno barra; día sin partido → profesión personal. Aguantadero crece. Pibes se reclutan.

**Requirements:**
- AGT-01..05 (aguantadero geográfico, niveles, recursos, bandera room)
- PIB-01..07 (roster, roles tácticos, traits emergentes, sistema laboral, turnos, profesiones, skills)
- JER-01..04 (niveles jerárquicos, promoción, Mesa Chica, líder elección)
- ONB-05..06 (tutorial primera salida + recompensa primera sesión)

**Success criteria:**
1. Jugador puede ver y mejorar su aguantadero (5 niveles iniciales)
2. Recursos (Plata, Aguante, Reputación, Visto Bueno Cana) funcionan
3. Reclutar pibes con roles + traits aleatorios
4. Día sin partido: elegir profesión → gana Plata personal
5. Día con partido: hacer turno → consume Energía, genera Aguante grupal + Reputación
6. Subir jerarquía vía Reputación + voto Mesa Chica
7. Tutorial onboarding completo (<10 min)

**Outputs:**
- Player State Service completo
- Resource engine (transactional)
- Profession system + skill trees
- Hierarchy logic (promotion, voting)
- Aguantadero upgrade UI

**Plans:** 6 plans

Plans:
- [x] 03.01-foundations-PLAN.md — Wave 1: storage_keys + StorageKeys.gd mirror + AI baseline seeder + 2 cron leaderboards (bb_recruit_05_art, bb_mesa_recompute_1h) + 3 admin RPCs (force_recruit_refresh, grant_rep, seed_ai_baseline)
- [x] 03.02-read-side-rpcs-PLAN.md — Wave 2: pure helpers (idle_accrual, rank, pibe_factory) + validation extensions + 4 read RPCs (get_roster w/ Phase 1 migration, get_aguantadero w/ auto-bootstrap, get_barra_state w/ debounced Mesa recompute, get_recruit_pool w/ trait_2 redaction)
- [x] 03.03-write-side-rpcs-PLAN.md — Wave 3: 6 write RPCs (assign_profession, collect_idle, recruit_pibe w/ optimistic concurrency, upgrade_aguantadero, submit_turno w/ idempotency-marker-first, complete_tutorial w/ elapsed_ms telemetry) + recruit_cron + mesa_cron handlers + seasons.ts Líder election hook + upgrade admin stubs; 28 RPCs total; 176.8 kB bundle
- [x] 03.04a-godot-foundation-PLAN.md — Wave 4: 4 autoload extensions (AppTheme/NakamaService/PlayerStore/FlowRouter, complete_tutorial wrapper plumbs elapsed_ms) + 9 reusable components (PibeCard, RecruitCard, ResourceWidget, RankBadge, TraitChip, EnergiaBar, ProfessionIcon, SkillProgressRing, TurnoModal). Autonomous, no checkpoint. FONT_HEADING 22→20. 22 files. Vocab audit 0.
- [x] 03.04b-godot-screens-PLAN.md — Wave 5: HomeScreen extension + 6 new screens (RosterScreen + RecruitScreen + PibeDetailScreen + ProfessionAssignScreen + AguantaderoScreen + TutorialScreen 6-step state machine w/ tutorial_start_at_ms capture + elapsed_ms forwarding). Walkthroughs A–E → `03.04b-godot-screens-HUMAN-UAT.md` (pending user playthrough via `/gsd-verify-work`)
- [ ] 03.05-validation-PLAN.md — Wave 6: laboral-test.sh (19 invariants incl. LAB-TUTORIAL-DURATION) + admin curl recipes + INFRA-NOTES Phase 3 sections (5) + VALIDATION.md rows + STATE.md closing w/ Phase 3 → Phase 7 deferral subsection (4 items: LAB-IDLE-CAP, LAB-IDLE-RATE-TRAPITO partial, LAB-TURNO-ENERGY-GATE energy-low, LAB-LIDER-ELECTION)

---

## Phase 4: Combate Estratégico

**Goal:** Core gameplay. Jugador planifica ambush con 6 decisiones, ataca, gana o pierde. Stakes reales (permadeath, robo trapo). IA barras pueblan el mundo.

**Requirements:**
- CMB-01..10 (ventanas, live match, 6 decisiones, loadout, defensa, resolución, outcomes, contraintel, replay)
- PIB-08 (permadeath logic)
- HEA-01..05 (heat meter, cana, abogado, decay)
- AIB-01..05 (IA barras pueblan todos los clubes, atacan/defienden, generan eventos)

**Success criteria:**
1. Player puede armar ambush plan con las 6 decisiones (intel, squad, ubicación, timing, formación, escape)
2. Loadout elegible con trade-offs (bengalas, palos, capucha, bombo, pelotas, manos vacías)
3. Defensor pre-configura defense (auto-defense IA ejecuta)
4. Resolución determinística por frentes + 10% azar
5. Outcomes escalados funcionan (rasguñazo → robo trapo)
6. Trapo robado aparece en bandera room del atacante + feed público
7. Sistema heat/cana operativo (rescate vía abogado)
8. Pibes mueren permadeath si quedan presos 24h
9. IA barras tienen pibes ocupando facciones, generan ataques, contribuyen a feed
10. IA scales con jugador (no whale-stomps-newbie)

**Outputs:**
- Combat Engine (server-authoritative, async)
- IA barra simulation service
- Heat/cana state machine
- Replay seed + action log system
- Combat UI (planning + result + replay viewer)

---

## Phase 5: Mundo Social

**Goal:** Jugador ve estado del mundo, lee narrativa del Cronista, juega daily mini, participa en facciones, comparte momentos.

**Requirements:**
- MAP-01..05 (mapa Argentina, zonas, ownership, home zone, updates)
- SOC-01..06 (feed global/club/facción, Cronista LLM, replay shareable, humiliation card, no chat)
- DAY-01..02 (daily mini-puzzle, daily objectives)
- JER-05..07 (facciones con líderes, drama emergente)
- MOD-01..06 (moderación: filtros nombres, reportes, sin UGC imagen, tono ficción)

**Success criteria:**
1. Mapa Argentina visible y actualizado tras ventanas de combate
2. Feed con 3 tabs (global, club, facción) auto-generado por eventos
3. Cronista LLM (Haiku) produce crónica semanal por club + historia personal
4. Replay shareable con link público
5. Trapo humiliation card auto-generada al robo (formato compartible)
6. Daily mini-puzzle táctico funcional (1 min, situación preset)
7. Facciones tienen líderes (capos), pueden tener drama interno básico
8. Sistema de reportes operativo
9. Sin chat texto libre confirmado

**Outputs:**
- World State Service + Map UI
- Social Feed Service
- Cronista LLM integration (Haiku)
- Daily mini-puzzle generator (offline / preset)
- Moderation queue + admin UI
- Faction structure + leader logic

---

## Phase 6: Monetización + Seasons

**Goal:** App ya genera revenue. Battle pass funciona, shop rota, IAP validado. Seasons transicionan correctamente. Modifiers rotativos viven el juego.

**Requirements:**
- MON-01..07 (Fichas, battle pass, shop, drops realidad, sin gacha, ARS pricing, gifting)
- SEA-03..07 (seasonal modifiers, end-of-season, champion buff, relegation, pre-season)

**Success criteria:**
1. RevenueCat valida IAP server-side (Apple + Google)
2. Battle pass con 2 tracks (free + premium) funcional
3. Shop rotativo weekly con cosméticos (outfit, trapos preset, bombos, humo, cánticos, animations)
4. Cosmetic entitlements aplicados client-side desde server
5. Drops vinculados a eventos reales (gol Selección → drop nacional)
6. Pricing ARS-tiered (mínimo ARS 500-1000, BP ~ARS 2-4K)
7. Seasonal modifiers se aplican (fuego, cana brava, pibes, etc.)
8. End-of-season ritual: snapshot, soft reset, rewards distribuídos
9. Champion AFA real → buff aplicado season siguiente
10. Relegation → penalty aplicado
11. Pre-season window de 2 semanas sin combate

**Outputs:**
- Commerce Service + IAP validation
- Cosmetic catalog + CDN delivery
- Battle pass progression engine
- Season transition job (idempotente)
- Real-event drop trigger system

---

## Phase 7: Polish + Soft Launch

**Goal:** App lista para producción. AI refinadas, anti-cheat operativo, balance ajustado, store submission completa, soft launch en Buenos Aires metro.

**Requirements:**
- Refuerzo TEC-09..10 (server-auth coverage 100%, anti-cheat baseline operativo)
- Balance pass: combate, economía, progresión
- Performance: load times <3s, batería razonable
- Store assets: screenshots, descripciones (framing estratégico, no "violence")
- Legal review pre-launch (parodia clubes, disclaimer)
- Closed beta con ~200 Argentine football community
- Soft launch CABA + GBA antes de national rollout

**Success criteria:**
1. Anti-cheat: rate limits, plausibility checks operativos
2. Balance: ningún build dominante, casual+hardcore ambos viables
3. Performance: cold start <3s, in-game UI 60fps
4. App Store + Play Store submissions aprobadas (PEGI 12 / ESRB T)
5. Privacy policy + AAIP registration completados
6. Press kit listo (FAQ "es ficción", outreach Argentine gaming journalists)
7. Closed beta de 200+ players ran 2-3 semanas
8. Soft launch en CABA + GBA con métricas baseline (D1 retention >25%, D7 >10%)

**Outputs:**
- Production-ready build (iOS + Android)
- Store listings (App Store, Play Store)
- Press kit + legal docs
- Closed beta feedback incorporated
- Soft launch metrics dashboard

---

## Phase Dependencies

```
Phase 1 (Foundation)
   ↓
Phase 2 (Heartbeat AFA) ← needs auth + clubs
   ↓
Phase 3 (Core Loop Laboral) ← needs ventanas + pibes
   ↓
Phase 4 (Combate Estratégico) ← needs core loop + ventanas
   ↓
Phase 5 (Mundo Social) ← needs combate (eventos para feed)
   ↓
Phase 6 (Monetización + Seasons) ← needs todo lo anterior + seasons funcionando
   ↓
Phase 7 (Polish + Soft Launch)
```

**No parallelization** entre fases (solo dev) — secuencial estricto.

---

## Risk Hotspots (referencia PITFALLS.md)

| Phase | Top Risk | Mitigation |
|-------|----------|-----------|
| 1 | Identidad paramétrica clubes — trademark | Parodia explícita, "Liga Aguante" umbrella, IP lawyer 1h review |
| 2 | AFA feed inestabilidad | API-Football paid tier desde día 1 + admin manual override |
| 3 | Sistema laboral feels tedious | Balance: turnos rápidos (<2 min), recompensas claras inmediatas |
| 4 | Combate complejo abruma casuales | UX tutorial fuerte + "modo simple" con defaults sugeridos |
| 5 | Cronista LLM hallucina nombres reales | Constrain prompt + deny list, vector store de nombres aprobados |
| 6 | Store rejection por temática | Naming en lunfardo + screenshots celebración + press kit |
| 7 | Day-1 population empty | AI barras ya pueblan desde Phase 4. Closed beta seed. Soft launch metro. |

---

## Out of Scope para v1 (refer to REQUIREMENTS.md)

Defer post-MVP:
- Citaciones cara a cara → v1.1
- Top Boys públicos → v1.1
- Reputación pública de barra → v1.1
- Metagame comunitario Helldivers-style → v1.1
- Emotes anti-club → v1.1
- Mecánica de topo → v1.1
- GPS estadio bonus → v1.1
- Visual progression avatar avanzado → v1.1
- Hitos cinematic → v1.1
- Custom trapo UGC → v2
- Viajes visitante → v2
- Persecuciones cana → v2
- Arco narrativo LLM → v2
- Caravanas logística → v2
- Diplomacia → v2
- Última Fecha mega-event → v2

---

## Next Steps

1. Run `/gsd-plan-phase 1` to create detailed PLAN.md for Phase 1 (Foundation)
2. Begin execution with `/gsd-execute-phase 1`

---

*Roadmap created: 2026-05-14*
