# Phase 1 — Infrastructure Notes

> Bitácora de URLs, credenciales (REFERENCED, no secretos en plano), y estado de trámites.
> **Importante:** varios items del scope original del Plan 01-01 fueron diferidos por decisión del usuario durante la ejecución (ver sección "Deferrals desde scope original" abajo).

## Railway

- **Proyecto:** `honest-heart` (auto-generado, **NO renombrado** a `barrabrava-nakama` todavía — TODO opcional)
- **Región:** US East _(Railway NO tiene São Paulo — ver D-15 revisado en `01-CONTEXT.md`)_
- **Postgres plugin:** ✓ online (instalado, `DATABASE_URL` disponible vía reference variable)
- **Nakama service:** creado, **OFFLINE** (no hay deploy todavía — Task 4 del plan configura el deploy)
- **URL pública Nakama:** _pending Task 4 — Railway aún no generó dominio público_
- **Console URL:** _pending — será `{RAILWAY_URL}:7351` post-deploy_
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

## TEC-08 scope (Phase 1)

- **Android APK debug:** GitHub Actions automated vía `.github/workflows/build-android-debug.yml`
- **iOS IPA:** MANUAL en Mac local del dev hasta Phase 7 (ver `DEFERRED-IOS-CI.md`)

## Deferrals desde scope original

| Item | Scope original Plan 01-01 | Estado real | Movido a |
|------|---------------------------|-------------|----------|
| Railway project rename (`barrabrava-nakama`) | renombrar al crear | Quedó `honest-heart` (auto-gen) | TODO opcional cosmético |
| Dominio (sugerencia `barrabrava.com.ar`) | registrar en Wave 0 | Diferido | Phase 2+ |
| Resend account + DKIM/SPF | configurar en Wave 0 | Diferido | Phase 2 |
| AAIP trámite | iniciar Phase 1 Día 1 | Diferido | Phase 6 o Phase 7 (≥1 mes pre-launch) |
| Password reset E2E test | tarea original Plan 03/04 | Código se escribe, NO se testea SMTP | Phase 2 (cuando Resend esté operativo) |

## Próximos pasos

- **Task 4 (orchestrator):** configurar Railway service settings (builder Dockerfile, pre-deploy `migrate up`, start command Nakama, port 7350 público), generar URL pública, validar healthcheck `/healthcheck` → 200 OK.
- **Plan 02 (Wave 1):** Setup proyecto Godot 4.3 + estructura de directorios. Una vez creado `project.godot`, el workflow Android debe correr verde.
- **Plan 03 (Wave 2):** Build TypeScript runtime + redeploy Nakama con módulos. **Antes de Plan 03 con password reset:** decidir si setear Resend en Phase 2 (DEFERRED) o stubear el RPC.
