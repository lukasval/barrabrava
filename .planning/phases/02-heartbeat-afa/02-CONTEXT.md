# Phase 2: Heartbeat AFA - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

El backend escucha al fútbol real. Al final de esta fase:

1. Un **scheduler in-process Nakama** ingesta fixtures de Primera + Nacional vía API-Football, materializa ventanas de partido (`scheduled → open → live → closed`) en Storage, y mantiene cache con TTL 30 min + fallback al último cache válido si el feed cae.
2. Las **ventanas se abren/cierran automáticamente** sincronizadas con kickoff real (2h pre, 2h post, ±10s precision aceptable).
3. **Push notifications FCM v1** se disparan cuando ventana abre — vía topic `club_{club_id}` (broadcast eficiente, sin token mgmt en Phase 2). Token-per-user storage queda preparado para Phase 4+ events personales pero no se dispara nada personal todavía.
4. **Season detection híbrida** detecta start/end de torneo AFA real (Apertura/Clausura) leyendo el campo `season` + cluster de fixtures de API-Football, con override admin para edge cases.
5. **Admin override** existe como RPCs `admin_*` callables vía curl/Postman con bearer token env-var (no UI dedicada — solo dev, minimum viable). RPCs: `admin_postpone_fixture`, `admin_close_window`, `admin_set_season_window`.
6. **Carryover Phase 1 cerrado parcial:** se construye la infraestructura interna para Resend (token storage `reset_tokens` con `expires_at`, generación, validación al confirm) pero la integración HTTP real con Resend queda apagada por feature flag hasta que se compre dominio + se verifique en Resend. El RPC público mantiene la respuesta uniforme anti-enumeration. Se documenta el switch en INFRA-NOTES.md como "one-line flip" cuando dominio compre.

**Scope exacto Phase 2:**
- API-Football integration (paid tier roadmapped Phase 6 prelaunch; **Phase 2 desarrolla contra free tier** — 100 req/día, suficiente para dev/testing).
- Nakama `RegisterTimer` registrado en `InitModule` con dos cadencias: 15 min cuando hay fixture en `<24h`, 6 h otherwise.
- Storage collections nuevas: `fixtures`, `match_windows`, `reset_tokens`, `fcm_tokens` (preparada, no usada en P2), `meta` reused para `season_state`.
- FCM v1 API setup: GCP project + service account JSON loaded via Nakama runtime env var. Topic registration via Nakama Notifications API o llamada directa FCM REST con OAuth2 service-account flow.
- AppConfig autoload: `PUSH_NOTIFICATIONS_ENABLED = true` (flip desde Phase 1 asserts). Godot client: registra device token al login, subscribe a topic `club_{id}` post-club-pick.
- Idempotencia ventana: re-poll del mismo fixture nunca duplica ventana (key = `fixture_id`); kickoff time change → window shift, no duplicate.
- Anti-spam push: un solo push por ventana-open (marker en window record `notified_open_at`).
- Admin RPC suite + INFRA-NOTES.md updated con curl examples.
- Resend token machinery wired internamente (token gen, persist, expire, confirm) pero `RESEND_ENABLED = false` flag mantiene comportamiento stub externo.
- Custom domain + Resend live wiring → **defer Phase 6/7 prelaunch** (no dominio comprado aún, no se puede verificar Resend).

**No incluye Phase 2:**
- Scraping AFA / fixtures de B Metro, Federal A, C Metro (clubes seleccionables siguen disponibles pero marcados "Coming soon — sin partidos vivos esta season" en UI). Defer a v1.1.
- Notificaciones personales tipo "te atacaron" (Phase 4+).
- Daily reset push notification (DAY-03 abarca múltiples; en Phase 2 solo cubrimos "ventana abre" — daily reset llega con Phase 3 al haber daily loop).
- Quiet hours / per-user push opt-out (v1.1).
- Web admin UI dedicada (solo RPCs por curl en Phase 2).
- Compra de dominio + activación real Resend (Phase 6/7 prelaunch).
- Compra paid tier API-Football (Phase 6 prelaunch).

