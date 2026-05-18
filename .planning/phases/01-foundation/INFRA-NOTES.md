# Phase 1 — Infrastructure Notes

> Bitácora de URLs, credenciales (REFERENCED, no secretos en plano), y estado de trámites.
> **Importante:** varios items del scope original del Plan 01-01 fueron diferidos por decisión del usuario durante la ejecución (ver sección "Deferrals desde scope original" abajo).

## Railway

- **Proyecto:** `honest-heart` (auto-generado, **NO renombrado** a `barrabrava-nakama` todavía — TODO opcional)
- **Región:** US East _(Railway NO tiene São Paulo — ver D-15 revisado en `01-CONTEXT.md`)_
- **Postgres plugin:** ✓ online (instalado, `DATABASE_URL` disponible vía reference variable)
- **Nakama service:** creado, deploy configurado vía GitHub repo `lukasval/barrabrava` branch `main`, builder Dockerfile (`Dockerfile.nakama`)
- **URL pública Nakama:** `https://nakama-production-7ea8.up.railway.app` (puerto 7350, generado 2026-05-15)
- **Console URL:** **DEFERRED** — Railway UI no expone port 7351 sin custom domain o TCP proxy. Phase 1 no lo necesita (Godot conecta SDK al 7350). Cuando aparezca necesidad real de debug admin, opciones: (a) `+ TCP Proxy` en Railway Networking apuntando 7351, (b) tunel `railway run` CLI local, (c) correr Nakama local apuntando a misma Postgres Railway.
- **Pre-deploy:** `/bin/sh -ecx "/nakama/nakama migrate up --database.address $DATABASE_URL"`
- **Start command:** `/bin/sh -ecx "exec /nakama/nakama --database.address $DATABASE_URL --session.encryption_key ... --session.refresh_encryption_key ... --console.username ... --console.password ..."` (env vars referenciadas, no en plano)
- **Watch paths:** `Dockerfile.nakama,nakama/**`
- **Auto-deploy:** Railway reportó "Auto deploy unavailable" (GitHub webhook permission pendiente). Deploys manuales vía dashboard hasta resolver.
- **Primer deploy:** 2026-05-15 _(esperando confirmación healthcheck 200)_
- **Status:** Nakama vacío deployado, sin runtime custom (TypeScript modules vienen en Plan 03)
- **Server key:** stored en Railway Variables (`NAKAMA_SERVER_KEY`)
- **Env vars seteadas (6):**
  - `NAKAMA_SERVER_KEY`
  - `NAKAMA_CONSOLE_USERNAME`
  - `NAKAMA_CONSOLE_PASSWORD`
  - `NAKAMA_SESSION_ENCRYPTION_KEY`
  - `NAKAMA_SESSION_REFRESH_ENCRYPTION_KEY`
  - `DATABASE_URL` (reference a Postgres plugin)

## Dominio

- **Estado:** **DEFERRED to Phase 2+** — usuario decidió diferir Resend testing por ahora.
- **Implicancia:** password reset flow no se testea end-to-end en Phase 1; el código se escribe igual (Plan 03/04) pero queda sin verificación SMTP real hasta que el dominio + Resend estén operativos.

## Resend

- **Estado:** **DEFERRED — added in Phase 2**.
- **Cuenta:** no creada.
- **DNS records (DKIM/SPF):** no configurados.
- **API key:** `RESEND_API_KEY` **NO** seteada en Railway todavía.

## AAIP (Ley 25.326)

- **Estado:** **DEFERRED — a Phase 6 o Phase 7 según decisión del usuario.**
- **Razón:** trámite async (2-4 semanas). Debe iniciarse **≥1 mes antes del soft launch**. Iniciarlo en Phase 1 sería prematuro dado el cronograma del proyecto.
- **Número de trámite:** _pendiente_
- **Compliance gate:** sin AAIP registrado, el juego NO puede tener acceso público en producción. Phase 7 (Polish + Launch) tiene este item como bloqueante.

## GitHub

- **Repositorio:** https://github.com/lukasval/barrabrava (privado)
- **Branch strategy:**
  - `main` — producción (auto-deploy a Railway una vez configurado en Task 4)
  - `develop` — staging / integración (CI corre, no deploya)
