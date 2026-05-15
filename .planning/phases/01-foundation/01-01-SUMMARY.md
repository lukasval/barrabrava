---
phase: 01-foundation
plan: 01
subsystem: infrastructure
tags:
  - infrastructure
  - cicd
  - railway
  - nakama
  - godot
  - aaip
requires: []
provides:
  - infra-scaffold
  - android-debug-ci
  - railway-skeleton
  - fly-toml-migration-stub
affects:
  - .github/workflows/build-android-debug.yml
  - Dockerfile.nakama
  - fly.toml
  - export_presets.cfg
  - .planning/phases/01-foundation/INFRA-NOTES.md
tech-stack:
  added:
    - Railway (region US East, placeholder — São Paulo no existe)
    - heroiclabs/nakama:3.21.0 (pinned)
    - barichello/godot-ci:4.3 (pinned)
  patterns:
    - Server-authoritative Nakama deployment
    - GitHub Actions Linux runner for Android CI (free tier)
    - fly.toml stub for future migration to Fly.io gru (São Paulo)
key-files:
  created:
    - .gitignore
    - README.md
    - Dockerfile.nakama
    - fly.toml
    - export_presets.cfg
    - .planning/phases/01-foundation/INFRA-NOTES.md
    - .github/workflows/build-android-debug.yml
  modified: []
decisions:
  - "D-15 revisado en 01-CONTEXT.md: Railway región disponible (no São Paulo); fly.toml prepara migración a Fly.io gru"
  - "TEC-08 Phase 1 scope reducido a Android-only; iOS CI difiere a Phase 7 (DEFERRED-IOS-CI.md)"
  - "Dominio + Resend DEFERRED a Phase 2+ por decisión del usuario"
  - "AAIP trámite DEFERRED a Phase 6 o Phase 7 (≥1 mes pre-launch, Ley 25.326)"
metrics:
  duration: "~12 min executor + ~30 min orchestrator inline (Tasks 1+4)"
  completed: 2026-05-15
  tasks_executed: 4
  tasks_total_in_plan: 5
  tasks_pending: ["Task 5 (human-verify checkpoint)"]
  files_created: 7
  files_modified: 1
  nakama_url: "https://nakama-production-7ea8.up.railway.app"
  healthcheck_status: "200 OK body {}"
---

# Phase 1 Plan 01: Repository + CI + Infra Scaffold Summary

Scaffold de infraestructura: repo Git con branches main/develop, archivos de configuración Docker/Fly/Godot/CI, bitácora INFRA-NOTES.md con deferrals, y workflow GitHub Actions Android debug APK.

## Scope ejecutado vs scope total del Plan 01-01

Este SUMMARY documenta **solo Tasks 2 y 3** del Plan 01-01. El plan completo tiene 5 tasks. El reparto de ejecución fue:

| Task | Owner | Estado |
|------|-------|--------|
| Task 1 (checkpoint:human-action — setup Railway/Resend/Dominio/AAIP) | Orchestrator + Usuario (inline) | **Parcialmente completado** — Railway sí, Resend/Dominio/AAIP **DEFERRED** |
| Task 2 (.gitignore + README + Dockerfile + fly.toml + export_presets + INFRA-NOTES + CONTEXT D-15) | **Este executor agent** | ✓ Completado |
| Task 3 (.github/workflows/build-android-debug.yml) | **Este executor agent** | ✓ Completado |
| Task 4 (configurar Railway service + deploy Nakama + healthcheck) | Orchestrator + Usuario (inline) | ✓ Completado — Nakama live, healthcheck 200 OK |
| Task 5 (checkpoint:human-verify — Wave 0 lista) | Orchestrator + Usuario (inline) | **Pendiente** |

## Commits creados por este executor

- `2513649` — `chore(01): scaffold infra config + .gitignore + Docker + fly.toml + export_presets + defer iOS CI (D-15 revised)`
  - Files: `.gitignore`, `README.md`, `Dockerfile.nakama`, `fly.toml`, `export_presets.cfg`, `.planning/phases/01-foundation/INFRA-NOTES.md`
- `ebf1805` — `ci(01): add Android debug APK build workflow (TEC-08 Phase 1 scope)`
  - Files: `.github/workflows/build-android-debug.yml`

Ambos commits pushed a `origin/main`.

## Decisiones documentadas

### D-15 (revisado 2026-05-15)
Ya estaba revisado en `01-CONTEXT.md` (líneas 49-49 del archivo). El wording revisado dice:

> **D-15 (revisado 2026-05-15):** Nakama se despliega en **Railway desde Phase 1** (no Docker local). RESEARCH.md confirmó que Railway NO tiene región São Paulo — se usa la región disponible más cercana a Argentina como placeholder. `fly.toml` se prepara con `primary_region = "gru"` para migración futura a Fly.io (que sí tiene São Paulo). **Intent original preservado** (latencia baja LATAM + transferencia internacional declarable AAIP).