</domain>

<decisions>
## Implementation Decisions

### Scheduler & Cron Architecture
- **D-01:** El scheduler corre **in-process dentro de Nakama TS runtime** usando `nk.timerCreate` (o equivalente Nakama 3.21 API) registrado en `InitModule`. Cero servicios externos. Razón: solo dev + mantener costo ~$20/mo Railway (no segundo dyno, no GitHub Actions cron, no pg_cron extension). La elección preserva el patrón Phase 1 de "todo en un main.ts compilado a IIFE".
- **D-02:** **Dos cadencias de poll** controladas por una sola función de tick:
  - 15 min cuando algún fixture del catálogo Primera+Nacional está en ventana `[now, now+24h]`
  - 6 h otherwise
  La función de tick decide al inicio cuál cadencia aplicar y reschedula el próximo tick.
- **D-03:** Errores transitorios de API-Football (timeout, 5xx, 429): se loguean, no se reescalan al cliente, y el cache válido más reciente sirve hasta el próximo poll. Si el cache supera 6 h de antigüedad sin update exitoso, log WARNING + admin debería ver al revisar (no alerting externo en Phase 2).
- **D-04:** Cada poll trae solo los fixtures necesarios (`date>={now-1d}&date<={now+14d}` para mantener payload chico). Se persiste por fixture en col `fixtures`, value = JSON de la response normalizada.

### Match Window State Machine
- **D-05:** Estado de ventana lives en col `match_windows`, key = `{fixture_id}`, value JSON con shape:
  ```
  { fixture_id, club_home_id, club_away_id, kickoff_utc, state, opens_at, closes_at, notified_open_at?, source: "api-football"|"admin" }
  ```
  `state ∈ { "scheduled", "open", "live", "closed", "cancelled" }`.
- **D-06:** Transiciones se evalúan en cada tick:
  - `scheduled → open` cuando `now >= opens_at` (kickoff - 2h)
  - `open → live` cuando `now >= kickoff_utc`
  - `live → closed` cuando `now >= closes_at` (kickoff + 2h, ajustado si admin override)
  - `* → cancelled` si admin postpone con flag `cancel: true`
- **D-07:** Ventanas se **materializan** cuando un fixture aparece con kickoff dentro de `<48h` (no toda la temporada upfront). Repolling actualiza kickoff si AFA postpone; window record shift su `opens_at/closes_at` consistente. **Idempotencia clave:** una ventana nunca se duplica para el mismo fixture_id.
- **D-08:** Kickoff postpone detectado por API-Football → si window estado `scheduled`, simplemente shift de timestamps. Si window ya `open`/`live`, admin debe usar `admin_close_window` o `admin_postpone_fixture` para reconciliar (no se hace auto-rewind).

### Push Notifications (FCM v1)
- **D-09:** **FCM topics como mecanismo primario** para "ventana abre". Cada player se subscribe a `club_{club_id}` post-club-pick. Server, al transicionar `scheduled → open`, manda un único push al topic. Razón: zero state, broadcast O(1), perfecto para evento de barra.
- **D-10:** **Token-per-user infraestructura preparada pero no activada** en Phase 2. Col `fcm_tokens` definida (`userId → { token, platform, registered_at }`). Godot client llama RPC `register_fcm_token` al login. Phase 4+ usa estos tokens para events personales (`te atacaron`, `pibe preso`). En Phase 2 los tokens se almacenan pero no se envía nada per-user.
- **D-11:** Topic subscription: lo hace el server vía FCM REST API (Instance ID API o `/v1/projects/.../topics/`) usando el token del device. Re-subscribe al cambiar club (futuro) o al re-instalar app. Idempotente.
- **D-12:** Anti-spam: por ventana se manda UN solo push. Marker `notified_open_at` en window record evita doble-push si el tick re-evalúa la transición.
- **D-13:** Payload del push (i18n stays español argentino, lunfardo):
  - title: `¡Ventana abierta!`
  - body: `Tu club juega ahora. Mové el orto al aguantadero.`
  - data: `{ type: "window_open", fixture_id, club_id, kickoff_utc, closes_at }`
