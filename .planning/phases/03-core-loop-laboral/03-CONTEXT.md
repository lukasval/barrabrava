# Phase 3: Core Loop Laboral - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

El jugador vive el ciclo diario de la barra. Al final de esta fase:

1. **Roster de pibes** (max 5 inicial, escala con aguantadero) reclutables vía pool diario procedural (3/día refresh madrugada). Cada pibé tiene rol táctico + 1 trait visible + 1 trait oculto + skill grindeable.
2. **Trabajo idle offline**: jugador asigna pibé a profesión (trapito / vendedor / patovica / remisero) → genera **Plata** mientras está offline. Cap acumulado 12h por pibé. Skill grind por horas trabajadas multiplica rate.
3. **Turno de Barra durante ventana de partido** (Phase 2 scheduler existente): HomeScreen muestra botón "Hacer turno" cuando `match_window.state == "open" | "live"`. Jugador selecciona pibes, consume Energía (~30-50). Output split: ~50 **Aguante** al pozo grupal del club + ~20 **Reputación** al jugador dueño por pibé.
4. **Aguantadero geográfico** (HQ en barrio real del club, ya pickeado en onboarding). 5 niveles upgradeables (capacidad roster, almacén, bandera room display, defensa). Costo upgrade Plata + tiempo. Bandera room muestra trapos robados (Phase 4 los popula; Phase 3 ya tiene UI vacía).
5. **Jerarquía auto-promote por Reputación**: Pibe (default) → Soldado (500 Rep) → Capo (2500 Rep) → Mesa Chica (top 5 del club by Rep) → Líder (highest Rep at season-end AFA). Sin votación interna para sub-rangos en v1.
6. **Mesa Chica = top 5 del club por Reputación**, mezcla AI+humanos. Day 1: 100% AI. Cuando un humano supera Rep de un miembro AI, lo reemplaza automático. Sin acciones de Mesa todavía (gameplay político real desde Phase 5).
7. **Visto Bueno Cana (VBC)** ya existe como recurso. Source único Phase 3: el **Líder de Barra** puede dedicar tiempo a la profesión "hablar cana" (PIB-04). Phase 4 lo hard-usa para combate/heat.
8. **Tutorial primera salida (<10 min)** (ONB-05): scripted onboarding desde HomeScreen post-creación de pibé → reclutar primer pibe → asignar a profesión → primer turno simulado. Recompensa (ONB-06): primer trapo de barra (cosmético, visible en bandera room) + primer cántico desbloqueado.

**Scope exacto Phase 3:**
- 4 nuevos recursos en player state: **Plata** (personal), **Aguante** (grupal del club), **Reputación** (personal), **VBC** (personal, Líder-only generation).
- 4 storage collections nuevas: `pibes` (extend Phase 1, multi-pibé), `aguantaderos` (per-user singleton), `barra_state` (per-club, pozo Aguante + Mesa Chica snapshot + Líder current), `recruit_pool` (per-club daily 3 picks, server-generated).
- Idle work tick: server-side accrual on read (lazy compute desde `last_tick_at` + assigned profession). Cap 12h. Sin cron necesario para work (lazy compute).
- Daily recruit pool refresh: server cron ~05:00 ART regenera 3 pibes/club. Reusa pattern de scheduler/tick.ts Phase 2.
- Turno de Barra RPC: `submit_turno(fixture_id, pibe_ids[])` — valida ventana abierta + pibes con Energía + escribe pozo grupal + Reputación personal.
- Pibe skill grind: cada hora trabajada en una profesión bump `skill_{profession}` en pibé record. Multiplier rate = clamp(1 + skill * 0.05, 1, 6).
- Aguantadero upgrade RPC: `upgrade_aguantadero(target_level)` valida costo Plata + sets `level + upgraded_at`.
- 7 Godot screens nuevas (estimado): RosterScreen, RecruitScreen, PibeDetail, ProfessionAssign, AguantaderoScreen, TurnoModal, TutorialScreen (extendido). HomeScreen ya existe — se le agregan widgets de recursos + acciones rápidas.