No requirió edición durante la ejecución de Task 2 — ya estaba aplicado en commit anterior.

### TEC-08 scope reducido (Android-only Phase 1)
Documentado en `.planning/phases/01-foundation/DEFERRED-IOS-CI.md` (verificado existente en disco, 56 líneas, contiene "Phase 7" + razones + plan de reversión).

### Decisiones del usuario para deferral
1. **Dominio + Resend** → diferido a Phase 2+. Password reset flow se codifica pero no se testea SMTP en Phase 1.
2. **AAIP trámite** → diferido a Phase 6 o Phase 7. Razón: trámite 2-4 semanas debe iniciar ≥1 mes antes de soft launch; iniciarlo ahora es prematuro.
3. **Railway project name** → quedó `honest-heart` (auto-gen). TODO opcional cosmético, no bloquea nada.

## Realidad de la infra al cierre de Tasks 2+3

(Pre-Task 4 — el deploy todavía no corrió. Datos copiados a `INFRA-NOTES.md`.)

| Componente | Estado |
|------------|--------|
| GitHub repo `lukasval/barrabrava` (privado) | ✓ Online, branches `main` + `develop` |
| Railway project `honest-heart` | ✓ Creado, región US East |
| Railway Postgres plugin | ✓ Online, `DATABASE_URL` disponible |
| Railway Nakama service | ✓ Creado, 6 env vars seteadas, **ACTIVE** (deploy exitoso 2026-05-15) |
| Nakama URL pública | ✓ `https://nakama-production-7ea8.up.railway.app` (healthcheck 200 OK) |
| `.github/workflows/build-android-debug.yml` | ✓ Pushed, registrado en GitHub Actions |
| `Dockerfile.nakama` (Nakama 3.21.0 pinned) | ✓ En repo |
| `fly.toml` (gru region stub) | ✓ En repo |
| `export_presets.cfg` (Android Debug only, arm64-v8a) | ✓ En repo |
| Dominio | ✗ DEFERRED Phase 2+ |
| Resend account + DNS | ✗ DEFERRED Phase 2 |
| AAIP trámite | ✗ DEFERRED Phase 6 o 7 |

## Deviations from Plan

### Auto-fixed / scope-adjusted issues

**1. [Rule 2 - Critical] INFRA-NOTES.md reflejó realidad de deferrals en vez de placeholder template**

- **Found during:** Task 2 setup
- **Issue:** El plan literal asume Resend/Dominio/AAIP están provisionados (placeholders `{DOMAIN}`, `{AAIP_NUM}`, etc.). La realidad post-Task 1 es que usuario diferió esos items. Documentar el plan literal habría creado un registro falso.
- **Fix:** INFRA-NOTES.md escrito con secciones explícitas "DEFERRED — Phase 2+" / "DEFERRED — Phase 6 o 7" + tabla "Deferrals desde scope original" + columna estado de cada item.
- **Files modified:** `.planning/phases/01-foundation/INFRA-NOTES.md`
- **Commit:** `2513649`

**2. [Rule 3 - Blocking] Skip git branch creation step en Task 2**

- **Found during:** Task 2 acceptance criteria check
- **Issue:** Plan dice `git branch develop && git push -u origin main develop`. Branches ya existen local y remoto desde commits previos del orchestrator.
- **Fix:** Skipped — `git branch -a` confirmó ambas existen pre-Task 2. No re-ejecutado.
- **Files modified:** ninguno
- **Commit:** N/A

**3. [Out of scope tracking] Archivos pre-existentes NO stagheados**

- **Found during:** `git status --short` en Task 2
- **Issue:** `.agents/`, `.claude/`, `skills-lock.json` aparecen como untracked. No fueron creados por este plan.
- **Decision:** No stageados — pertenecen a tooling general del repo, fuera del scope Plan 01-01. Quedan como untracked. Si el orchestrator quiere commitearlos por separado, los tiene visibles.
- **Files modified:** ninguno

### Genuine scope adjustments

- **Task 1 partial completion:** orchestrator + usuario completaron solo la parte Railway/GitHub del plan, difiriendo Resend/Dominio/AAIP. INFRA-NOTES.md refleja eso.
- **CONTEXT.md D-15 NO requirió edición:** ya estaba con wording "(revisado 2026-05-15)" en commit anterior. Acceptance criteria del plan se satisface por estado existente.

## Authentication gates

Ninguno encontrado durante Tasks 2+3. (Task 1 sí implicó auth gates para Railway/GitHub login del usuario, pero ese task fue manejado por el orchestrator inline antes de spawn de este agent.)