- **D-14:** Sin quiet hours en Phase 2. La ventana sigue el ritmo del fútbol real — partidos a las 22:00 AR son la mayoría, no hay UX para silenciar. Si surge en testing, v1.1.
- **D-15:** Argentina = único timezone en Phase 2 (`America/Argentina/Buenos_Aires`). UTC se guarda en DB; conversión al timezone AR solo para display + admin RPCs.

### Season Detection (SEA-01, SEA-02)
- **D-16:** **Híbrido auto + admin**. Source primario: campo `season` de API-Football. Server mantiene `season_state` en col `meta` key `current_season`, value JSON:
  ```
  { season_id, division: "primera"|"nacional", torneo_name, started_at, ends_at, status: "pre"|"active"|"ended" }
  ```
- **D-17:** Auto-trigger de season start: cuando el primer fixture del torneo nuevo entra ventana `<7d`, server marca `status = active`, `started_at = first_fixture.kickoff_utc`. Auto-trigger end: 7 días después del último fixture detectado del torneo → `status = ended`.
- **D-18:** Admin RPC `admin_set_season_window` permite forzar `started_at`/`ends_at`/`status` cuando AFA hace algo raro (suspensión, descenso atípico, fusión de torneos). Solo dev knows when to call it.
- **D-19:** Phase 2 mantiene UNA season activa global (la de Primera División). Nacional tendrá su season en paralelo desde Phase 2 también pero sin gameplay distinct yet — solo se loguea. Phase 6 introduce season modifiers que dependen de esto.

### Admin Override Plane (CLB-04)
- **D-20:** Admin se autentica vía **bearer token en env var Nakama** (`ADMIN_BEARER`). RPCs validan el header `Authorization: Bearer <token>` antes de proceder. Sin admin role en Nakama users (overkill solo dev). Documentado en INFRA-NOTES.md con ejemplos curl.
- **D-21:** RPCs admin de Phase 2:
  - `admin_postpone_fixture(fixture_id, new_kickoff_utc, cancel?: bool)` — shift o cancel.
  - `admin_close_window(fixture_id)` — fuerza `closed`.
  - `admin_set_season_window(division, season_id, started_at, ends_at, status)` — override season state.
  - `admin_force_repoll()` — dispara un poll manual (útil al testear).
  - `admin_list_windows(state?)` — debug listing.
- **D-22:** Toda mutación admin va al `notification_log` (col `admin_actions`) con timestamp + caller IP — audit trail mínimo. Solo dev hoy, equipo mañana.
- **D-23:** Sin web UI ni in-game admin screen en Phase 2. README documenta cómo correr los RPCs. Si se vuelve molesto en uso real, Phase 5+ puede agregar web tool en `/admin` del github-pages (zero servidor adicional).

### Resend Wiring (Phase 1 carryover)
- **D-24:** Phase 2 implementa **toda la lógica interna**: token gen (`nk.uuidv4()`), persist en col `reset_tokens` (`userId → { token, expires_at, consumed_at? }`, TTL 1h), validation al confirm (check `expires_at > now` + `consumed_at == null`), mark consumed atómico. El RPC `confirm_password_reset` deja de ser stub — valida token + cambia password vía `nk.accountUpdateId`.
- **D-25:** **Resend HTTP call queda detrás de feature flag** `RESEND_ENABLED` (env var). Cuando `false` (default Phase 2): el RPC sigue retornando `{ ok: true }` uniforme y loguea el reset link a logs server (dev puede copiarlo manualmente). Cuando `true` (Phase 6/7 una vez verificado dominio en Resend): el mismo código invoca `nk.httpRequest` a Resend API con template HTML.
- **D-26:** Template del email: HTML simple, español, header lunfardo `"Recuperá tu contraseña — Liga Aguante"`, link al `PASSWORD_RESET_BASE_URL + "?token=" + token`. Template inline en TS source (no asset externo en Phase 2, ya armaremos pretty cuando dominio exista).
- **D-27:** GC de tokens expirados: pasivo. Al confirm se descarta si expired; ningún job dedicado de cleanup en Phase 2 (overhead innecesario). Si Storage crece notablemente en testing, Phase 6+ agrega timer GC diario.