- **Ambas branches existen** local y remoto. 5+ commits previos pushed (planning artifacts).

## Branch Strategy

- `main` — producción (auto-deploy a Railway)
- `develop` — staging / integración (auto-build CI sin deploy)

## TEC-08 scope (Phase 1 — revised 2026-05-15)

- **Android APK debug:** ⏳ DEFERRED. Workflow exists at `.github/workflows/build-android-debug.yml` but trigger reduced to `workflow_dispatch` only. Local build works. CI blocker: Godot 4.3 + barichello image emit empty `configuration errors:` list. Ver `DEFERRED-CI.md`.
- **iOS IPA:** MANUAL en Mac local del dev hasta Phase 7 (ver `DEFERRED-CI.md`)

## Deferrals desde scope original

| Item | Scope original Plan 01-01 | Estado real | Movido a |
|------|---------------------------|-------------|----------|
| Railway project rename (`barrabrava-nakama`) | renombrar al crear | Quedó `honest-heart` (auto-gen) | TODO opcional cosmético |
| Dominio (sugerencia `barrabrava.com.ar`) | registrar en Wave 0 | Diferido | Phase 2+ |
| Resend account + DKIM/SPF | configurar en Wave 0 | Diferido | Phase 2 |
| AAIP trámite | iniciar Phase 1 Día 1 | Diferido | Phase 6 o Phase 7 (≥1 mes pre-launch) |
| Password reset E2E test | tarea original Plan 03/04 | Código se escribe, NO se testea SMTP | Phase 2 (cuando Resend esté operativo) |
| Nakama Console (port 7351) acceso external | exponer puerto Wave 0 | Diferido — Railway UI sin generate-domain free; Phase 1 no requiere console | Resolver on-demand (TCP Proxy / tunnel CLI / local Nakama) |

## Próximos pasos

- **Task 4 verificación pendiente:** confirmar healthcheck `https://nakama-production-7ea8.up.railway.app/healthcheck` → 200 OK + body `{}` post-deploy.
- **Plan 02 (Wave 1):** Setup proyecto Godot 4.3 + estructura de directorios. Una vez creado `project.godot`, el workflow Android debe correr verde.
- **Plan 03 (Wave 2):** Build TypeScript runtime + redeploy Nakama con módulos. **Antes de Plan 03 con password reset:** decidir si setear Resend en Phase 2 (DEFERRED) o stubear el RPC.
- **Resolver:** "Auto deploy unavailable" en Railway → revisar GitHub App permissions (Railway integration) para habilitar webhook auto-deploy.

## Wave 2 — Runtime LIVE (Plan 01-03) — 2026-05-17

- **Status:** ✅ Nakama TS runtime deployed + smoke test passed (3/5 steps verified end-to-end; remaining 2 fail only due to smoke-test.sh parser bug, NOT runtime).
- **Build chain root cause + fix (3 iterations):**
  1. esbuild IIFE wrapped InitModule → not visible to Nakama V8 scanner (commits `84dd344`, `940fcf3`, `263b224`)
  2. Goja's `findInitModuleFn` AST walker only accepts `function InitModule(){}` or `var InitModule = function(){}` — arrow functions ignored (commit `719e883`)
  3. Post-build IIFE strip + `function` declarations everywhere → Goja resolves all 6 entry symbols (commit `e50c736`)
- **Verified working endpoints (smoke test with `NAKAMA_KEY=defaultkey`):**
  - `GET /healthcheck` → 200 `{}`
  - register email + create=true → session token 251 chars
  - `RPC get_clubs?division=Primera` → "Los Millos" (River parody) listed
  - `RPC get_clubs` (no filter) → 133 clubs total
  - `RPC create_pibe` → pibe persisted with stats 50/50/50/50
- **Pending:**
  - Railway start command needs `--socket.server_key $NAKAMA_SERVER_KEY` appended so the hardcoded client key in `NakamaService.gd` matches server. Currently server falls back to `"defaultkey"`. Manual edit + redeploy required.
  - `smoke-test.sh` step 5 parses `payload` field incorrectly (Nakama wraps RPC return in `{"payload":"<stringified-json>"}`). Cosmetic — runtime is healthy.