**No incluye Phase 3:**
- Combate, ambushes, ataques contra otras barras (Phase 4).
- Permadeath de pibes / sistema cana / abogado / heat meter (Phase 4 — PIB-08, HEA-*).
- Mecánica activa de facciones (votos, drama, golpes de estado) — facción visible solo como label en perfil. JER-05..07 defer Phase 5.
- Feed social, Cronista LLM, mapa territorial (Phase 5).
- Mecánica completa de Mesa Chica voting (decisiones grupales, uso del pozo). Phase 3 expone Mesa como label + Top 5 list. Acciones de Mesa = Phase 5.
- Replay raids, daily mini-puzzle, daily objectives push (Phase 5).
- Monetización IAP / Fichas / Battle Pass (Phase 6). Plata es soft currency in-game, no IAP.
- Challenge directo al Líder mid-season (JER-04 stretch v1.1).
- Cosméticos shop, gifting, drops Selección (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Day Cycle & Work Model
- **D-01:** **Idle generation offline**. Cada pibé asignado a una profesión genera Plata mientras el jugador está desconectado. Server compute lazy on read: `accrued = (now - last_tick_at) * rate`, clamp a `idle_cap_hours`. No cron — solo recálculo al abrir app o al ejecutar otro RPC del player.
- **D-02:** **Idle cap = 12h por pibé**. Después de 12h sin check-in, el pibé deja de acumular. Forza ~2 check-ins diarios (mañana + noche) sin ser punitivo. Server stamp `last_collected_at` al cobrar.
- **D-03:** **Turno de Barra = active commit durante match window**. HomeScreen (existing Phase 2 banner) gana botón "Hacer turno" cuando `current_window.state == "open" | "live"`. Modal: selección de pibes con suficiente Energía → confirma → pibes quedan "en turno" hasta `closes_at` → recompensa se acredita server-side al cerrar ventana (o al primer read post-cierre, lazy).
- **D-04:** **Energía per-pibé**. Cada pibé tiene `energia: int (0..100)`. Regen pasiva `+5/h` offline (lazy compute). Turno de barra consume 30-50 (configurable por intensidad del partido — superclásico = 50, partido normal = 30; Phase 3 hardcode 40 base, multiplier viene Phase 5/6). Jugador rota pibes entre ventanas. Energía NO es Plata-buyable en Phase 3 (cero IAP de energía).

### Resource Economy
- **D-05:** **Plata rate = base profesión × skill multiplier**. Base por profesión:
  - trapito: 10 Plata/h
  - vendedor (chori/paty/entradas/merch/bengalas): 15 Plata/h
  - patovica: 20 Plata/h
  - remisero: 25 Plata/h
  - "hablar cana" (Líder-only): 0 Plata/h, +1 VBC/h
  Skill multiplier: `1 + skill_horas / 100`, clamped `[1, 6]`. Pibé con 500h en una profesión genera 6× rate base.
- **D-06:** **Turno de Barra output split per pibé en turno exitoso**:
  - +50 Aguante al pozo grupal del club (`barra_state.aguante_pool`)
  - +20 Reputación al jugador dueño del pibé (`players.profile.reputacion`)
  Output asume pibé con `energia >= 30` al inicio del turno. Si no tenía energía, no participa. Multiplicadores futuros (loadout, recibimiento, formación) son Phase 4-5.
- **D-07:** **VBC source único Phase 3 = "hablar cana" del Líder**. Solo el jugador con `rank == "lider"` en su club puede asignar un pibé a "hablar cana". Rate fijo `+1 VBC/h`, no skill scaling. Si nadie es Líder humano (todo el club es AI), el AI Líder acumula VBC del club que se distribuye Phase 4 al sistema heat. Sin trade-Plata-por-VBC en v1.
- **D-08:** **Sin daily caps duros**. El throttle es natural: Energía regen 5/h + idle cap 12h + skill grind lento (100h trabajadas = +1 nivel skill). Veteranos generan más que nuevos por roster size + skill, no por bypass de caps. Catch-up modifier no se implementa en Phase 3 (revisitar si analytics post-launch muestran gap).

### Recruitment Flow
- **D-09:** **Daily recruit pool refresh, 3 pibes/día por club**. Server cron ~05:00 ART (reusa pattern `scheduler/tick.ts`) regenera la pool global del club. Storage: `recruit_pool/{club_id}` value `{ generated_at, picks: [...3] }`. Si jugador no recluta hoy, las cards se reemplazan mañana — sin save-for-later.
- **D-10:** **Trait reveal asimétrico**: card del pibé en recruit screen muestra `nombre, rol, avatar, trait_1`. `trait_2` oculto hasta reclutamiento (revealed con animación). Crea momento "abrir sobre" sin feel gacha porque ya conocés el rol + 1 trait. Costos visibles antes de reclutar.
- **D-11:** **Spawn procedural infinito**. Server genera por pick:
  - Nombre: `apodo_lunfardo + " " + nombre_pibe` (listas hardcoded: `["El Tano", "El Negro", "El Pibe", "Mauri", "Lucho", "Cabezón", "Ruso", "Toto", ...]`).
  - Avatar: composite paramétrico desde sprites (pelo + remera + accesorio) — reusa pattern Phase 1 PibeCreator si existe; sino seed-driven random hasta tener illustration system.
  - Rol: random weighted (trompada 25%, aguantador 20%, corredor 15%, vigía 10%, pirotécnico 10%, abogado 5%, viejo 5%, líder 10% — líderes son raros).
  - Traits: 2 random de pool (Cabezón, Pies de plomo, Camorrero, Buchón, Pichón, Cordobés, Porteño, Bostero-detrás, Pícaro, Aguantador). Mezcla positivo/negativo.
- **D-12:** **Costo reclutamiento escalado por rango del jugador**:
  - Pibe (default rank): puede reclutar hasta 2 pibes total, costo `500 Plata + 0 Rep`.
  - Soldado: hasta 5 pibes total, costo `400 Plata + 100 Rep mín`.
  - Capo: hasta 10 pibes total, costo `300 Plata + 500 Rep mín`.
  - Mesa Chica / Líder: hasta 20 pibes total, costo `200 Plata + 1000 Rep mín`.
  Costos por pibé reclutado, no por slot. Roster size cap depende de **aguantadero level** (5 / 8 / 12 / 16 / 20), no de rango — rango solo gate de cost/Rep mínimo para reclutar más.

### Hierarchy
- **D-13:** **Auto-promote por threshold de Reputación**, sin votación para sub-rangos:
  - Pibe → Soldado: 500 Rep
  - Soldado → Capo: 2500 Rep
  - Capo → Mesa Chica: top 5 del club by Rep (auto-evaluate on Rep change, displace lowest-Rep Mesa member si nuevo entrante tiene más).
  - Mesa Chica → Líder: highest Rep al cierre de season AFA.
  Promote/demote es server-authoritative, escrito en `players.profile.rank` + push notification "ascendiste a X" / "salió tu lugar en la Mesa". Demote es posible si caés del top 5.
- **D-14:** **Mesa Chica = top 5 del club por Reputación, mixto AI/humano**. Cómputo: server mantiene `barra_state.mesa_chica` = array de 5 `{ player_id | ai_id, rank: "mesa", reputacion }`. AI ids tienen prefix `ai_{club_id}_{slot}`. Recompute on Rep change (debounced ~5 min). Day 1: 5 AI miembros con Rep sintética. Cuando humano sube Rep arriba del Mesa AI más bajo, lo reemplaza. AI baseline Rep escala con `barra_age_days` para que humanos puedan catch up.
- **D-15:** **Líder de Barra = highest Rep at season-end AFA**. Trigger: Phase 2 `season_state.status` transitions `active → ended` → server compute Líder de cada club (humano si supera AI top, sino AI). Persistente para próxima season hasta nuevo end. v1: sin elección activa, sin challenge mid-season. JER-04 voto + challenge directo = stretch v1.1.
- **D-16:** **Facciones internas visibles only en Phase 3**. ONB-03 (Phase 1) ya pickea facción inicial. Phase 3: facción aparece como label en perfil + storage `players.profile.faccion`. Sin Capo de Facción, sin drama, sin votos. JER-05..07 enteros defer a **Phase 5 (Mundo Social)** donde feed/Cronista pueden narrar drama. Mantiene Phase 3 focused en core loop.

### Claude's Discretion
- Storage schema detallado de cada collection (shape de JSON values) — seguir pattern Phase 2 (`match_windows`, `fcm_tokens`).
- Idempotencia de RPCs (turno submission, recruit, upgrade) — patrón Phase 2 con marker fields tipo `notified_open_at`.
- RPC naming exacto (probable: `submit_turno`, `assign_pibe_profession`, `recruit_pibe`, `upgrade_aguantadero`, `collect_idle`, `get_recruit_pool`, `get_roster`, `get_barra_state`).
- Validation server-side de inputs (rango, costo Plata, slots disponibles, energía suficiente, ventana abierta).
- Godot screens layout exacto + componentes reusables — seguir UI-SPEC pattern Phase 1 si emerge. NavButton existing reusable. ClubCard pattern reusable para PibeCard.
- AI baseline Rep curve (lineal / exponencial / step). Probablemente `ai_rep_baseline = barra_age_days * 50 + club_division_weight`.
- Tutorial scripted state machine — probable Godot TutorialScreen extendido con steps + flags en PlayerStore.
- Avatar composition paramétrica vs preset — Claude decide en research/plan basado en sprites disponibles.
- Procedural name list (apodos lunfardo) — Claude amplía la lista inicial en plan.
- Trait pool list completa — Claude refina basado en REQUIREMENTS PIB-03 + sabor argentino.
- Plata/Rep/Aguante starting balance al crear cuenta — Claude decide (probable 0/0/0 con tutorial reward chiquito).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — AGT-01..05, PIB-01..07, JER-01..04, ONB-05..06 mapped to Phase 3 (lines 31-56, 14-19).
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria, outputs (lines 107-132).
- `.planning/PROJECT.md` — Eje 1 (laboral), Eje 2 (jerarquía), Eje 3 (facciones) descritos lines 24-26.

### Prior Phase Decisions (carrying forward)
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 storage/RPC patterns establecidos.
- `.planning/phases/02-heartbeat-afa/02-CONTEXT.md` — match window state machine, FCM topics, admin RPC pattern, idle/cron patterns. **D-05..D-08 de Phase 2** (match window state) son inputs directos al Turno de Barra trigger.
- `.planning/STATE.md` — open decisions §Phase 3 line 104: "laboral resources, work intervals, ventana-open bonus mechanic" → resuelto en este CONTEXT.

### Code Anchors (existing patterns to mirror)
- `nakama/src/storage_keys.ts` — Source of truth for collection/key constants. Phase 3 agrega `COL_AGUANTADEROS`, `COL_BARRA_STATE`, `COL_RECRUIT_POOL`, `COL_TURNOS` (or reuses pibes). Client mirror: `scripts/autoloads/StorageKeys.gd`.
- `nakama/src/rpc/create_pibe.ts` — Pattern de write a `pibes` collection. Phase 3 multi-pibé.
- `nakama/src/rpc/get_current_window.ts` — Pattern de player RPC read + Phase 2 match window. Turno submit checkea contra esto.
- `nakama/src/rpc/admin_inject_test_fixture.ts` + `nakama/src/util/admin_auth.ts` — Pattern para admin RPCs si Phase 3 necesita admin helpers (probable: `admin_force_recruit_refresh`, `admin_grant_rep`).
- `nakama/src/scheduler/tick.ts` — Pattern para daily cron (recruit pool refresh ~05:00 ART). Goja AST gotcha documentado: inline registration inside InitModule body, no helpers.
- `nakama/src/scheduler/seasons.ts` — Hook para season-end trigger del Líder election.
- `scripts/autoloads/PlayerStore.gd` — Cache profile + signals pattern. Phase 3 extiende con `pibes: Array`, `aguantadero: Dictionary`, `recursos: Dictionary`, signals `roster_updated`, `recursos_updated`.
- `scripts/autoloads/NakamaService.gd` — RPC wrapper pattern (Phase 2 added 3 methods for FCM/window). Phase 3 agrega ~7 new wrappers.
- `scripts/screens/HomeScreen.gd` — Pattern de screen + `_notification(NOTIFICATION_APPLICATION_RESUMED)` para refresh on resume. Phase 3 lo extiende con widgets de recursos + atajos.
- `scripts/components/ClubCard.gd` + `.tscn` — Pattern reusable para `PibeCard`.
- `nakama/test/heartbeat-test.sh` — Pattern para invariants test bash. Phase 3 sumará invariants laborales (idle accrual idempotency, turno output split, recruit refresh idempotency, rank threshold transitions).

### Tone & Safety Constraints
- `CLAUDE.md` §Tone — lunfardo / caricaturesco / apolítico / sin nombres reales de barras / parodia de clubes.
- `CLAUDE.md` §Top Risks — App Store rejection "gang violence". UI/copy debe enmarcar lunfardo + folklore, no glorificar violencia. Trapito/vendedor/patovica = trabajos reales argentinos, no romantización delictiva.
- PIB-04 nota: "el líder tiene tareas propias (negociar dirigentes, conseguir entradas, hablar cana)" — VBC source en D-07 honra esto.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`StorageKeys.gd` ↔ `storage_keys.ts` mirror pattern**: Phase 1 CR-01 bug taught the lesson — añadir nuevas collections requiere ambos lados. Phase 3 lista de adds documentada arriba.
- **`PlayerStore.gd`**: cache + signals + load_from_server pattern. Solo extender con nuevos campos + signals; no rewrite.
- **`AppConfig.gd`**: feature flags + asserts. Phase 3 puede agregar `LABORAL_ENABLED = true` para encender el sistema gradualmente si hace falta (no obligatorio).
- **`NakamaService.gd`**: RPC wrappers async + signal pattern (`window_open_received` style). Phase 3 RPCs siguen este pattern.
- **`scripts/components/ClubCard.gd/.tscn`**: card reusable como template para `PibeCard` + `RecruitCard`.
- **`scripts/components/NavButton.gd/.tscn`**: bottom nav. Phase 3 wires "Aguantadero", "Roster", "Reclutar", "Inicio" en orden.
- **`AppTheme.gd`**: theme constants — colors/typography/spacing reusables.
- **`nakama/src/util/validation.ts`**: input validation patterns ya establecidos.
- **`nakama/src/util/admin_auth.ts`**: bearer-token check si Phase 3 necesita admin RPCs.

### Established Patterns
- **Server-authoritative storage**: todas las mutaciones de recursos via RPC con validation + atomic write. Cliente nunca calcula recursos.
- **Lazy compute on read**: idle accrual + Energía regen + season triggers compute on read, no cron exhaustivo. Phase 2 pattern.
- **Idempotent RPCs**: marker fields (`notified_open_at`, `last_collected_at`) previenen double-credit. Phase 3 turno needs same.
- **Goja AST gotcha (Nakama TS runtime)**: cron + handler registration MUST be inline inside `InitModule` body, no helper functions. Phase 2 logged 3 hot-fixes for this. Phase 3 daily recruit pool cron must follow.
- **Storage keys constants** (no string literals scattered): COL_/KEY_ exports + GDScript const mirror.
- **Push notification on rank transition**: pattern análogo a window_open push (Phase 2 D-12) puede usarse para "ascendiste a Soldado/Capo/Mesa/Líder". Phase 3 plan decide si lo activa o defer a Phase 5.
- **Test invariants bash script**: extender `nakama/test/heartbeat-test.sh` o crear `laboral-test.sh` con invariants nuevos.
- **AppConfig feature flag flip**: Phase 1 → 2 flipped `PUSH_NOTIFICATIONS_ENABLED`. Phase 3 puede flippear `LABORAL_ENABLED` si quiere gradual rollout en testing.

### Integration Points
- **HomeScreen**: existing window banner + delete_account. Phase 3 le agrega resource widgets (Plata, Aguante, Reputación, VBC) + atajos "Hacer turno" / "Trabajar" / "Reclutar".
- **AuthScreen / FlowRouter**: post-login navigation. Phase 3 mete TutorialScreen entre PibeCreator y HomeScreen para nuevos jugadores (flag `players.profile.tutorial_done`).
- **Phase 2 `match_windows` storage**: Turno submit RPC lee `match_windows/{fixture_id}` para validar ventana abierta. Tight integration con scheduler.
- **Phase 2 `season_state`**: Líder election RPC engancha en transition `active → ended` del season cron.
- **Phase 2 `fcm_tokens`**: ya almacenados, no usados en push personal todavía. Phase 3 puede activar "ascendiste" push si decisión es ir gradual. Phase 4-5 hard-uses para ataques personales.
- **Phase 1 onboarding flow**: PibeCreator + ClubPicker existing. ONB-05 tutorial scripted hook en post-onboarding + flag `tutorial_done` en profile.

</code_context>

<specifics>
## Specific Ideas

- **Lunfardo en copy de turnos / profesiones**: trapito, chori/paty, patovica, remisero — los términos REQUIREMENTS.md son canon. UI copy debe usarlos directo. "Hablar cana" = registro lunfardo correcto.
- **Apodos pibes**: lista inicial sugerida `["El Tano", "El Negro", "El Pibe", "Cabezón", "Ruso", "Toto", "Mauri", "Lucho", "Pichón", "El Chino", "Lalo", "Wachín", "Cordobés", "El Tincho", "Coquito"]`. Claude amplía durante plan.
- **Trait pool inicial**: REQUIREMENTS PIB-03 menciona Cabezón, Pies de plomo, Camorrero, Buchón, Pichón, Cordobés, Porteño. Agregar: Aguantador, Pícaro, Bostero, Gallina (cuidado lore — solo aplica si el club es rival), Pendejo, Veterano. Claude refina en plan.
- **Profesiones del Líder**: "hablar cana" (VBC source) + "negociar dirigentes" + "conseguir entradas" (PIB-04). Phase 3 implementa "hablar cana" como única VBC source; las otras 2 son flavor (sin output mecánico en v1) o defer Phase 5 (afectan diplomacia inter-club).
- **Tono App Store-safe**: copy del turno NO usa palabras como "ataque", "raid", "pelea" en Phase 3 (eso es Phase 4). Phase 3 = "hacer turno", "estar en la cancha", "aguantar", "laburar". Cuida la presentación de la app cuando aún no hay combate.

</specifics>

<deferred>
## Deferred Ideas

### To Phase 4 (Combate Estratégico)
- PIB-08 permadeath de pibes (sin cana / abogado todavía).
- HEA-01..05 heat meter, cana, rescate vía abogado, decay.
- VBC consumption en combate (Phase 3 lo acumula, Phase 4 lo gasta).
- Multiplicadores de turno por loadout/formación (Phase 3 = output flat).
- AIB-01..05 IA barras combate behaviors (Phase 3 = IA solo puebla rankings de Mesa Chica + Líder).

### To Phase 5 (Mundo Social)
- JER-05..07 facciones con líderes, drama emergente, voto de censura, golpe de estado.
- Mesa Chica acciones reales (votar uso del pozo, targets, alianzas).
- Líder challenge directo mid-season (JER-04 mention).
- Push notification de rank transition (probable defer aquí si Phase 3 quiere mínimos).
- Cronista LLM narra ascensos / movimientos políticos.
- Recruit "shared pool con AI barras" (cuando capo AI muere → pibes liberados reclutables) — requires combate infra.
- Recruit "geographic" por barrios — requires mapa UI (Phase 5).
- Catch-up modifier para nuevos jugadores (revisitar con analytics post-launch).

### To Phase 6 (Monetización)
- Cosméticos shop wired al primer trapo + cántico desbloqueado por tutorial.
- Drops sincronizados con realidad (gol Selección → drop nacional).
- Battle Pass rewards entran al loop laboral existente.

### To v1.1 / Post-Launch
- JER-04 elección activa del Líder con voto + challenge. v1 = pure threshold.
- Tradeoff Plata ↔ VBC para no-Líderes (si analytics muestran que VBC es bottleneck).
- Daily cap on Reputación (si analytics muestran whale-stomps).
- Trait reveal "everything visible" vs "only role" — A/B test post-validación.
- Mecánica de "negociar dirigentes" + "conseguir entradas" del Líder con efectos mecánicos reales.

</deferred>

---

*Phase: 03-core-loop-laboral*
*Context gathered: 2026-05-18*