### Claude's Discretion
- Schema exacto del normalizado de fixture (qué fields persisten de la response API-Football vs cuáles se descartan).
- Estrategia de retry/backoff exacta para fallas API-Football (probable: 3 retries con backoff exponencial, luego fallback a cache).
- Logging strategy: stdout logging via `logger.info/warn/error` siguiendo patrón Phase 1. Métricas dedicadas (Prometheus, etc.) → Phase 7.
- Estructura interna de los timers Nakama (single timer self-rescheduling vs múltiples timers). Lo decide el planner según API real de Nakama 3.21 TS runtime.
- Formato exacto del bearer token admin (UUID v4 stored en Railway env var es default).
- FCM service-account JSON loading: probable env var con JSON inline base64 (`FCM_SERVICE_ACCOUNT_B64`).
- Manejo de race entre poll concurrentes: probable lock vía Storage `meta:poll_lock` con expiry, o simplemente skip si timer ya running flag.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `CLAUDE.md` — Guía proyecto: stack locked, constraints, tono, comandos.
- `.planning/PROJECT.md` — Visión, core value, constraints solo dev/budget.
- `.planning/REQUIREMENTS.md` §"Clubes & Datos AFA" — CLB-03, CLB-04, CLB-05.
- `.planning/REQUIREMENTS.md` §"Seasons" — SEA-01, SEA-02.
- `.planning/REQUIREMENTS.md` §"Combate Estratégico" — CMB-01 (ventana 2h/2h).
- `.planning/REQUIREMENTS.md` §"Daily Engagement" — DAY-03 (push scope; Phase 2 cubre solo ventana-abre).
- `.planning/REQUIREMENTS.md` §"Tech Foundation" — TEC-04 (FCM v1), TEC-09 (server-auth).

### Roadmap
- `.planning/ROADMAP.md` §"Phase 2: Heartbeat AFA" — goal, success criteria 1-6, outputs esperados.

### Phase 1 Outputs (consumidos como infraestructura base)
- `.planning/phases/01-foundation/01-CONTEXT.md` — decisiones D-01..D-16 base, especialmente patterns y storage keys.
- `.planning/phases/01-foundation/01-RESEARCH.md` — confirmar Nakama TS runtime APIs disponibles, fly.toml prep para futuro Fly migration.
- `nakama/src/main.ts` — entrypoint actual; Phase 2 extiende `InitModule` con timer + RPCs admin.
- `nakama/src/storage_keys.ts` — añadir constants `COL_FIXTURES`, `COL_MATCH_WINDOWS`, `COL_FCM_TOKENS`, `COL_ADMIN_ACTIONS`. Mirror obligatorio en `scripts/autoloads/StorageKeys.gd`.
- `nakama/src/rpc/request_password_reset.ts` + `confirm_password_reset.ts` — stubs Phase 1 que Phase 2 reemplaza con lógica real (Resend HTTP call queda detrás de feature flag).
- `scripts/autoloads/AppConfig.gd` — Phase 2 cambia `PUSH_NOTIFICATIONS_ENABLED := true` y elimina assert correspondiente; agrega FCM config constants.
- `web/reset-password/index.html` — flujo HTML stub Phase 1, Phase 2 lo hace funcional cuando token+confirm RPC válidos.

### Research (Phase 1 — releídos para Phase 2)
- `.planning/research/STACK.md` §"Backend Stack" — Nakama 3.x capabilities, TS runtime constraints (Goja, IIFE pattern documentado en phase 1 issue).
- `.planning/research/STACK.md` §"Push & Communications" — FCM v1, Resend.
- `.planning/research/ARCHITECTURE.md` — server-authoritative invariants.
- `.planning/research/PITFALLS.md` §"AFA Feed Instability" — paid tier mitigation roadmapped Phase 6 prelaunch; Phase 2 usa free tier dev.