## Wave 2 — Build chronology (historical)

- **Fecha de wiring del runtime al Dockerfile:** 2026-05-16
- **Clubs seedeados (esperados al primer boot post-redeploy):** 133 (Primera 28, Nacional 38, B Metro 17, Federal A 30, C Metro 20)
- **Bundle compilado:** `nakama/build/index.js` ~50.8KB (esbuild IIFE con `__CLUBS_JSON__` inlined)
- **RPCs registrados:** `get_clubs`, `create_pibe`, `delete_account`, `request_password_reset` (Phase 1 STUB), `confirm_password_reset` (Phase 1 STUB)
- **Stubs intencionales (deferred a Phase 2):** `request_password_reset` retorna `{ok:true}` anti-enumeration sin llamar Resend; `confirm_password_reset` retorna `{ok:false, error:"feature_unavailable_phase_1"}`. Razón: Resend + dominio verificado siguen DEFERRED (ver tabla "Deferrals desde scope original" arriba). Cuando Phase 2 habilite Resend, reemplazar el cuerpo de los stubs (TODOs marcados in-code) y actualizar `nakama/src/util/email.ts`.
- **Smoke test:** `nakama/smoke-test.sh` creado en este plan. **NO corrido todavía** — requiere primero el redeploy Railway con el nuevo Dockerfile. Comando para ejecutar manualmente post-redeploy:
  ```
  NAKAMA_HOST=nakama-production-7ea8.up.railway.app \
  NAKAMA_KEY=<server key real de Railway env var> \
  bash nakama/smoke-test.sh
  ```
- **Rate limits activos (declarados en local.yml):** 10 registers/IP/min, 60 RPCs/user/min (TEC-10).
- **Server key sync (CHK-07) — RESOLVED:** ya estaba sincronizado desde Plan 01-02. `scripts/autoloads/NakamaService.gd` línea 17 contiene la constante `NAKAMA_SERVER_KEY_DEFAULT := "aee9c099d52a6c22f52fb8bc9f4b72d9"`, que matchea el valor de `NAKAMA_SERVER_KEY` en Railway env vars. Método: hardcoded (repo es privado — `https://github.com/lukasval/barrabrava.git`). Documentado como "public client identifier per Nakama auth model — será rotado pre-launch (Phase 7)" en el comentario del autoload. NO requirió cambios en este plan.
- **VALIDATION.md (CHK-03):** frontmatter ya marcado `nyquist_compliant: true` y `wave_0_complete: true` desde 2026-05-15. Aprobación firmada vía Plan 03 Task 3 (este plan). No requirió edición en este task.

### Manual Railway redeploy required

Railway auto-deploy sigue DESHABILITADO (GitHub App webhook permissions pendientes, ver fila correspondiente arriba). El push de Task 3 (Dockerfile.nakama multi-stage + nakama/ TS build) **NO disparará** un deploy automático. Pasos para el usuario / orchestrator:

1. Railway dashboard → service Nakama → Deployments → "Deploy latest commit" (o equivalente "Redeploy from source").
2. Esperar ~3-5 min (build node:20-alpine + esbuild + final image).
3. Verificar Logs:
   - `BarraBrava runtime starting...`
   - `Clubs seeded: 133 (version=v1)`
   - `BarraBrava runtime ready: 5 RPCs registered`
4. Si segundo boot, esperar log `Clubs already seeded (version=v1), skipping` — confirma idempotencia.
5. Smoke test (comando arriba) → esperar `ALL SMOKE TESTS PASSED`.
6. Si pasa: actualizar este file con timestamp + status.

## Follow-ups — diferidos a Phase 6/7 (review WR-02)