## Known Stubs

- `Dockerfile.nakama` línea 4-5 comenta el `COPY nakama/build/ /nakama/data/modules/`. **Stub intencional documentado:** se descomenta en Plan 03 cuando exista el directorio `nakama/build/` (TypeScript runtime build output). Wave 0 deploya Nakama base sin runtime custom — comportamiento esperado y documentado en el plan + en el propio Dockerfile.
- `README.md` secciones "Setup local" y "Deploy" marcadas como `_Pendiente_` — bootstrap real lo hace Plan 02 + Task 4 respectivamente. Aceptado.

## Verification (lo que el executor verificó)

- ✓ `.gitignore` contiene `.godot/`, `*.apk`, `nakama/node_modules/`
- ✓ `Dockerfile.nakama` tiene `FROM heroiclabs/nakama:3.21.0` (pinned, no `:latest`)
- ✓ `fly.toml` tiene `primary_region = "gru"` exacto
- ✓ `export_presets.cfg` tiene preset `name="Android Debug"` con `architectures/arm64-v8a=true`
- ✓ `export_presets.cfg` NO contiene `platform="iOS"`
- ✓ `INFRA-NOTES.md` existe con realidad post-Task 1 (sin placeholders `{...}` sin resolver — los items deferred están marcados como tales)
- ✓ `DEFERRED-IOS-CI.md` existe (56 líneas, contiene "Phase 7")
- ✓ `01-CONTEXT.md` D-15 contiene `"(revisado 2026-05-15)"`
- ✓ `.github/workflows/build-android-debug.yml` parsea como YAML válido (verificado con `npx js-yaml`)
- ✓ Workflow contiene `barichello/godot-ci:4.3`, `Android Debug`, `actions/checkout@v4`, `actions/upload-artifact@v4`, `godot --headless --editor --quit`
- ✓ NO existe `build-ios-debug.yml` ni `build-ios-release.yml`
- ✓ Ambos commits pushed a `origin/main` sin deleciones accidentales (verificado vía `git diff --diff-filter=D`)

## Task 4 — Railway deploy (orchestrator inline, 2026-05-15)

Configuración aplicada vía Railway dashboard:
- Source: GitHub `lukasval/barrabrava` branch `main`
- Builder: Dockerfile, path `/Dockerfile.nakama`, watch paths `Dockerfile.nakama,nakama/**`
- Pre-deploy Command: `/bin/sh -ecx "/nakama/nakama migrate up --database.address $DATABASE_URL"`
- Custom Start Command: `/bin/sh -ecx "exec /nakama/nakama --database.address $DATABASE_URL --session.encryption_key $NAKAMA_SESSION_ENCRYPTION_KEY --session.refresh_encryption_key $NAKAMA_SESSION_REFRESH_ENCRYPTION_KEY --console.username $NAKAMA_CONSOLE_USERNAME --console.password $NAKAMA_CONSOLE_PASSWORD"`
- Networking: dominio público generado puerto 7350 → `nakama-production-7ea8.up.railway.app`

Deploy result: ACTIVE en ~46s (Init 15s + Build 15s + Deploy 16s).

Healthcheck verificado por orchestrator:
```
$ curl -fsS https://nakama-production-7ea8.up.railway.app/healthcheck
{} (HTTP 200)
```

Caveats anotados en INFRA-NOTES.md:
- Railway reportó "Auto deploy unavailable" — GitHub App permissions pendientes. Deploys manuales por ahora.
- Railway project name quedó como `honest-heart` (autogenerado), TODO cosmético.

## Próximos pasos

1. **Orchestrator Task 5:** checkpoint human-verify con usuario para confirmar Wave 0 ok.
2. **Plan 02 (Wave 1):** Setup proyecto Godot 4.3. El workflow CI Android quedará verde por primera vez cuando `project.godot` exista.
3. **Phase 2:** considerar setup Resend + dominio si password reset entra al scope, o stubear el RPC.
4. **Phase 6 o 7:** iniciar trámite AAIP ≥1 mes antes del soft launch.

## Self-Check: PASSED

- ✓ `.gitignore` existe
- ✓ `README.md` existe
- ✓ `Dockerfile.nakama` existe
- ✓ `fly.toml` existe
- ✓ `export_presets.cfg` existe
- ✓ `.planning/phases/01-foundation/INFRA-NOTES.md` existe
- ✓ `.github/workflows/build-android-debug.yml` existe
- ✓ `.planning/phases/01-foundation/DEFERRED-IOS-CI.md` existe (pre-existente, verificado)
- ✓ Commit `2513649` existe en `git log`
- ✓ Commit `ebf1805` existe en `git log`
- ✓ Ambos commits pushed a `origin/main`