### Documentación Phase 1 que Phase 2 debe respetar/extender
- `.planning/phases/01-foundation/INFRA-NOTES.md` — Phase 2 agrega secciones: AFA Scheduler config, FCM project setup, Admin RPC curl examples, Resend pending-purchase notes.
- `.planning/phases/01-foundation/DEFERRED-CI.md` — sigue diferido a Phase 7.
- `.planning/phases/01-foundation/LEGAL-NOTES.md` — no afecta Phase 2 directo pero Phase 2 graba `admin_actions` log que el LEGAL-NOTES menciona como audit base.

### Externos a fetchar durante research
- API-Football docs (api-sports.io / dashboard.api-football.com) — endpoints `/fixtures`, `/leagues`, `/timezone`. Liga AFA Primera = `league_id = 128`, Nacional = `league_id = 130` (confirmar en research).
- FCM v1 API docs (firebase.google.com/docs/cloud-messaging/server) — OAuth2 service-account flow, topic API, message format v1.
- Resend API docs (resend.com/docs) — solo lectura en Phase 2 para preparar el wiring; activación real en Phase 6/7.
- Nakama 3.21 TS runtime docs (heroiclabs.com/docs/nakama/server-framework/typescript-runtime) — `nk.timerCreate` / equivalente, `nk.httpRequest`, `nk.accountUpdateId`.

No hay specs/ADRs externos del proyecto — requirements y decisiones completos arriba.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nakama/src/main.ts` — entrypoint TS, patrón IIFE-build (function decls obligatorios por Goja AST). Phase 2 extiende `InitModule` con scheduler init + admin RPC registration.
- `nakama/src/util/email.ts`, `nakama/src/util/validation.ts` — utilidades Phase 1 reusables. `validation.ts:isValidEmailShape` ya validado en stub Reset.
- `nakama/src/storage_keys.ts` ↔ `scripts/autoloads/StorageKeys.gd` — pareja sincronizada cliente/servidor. Phase 2 añade nuevos COL_* y debe mantener mirror (CR-01 lesson learned).
- `scripts/autoloads/AppConfig.gd` — patrón de feature flags + asserts. Phase 2 flip `PUSH_NOTIFICATIONS_ENABLED` y elimina assert correspondiente.
- `scripts/autoloads/NakamaService.gd` — cliente Nakama setup; agregar method `register_fcm_token` y `subscribe_to_club_topic`.
- `scripts/autoloads/PlayerStore.gd` — singleton client state; agregar campo `subscribed_topics: Array[String]`.
- Patrón anti-enumeration RPCs (Phase 1 `request_password_reset`) — replicable en cualquier RPC público que toque email.
- Patrón idempotency-marker (Phase 1 `CLUBS_SEED_VERSION` + storage seed marker) — replicable para `season_state` init, FCM topic subscriptions confirmation, etc.

### Established Patterns
- **Storage como DB**: no raw SQL en TS runtime. Cada feature = una collection + JSON value. Decisión Phase 1 preservada.
- **IIFE bundle**: `build.mjs` esbuild + strip IIFE wrapper. Cualquier nueva import debe seguir el shape (function decls, no arrow at top level).
- **`SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'`** para data global (clubs, fixtures, match_windows, meta). User-owned data va bajo el userId real.
- **Server-authoritative everything** — el client nunca dispara estado de ventana; pregunta via RPC `get_current_window` y lee.
- **AFA español + lunfardo argentino** en todo string user-facing.

### Integration Points
- `NakamaService.gd:_ready` — conectar device token registration al flow Auth → register FCM.
- `FlowRouter.gd` — flow post-ClubPicker → trigger `subscribe_to_club_topic`.
- `HomeScreen.gd` — debe consultar `get_current_window` al onResume y mostrar countdown/status si ventana próxima.
- Nakama `before_authenticate*` hook (si necesario para reset tokens flow) — Phase 1 ya tiene pattern de RPC registration en `InitModule`.