- **Device-auth público sin captcha:** Nakama acepta `/v2/account/authenticate/device?create=true` con rate-limit por IP (`registration_per_ip_per_min: 10`) como única defensa. Para soft-launch público (Phase 6/7), evaluar:
  - Registrar hook `before_authenticate_device` que requiera un captcha token (Cloudflare Turnstile free tier o hCaptcha).
  - O deshabilitar `create=true` en device-auth público y forzar onboarding por email gated por verificación (cuando Resend esté wired en Phase 2+).
  - Decisión por documentar en plan de Phase 6/7.
- **Cuentas helper de reset-password huérfanas:** post-WR-01 fix, cada token de reset crea UNA cuenta `device-id` con prefijo `"reset-helper-"`. En Phase 2 (cuando Resend habilite reset real), agregar job de housekeeping que purgue `device-id` con prefijo `reset-helper-` después de X días.

---

# Phase 2 — AFA Heartbeat Notes

## AFA Scheduler

- **Cadence:** 15 min when any fixture in `[now, now+24h]`; 6 h otherwise.
- **Mechanism:** `initializer.registerLeaderboardReset` on dummy leaderboards `bb_tick_15m` (cron `*/15 * * * *`) and `bb_tick_6h` (cron `0 */6 * * *`). Cron persisted in Postgres — survives container restarts.
- **Tick lock:** `meta:tick_lock` with 5-minute TTL prevents overlapping ticks (T-2-RACE-01). Second concurrent tick logs `previous tick still active; skipping` and returns clean.
- **League IDs:** auto-discovered on first tick via API-Football `/leagues?country=Argentina&current=true`, cached in `meta:api_football_league_ids`.
- **Club-Team Map:** built once per season via `/teams?league=...&season=...`. Fuzzy-matches API team names against Phase 1 club lunfardo_name + barrio_hq. Unmatched clubs land in `meta:unmatched_clubs` — use `admin_set_club_team_mapping` to fix manually.
- **Debug:** `admin_force_repoll` triggers an immediate tick. Watch Railway logs for `[scheduler]`, `[api_football]`, `[fcm]`, `[reset]` prefixes.
- **Goja AST gotchas:** `registerLeaderboardReset` and all `registerRpc` calls MUST be direct ExpressionStatements inside `InitModule` body. Wrapping them in helper functions (e.g. `registerSchedulerHooks(initializer)`) breaks Nakama's AST extractor and the server fails to boot with `function key could not be extracted: not found`. See `scheduler/leaderboard_cron.ts` comment for the canonical pattern.

## FCM Setup