</code_context>

<specifics>
## Specific Ideas

- El push notification copy debe ser **lunfardo argentino**, no español neutro. Ejemplo locked-in: title `"¡Ventana abierta!"`, body `"Tu club juega ahora. Mové el orto al aguantadero."`. Si el club rival tiene un nombre lunfardo (e.g., "Los Xeneizes"), futuro phase puede personalizar la copia por matchup — Phase 2 mantiene copy genérica.
- HomeScreen post-Phase-2 debería mostrar **estado de la próxima ventana del club del player**: countdown si `scheduled`, banner pulsante si `open`/`live`, "ya pasó / próximo partido en X días" si `closed`. Visualmente importante para que el player sienta el heartbeat real.
- API-Football: liga argentina Primera = `league_id = 128`, Primera Nacional = `league_id = 130` (researcher debe verificar contra dashboard antes de hardcodear).
- Anti-spam push: si una ventana flap-flopea por bug (`open → scheduled → open`), nunca debe re-mandar push. El marker `notified_open_at` solo se setea una vez.
- "AA decent game" target del user: traducido a Phase 2 = robustez sobre features. Logging informativo en cada poll, errores claros, idempotencia estricta, admin tooling minimal pero suficiente. Mejor menos features pulidos que más sin pulir.

</specifics>

<deferred>
## Deferred Ideas

- **Scraping AFA / fixtures B Metro + Federal A + C Metro** → v1.1 (no Phase 2). Clubes seleccionables siguen disponibles desde Phase 1 pero marcados "Coming soon — sin partidos vivos esta season" en UI cuando el player elija uno de esos.
- **Custom domain registration** (`barrabrava.com.ar` o similar) → Phase 6/7 prelaunch. Depende de decisión del user de comprar dominio.
- **Resend live wiring + dominio verified** → Phase 6/7 una vez dominio comprado. Phase 2 deja toda la lógica detrás de `RESEND_ENABLED=false` flag.
- **API-Football paid tier subscription** → Phase 6 prelaunch. Phase 2 desarrolla contra free tier (100 req/día, suficiente).
- **Quiet hours / per-user notification preferences** → v1.1.
- **Per-user push notifications** (te atacaron, pibe preso, raid finished) → Phase 4 (Combate). Infra Phase 2 (token storage) lo prepara pero no dispara.
- **Daily reset push** (DAY-03 subset) → Phase 3 (Core Loop Laboral), una vez exista daily loop.
- **Heat / cana event push** → Phase 4.
- **Web admin UI dedicada** en `/admin` de github-pages → Phase 5+ si los curl RPCs se vuelven molestos en uso real.
- **Token GC dedicado para `reset_tokens`** → Phase 6+ si Storage crece notablemente. Phase 2 usa GC pasivo (check expires_at al confirm).
- **Métricas Prometheus / observabilidad estructurada** → Phase 7. Phase 2 usa `logger.info/warn/error` stdout.
- **Season modifiers visibles al player** (Temporada del fuego, etc.) → Phase 6 (Monetización + Seasons). Phase 2 solo detecta season state, no aplica modifiers.
- **Multi-timezone / fans fuera de Argentina** → post-MVP. Phase 2 hardcode `America/Argentina/Buenos_Aires`.
- **Personalización de push copy por matchup** (e.g., copy distinta si tu club juega Superclásico) → v1.1.

</deferred>

---

*Phase: 02-heartbeat-afa*
*Context gathered: 2026-05-17 — discuss-phase default mode*
*User delegó decisiones técnicas a Claude ("hace lo que creas relevante para un juego decente AA") tras presentación de 4 áreas grises + recap de 6 defaults. Decisiones D-01..D-27 reflejan el target "AA" priorizando robustez (idempotencia, observabilidad, audit trail admin) sobre features ambiciosas en Phase 2.*