- **GCP project:** create at https://console.firebase.google.com (any name; we use `barrasbravas-XXXXX`).
- **Service account:** Project Settings → Service Accounts → "Generate new private key" → download JSON.
- **Base64 encode:**
  - macOS/Linux: `base64 -i key.json | tr -d '\n'`
  - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`
- **Railway vars to set:**
  - `FCM_SERVICE_ACCOUNT_B64` = the base64 string from above
  - `FCM_PROJECT_ID` = `project_id` value from inside the JSON (e.g. `barrasbravas-a5d0a`)
- **Verify:** after Railway redeploy, first match-window transition logs `[fcm] sent to topic=club_<slug>`. The OAuth2 access token is cached in `meta:fcm_oauth_token` with 60s safety margin.
- **iOS:** DEFERRED to Phase 7. Only Android FCM plugin shipped in Phase 2 (plan 02-07).
- **Security:** the service-account JSON contains a private RSA key. NEVER commit it. `.gitignore` blocks `*-firebase-adminsdk-*.json` and `firebase-adminsdk-*.json` patterns. If accidentally committed, rotate the key in Firebase Console immediately.

## Admin RPCs

- **Bearer token:** UUID v4 stored in Railway env `ADMIN_BEARER` (`requireAdmin` enforces ≥16 chars + constant-time compare).
  - Generate: `python3 -c "import uuid; print(uuid.uuid4())"` or PowerShell `[guid]::NewGuid().ToString()`.
- **Test-only mode:** `ADMIN_TEST_MODE=true` in dev unlocks `admin_inject_test_fixture` + `admin_test_validate_topic`. Set to `false` in production.
- **Usage:** see `nakama/test/admin-curl-examples.md` for copy-pasteable curl commands.
- **Audit log:** every admin mutation writes a row to `admin_actions` collection (`permissionRead:0`, `permissionWrite:0` — server-only, UUID key per mutation prevents overwrite).
- **Club mapping reconciliation:** `admin_set_club_team_mapping` merges into `meta:club_team_map` and prunes the matching entry from `meta:unmatched_clubs`.

## Resend (Pending — Phase 6/7)

**Current state (Phase 2):** `RESEND_ENABLED=false`. The reset flow is fully functional internally — token gen via `nk.uuidv4()`, persist with 1h TTL, single-use consume via `consumed_at` marker — but the HTTP call to Resend is disabled. Dev can recover the link from Railway logs.

**IMPORTANT — empty-string vs unset:** Railway env vars consumed by the runtime should be set to at least an empty string. `RESEND_API_KEY=` (empty) is correct; leaving it completely unset would matter only for tooling that does shell expansion. Phase 2 injects all runtime env vars via `--runtime.env=KEY=VALUE` CLI flags in `docker/nakama-entrypoint.sh`, so unset vars simply become empty strings (Nakama's tolerant behavior).

**Railway log grep to recover dev reset link:**
```
Railway → Logs → filter: [reset][dev] FULL link
```

**Do NOT flip `RESEND_ENABLED=true` until ALL of these are done:**
1. Domain purchased (e.g. `barrabrava.com.ar`).
2. DNS records added in Resend dashboard (SPF, DKIM, DMARC).
3. Resend dashboard shows "Domain Verified" (green).
4. `RESEND_FROM` set to `BarraBrava <noreply@<verified-domain>>`.
5. `RESEND_API_KEY` set (Resend dashboard → API Keys).

**One-line flip recipe (Phase 6/7):**
```
Railway → Variables → RESEND_ENABLED → change "false" to "true" → Redeploy
```

## Env Var Inventory

| Var | Phase | Sample / shape | Notes |
|-----|-------|----------------|-------|
| `NAKAMA_SERVER_KEY` | 1 | `aee9c099...` | Public client identifier; rotate pre-launch (Phase 7). |
| `NAKAMA_SESSION_ENCRYPTION_KEY` | 1 | base64 32 bytes | Set by Railway; rotate pre-launch. |
| `NAKAMA_SESSION_REFRESH_ENCRYPTION_KEY` | 1 | base64 32 bytes | Set by Railway; rotate pre-launch. |
| `NAKAMA_CONSOLE_USERNAME` | 1 | `admin` | Default; change before public launch. |
| `NAKAMA_CONSOLE_PASSWORD` | 1 | random | Set by Railway; rotate pre-launch. |
| `DATABASE_URL` | 1 | Railway reference | Auto-set by Postgres plugin. |
| `RESEND_API_KEY` | 1/6 | `re_...` | Set to empty string until Phase 6/7 domain verified. |
| `RESEND_FROM_EMAIL` | 1 | placeholder | Phase 1 compat; use `RESEND_FROM` in Phase 2+. |
| `PASSWORD_RESET_BASE_URL` | 1 | `https://lukasval.github.io/barrabrava/reset-password/` | Update when custom domain live. |
| `API_FOOTBALL_KEY` | 2 | `xxx` (api-sports.io) | Free tier 100 req/day in dev; paid tier in Phase 6/7. |
| `FCM_SERVICE_ACCOUNT_B64` | 2 | base64(key.json) | GCP service-account JSON, base64 encoded. NEVER commit raw JSON. |
| `FCM_PROJECT_ID` | 2 | `barrasbravas-a5d0a` | `project_id` field from the service-account JSON. |
| `RESEND_ENABLED` | 2 | `false` | Set to `true` ONLY after domain verified (Phase 6/7). |
| `RESEND_FROM` | 2 | `BarraBrava <onboarding@resend.dev>` | Replace with real domain when live; empty string OK if Resend skipped. |
| `ADMIN_BEARER` | 2 | UUID v4 | Keep secret; rotate if leaked. |
| `ADMIN_TEST_MODE` | 2 | `true` (dev) / `false` (prod) | Enables `admin_inject_test_fixture` + `admin_test_validate_topic`. |
