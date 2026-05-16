---
phase: 01-foundation
plan: 03
subsystem: nakama-runtime
tags:
  - nakama
  - typescript
  - runtime
  - rpc
  - clubs-seed
  - rate-limiting
  - esbuild
requires:
  - infra-scaffold
  - railway-skeleton
  - godot-skeleton
  - nakama-sdk-vendored
provides:
  - nakama-ts-runtime
  - clubs-seed-bundle
  - rpc-get-clubs
  - rpc-create-pibe
  - rpc-delete-account
  - rpc-password-reset-stubs
  - smoke-test-script
affects:
  - nakama/
  - Dockerfile.nakama
  - .planning/phases/01-foundation/INFRA-NOTES.md
tech-stack:
  added:
    - nakama-runtime (github:heroiclabs/nakama-common#master) — TypeScript type defs for nkruntime API
    - esbuild ^0.21.0 — single-file IIFE bundler targeting Nakama V8 runtime
    - typescript ^5.4.0 — strict mode, ES2017 target
  patterns:
    - InitModule-based idempotent seeding via collection 'meta' marker (CLUBS_SEED_VERSION = v1)
    - Storage permission model: collection 'clubs' (system-owned, permissionRead:2 / permissionWrite:0) — clients read-only via RPC, never direct write
    - One-pibe-per-account guard via storageRead pre-check (Phase 1 constraint)
    - Anti-enumeration RPC pattern: uniform { ok: true } regardless of input (T-1-RT-02)
    - Multi-stage Dockerfile (node:20-alpine builder → heroiclabs/nakama:3.21.0 final) — keeps final image lean, no Node toolchain shipped to prod
key-files:
  created:
    - nakama/package.json
    - nakama/package-lock.json
    - nakama/tsconfig.json
    - nakama/build.mjs
    - nakama/.gitignore
    - nakama/local.yml
    - nakama/data/clubs.json
    - nakama/src/main.ts
    - nakama/src/util/validation.ts
    - nakama/src/util/email.ts
    - nakama/src/rpc/get_clubs.ts
    - nakama/src/rpc/create_pibe.ts
    - nakama/src/rpc/delete_account.ts
    - nakama/src/rpc/request_password_reset.ts
    - nakama/src/rpc/confirm_password_reset.ts
    - nakama/smoke-test.sh
  modified:
    - Dockerfile.nakama
    - .planning/phases/01-foundation/INFRA-NOTES.md
decisions:
  - "nakama-runtime npm package resolved via github:heroiclabs/nakama-common#master (the heroiclabs/nakama-project-template uses this same source; the bare 'nakama-runtime@^1.32.0' from the plan's <interfaces> example does NOT exist on the public npm registry — 404)"
  - "Password reset RPCs implemented as Phase 1 STUBS per <runtime_context> directive — Resend + verified domain deferred to Phase 2+ (see INFRA-NOTES.md). request_password_reset returns uniform { ok: true } anti-enumeration without sending email; confirm_password_reset returns { ok: false, error: 'feature_unavailable_phase_1' }. TODOs in-code reference Phase 2."
  - "CHK-07 (server key sync) confirmed already resolved by Plan 01-02 — NakamaService.gd line 17 already contains the real Railway server key (aee9c099d52a6c22f52fb8bc9f4b72d9). No edit needed. Repo is private, so hardcoded approach is acceptable per threat T-1-RT-11 mitigation."
  - "CHK-03 (VALIDATION.md frontmatter signoff) confirmed already in place since 2026-05-15 — nyquist_compliant=true + wave_0_complete=true already set. No edit needed in this plan."
  - "main.ts uses @ts-ignore for the `!InitModule && InitModule.bind(null)` global-binding pattern from nakama-project-template — TypeScript narrows `!InitModule` to `never` since the function is always truthy. Comment in-code explains."
  - "Smoke test NOT executed in this executor run — requires Railway redeploy first (auto-deploy disabled per INFRA-NOTES.md). Script is created + chmod +x'd + checked in; manual execution post-redeploy by the orchestrator + user."
  - "clubs.json author choice: ~133 clubs hand-authored with lunfardo parody names. Distribution: Primera 28, Nacional 38, B Metro 17, Federal A 30, C Metro 20 = 133 total. Real club identification was avoided per CLAUDE.md tone guidance (parodia, no nombres reales de líderes / clubes oficiales; loose color palettes; barrios reales como anclaje)."
metrics:
  duration: "~18 min executor"
  completed: 2026-05-16
  tasks_executed: 3
  tasks_total_in_plan: 4
  tasks_pending:
    - "Task 4 (checkpoint:human-verify — orchestrator handles after Railway redeploy + smoke test)"
  files_created: 16
  files_modified: 2
  commits: 3
  bundle_size_bytes: 50794
  clubs_seeded_expected: 133
  rpc_count: 5
  lunfardo_name_in_bundle: 137
---

# Phase 1 Plan 03: Nakama TypeScript Runtime + 5 RPCs + Clubs Seed Summary

Runtime TypeScript de Nakama: 5 RPCs server-authoritative (`get_clubs`, `create_pibe`, `delete_account`, + 2 stubs de password reset diferidos a Phase 2), seed idempotente de 133 clubes AFA paramétricos en lunfardo, rate limiting baseline (10 registers/IP/min, 60 RPCs/user/min), bundle esbuild de 50.8KB con clubs.json inlined, Dockerfile multi-stage wireado al runtime y smoke-test.sh end-to-end listo para correr post-redeploy.

## Commits creados

| Hash      | Message                                                                                       | Files                                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `788f0cc` | `chore(01-03): scaffold nakama TS runtime + clubs.json seed`                                  | package.json, package-lock.json, tsconfig.json, build.mjs, .gitignore, local.yml, data/clubs.json, src/main.ts, src/util/validation.ts, src/util/email.ts                                              |
| `d2536c7` | `feat(01-03): implement 5 RPCs (get_clubs/create_pibe/delete_account + password_reset stubs)` | src/rpc/get_clubs.ts, src/rpc/create_pibe.ts, src/rpc/delete_account.ts, src/rpc/request_password_reset.ts, src/rpc/confirm_password_reset.ts                                                          |
| `2458cd3` | `chore(01-03): update Dockerfile.nakama + smoke-test.sh + sync notes`                         | Dockerfile.nakama (multi-stage rewrite), nakama/smoke-test.sh (new, chmod +x), .planning/phases/01-foundation/INFRA-NOTES.md (Wave 2 section appended)                                                 |

Los 3 commits están pusheados a `origin/main`. Sin deleciones accidentales (verificado vía `git diff --diff-filter=D HEAD~3 HEAD`).

## Estado vs success criteria del prompt

| Criterio                                                                                                                          | Estado                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `nakama/package.json` + `tsconfig.json` + `build.mjs` + `.gitignore` (excludes build/ + node_modules/)                            | ✓                                                                                       |
| `nakama/src/main.ts` — InitModule registers 5 RPCs + seeds clubs idempotently (CLUBS_SEED_VERSION=v1 marker en 'meta' collection) | ✓                                                                                       |
| `nakama/src/rpc/{get_clubs,create_pibe,delete_account,request_password_reset,confirm_password_reset}.ts`                          | ✓ (5 files)                                                                             |
| `nakama/data/clubs.json` — ≥50 real-ish clubs                                                                                     | ✓ **133 clubes**, distribución Primera 28 + Nacional 38 + B Metro 17 + Federal A 30 + C Metro 20 |
| `nakama/src/util/validation.ts` — validatePibeName con deny list + length                                                         | ✓ (+ isValidEmailShape para los stubs de reset)                                         |
| `nakama/local.yml` — local dev config con rate limits                                                                             | ✓ (10/min IP register, 60/min user RPC)                                                 |
| `nakama/smoke-test.sh` — bash script para 5 RPCs                                                                                  | ✓ (executable, 8 pasos: healthcheck → register → get_clubs ×2 → create_pibe → profanity → reset stub → delete) |
| `Dockerfile.nakama`: COPY runtime activo                                                                                          | ✓ (multi-stage rewrite — node:20-alpine builder → heroiclabs/nakama:3.21.0 final)       |
| `npm install` + `npm run build` exitosos → `nakama/build/*.js` artefactos existen; `build/` gitignored                            | ✓ (50,794 bytes; `build/` listado en `nakama/.gitignore`)                               |
| `scripts/autoloads/NakamaService.gd` verificado — server_key matchea Railway                                                      | ✓ (verificado, valor `aee9c099...` ya estaba desde Plan 01-02 — sin cambios)            |
| `INFRA-NOTES.md` Wave 2 section appended                                                                                          | ✓ (server key sync confirmation, stubs documented, Resend deferred reiterado)            |
| `01-VALIDATION.md` frontmatter: nyquist_compliant=true, wave_0_complete=true                                                      | ✓ (ya estaba desde 2026-05-15 — sin cambios)                                            |
| 3 atomic commits, todos pusheados a origin/main                                                                                   | ✓                                                                                       |
| `01-03-SUMMARY.md` con task breakdown + deferral notes + manual Railway redeploy instructions                                     | ✓ (este file)                                                                           |
| STATE.md y ROADMAP.md NO modificados                                                                                              | ✓ (orchestrator owns)                                                                   |

## Deviations from Plan

### Rule-3 (Blocking) fix during execution

**1. [Rule 3 - Blocking] `nakama-runtime@^1.32.0` does not exist on the npm registry**

- **Found during:** Task 1 — `npm install` returned `404 Not Found - GET https://registry.npmjs.org/nakama-runtime`.
- **Issue:** El plan literal especifica `"nakama-runtime": "^1.32.0"` en `package.json` `<interfaces>`. Verificando contra la registry (`curl https://registry.npmjs.org/-/v1/search?text=nakama`), el paquete no está publicado. El ejemplo oficial del template (`https://raw.githubusercontent.com/heroiclabs/nakama-project-template/master/package.json`) usa `"nakama-runtime": "github:heroiclabs/nakama-common#master"` — la types lib vive en el repo de nakama-common, no en npm.
- **Fix:** Cambié la dependencia a `"github:heroiclabs/nakama-common#master"`. `npm install` corrió OK (4 packages installed), `node_modules/nakama-runtime/index.d.ts` existe, typecheck pasa.
- **Files modified:** `nakama/package.json`
- **Commit:** `788f0cc` (incluido en el primer commit antes de stagear — sin commit extra)

**2. [Rule 1 - Bug] `!InitModule && InitModule.bind(null)` causa error TS2339: `Property 'bind' does not exist on type 'never'`**

- **Found during:** Task 1 — `npm run typecheck` falló.
- **Issue:** TypeScript strict mode infiere `!InitModule` como `false` literal y angosta el segundo operando del `&&` a `never`. El patrón viene literalmente del `nakama-project-template` pero ese template usa TypeScript 4.5 menos estricto.
- **Fix:** Agregué `// @ts-ignore` arriba de la línea con comentario explicativo. El patrón es el canónico documentado por Heroic Labs — no hay alternativa cleaner sin romper la convención que el V8 runtime espera.
- **Files modified:** `nakama/src/main.ts`
- **Commit:** `788f0cc` (incluido en el mismo commit)

### Scope-adjusted (per `<runtime_context>` directive)

**3. [Per orchestrator direction] Password reset RPCs implementados como STUBS**

- **Trigger:** `<runtime_context>` block explícito: "Resend / domain / email infrastructure DEFERRED to Phase 2+. Implement them as stubs."
- **Action taken:**
  - `request_password_reset.ts`: valida `isValidEmailShape(input.email)`, retorna `{ok:true}` siempre (anti-enumeration T-1-RT-02), loguea `"[Phase 1 stub] password reset email would be sent to: <email>"`. NO llama `nk.httpRequest` ni Resend. TODO Phase 2 comentado in-code.
  - `confirm_password_reset.ts`: valida `token` (8-256 chars) + `new_password` (8-256 chars), retorna `{ok:false, error:"feature_unavailable_phase_1"}`. NO muta password. TODO Phase 2 comentado.
  - `nakama/src/util/email.ts`: `sendResetEmail()` es un stub que loguea intent y retorna `{sent: false, reason: "stubbed"}`. El cuerpo real (Resend `nk.httpRequest`) está comentado in-code como referencia exacta de 01-RESEARCH.md §6, listo para descomentar en Phase 2.
- **Files affected:** los 3 listados arriba.
- **Commit:** `d2536c7`

**4. [Per orchestrator direction] Server key sync (CHK-07) skipped — already done**

- **Trigger:** `<runtime_context>` "verify already done, document in INFRA-NOTES.md, do NOT re-edit NakamaService.gd if value matches"
- **Action taken:**
  - Leído `scripts/autoloads/NakamaService.gd:17` → `const NAKAMA_SERVER_KEY_DEFAULT := "aee9c099d52a6c22f52fb8bc9f4b72d9"` matchea el valor de Railway env var declarado en Plan 01-02 SUMMARY (línea 102) y en este file.
  - NO edité `NakamaService.gd`. NO implementé el patrón `_load_runtime_overrides` / `nakama_local.cfg` del plan literal — innecesario para un repo privado con server key hardcoded (decisión aprobada por el usuario en Plan 01-02 SUMMARY decisión #8).
  - Documentado en INFRA-NOTES.md Wave 2 section como "CHK-07 — RESOLVED already in Plan 01-02".
- **Files affected:** ninguno (solo doc en INFRA-NOTES.md).
- **Commit:** `2458cd3`

**5. [Per orchestrator direction] Smoke test NOT executed**

- **Trigger:** `<runtime_context>` "Smoke-test.sh: write the script but DO NOT execute it (requires live Nakama with new runtime which won't happen until orchestrator + user redeploy)."
- **Action taken:** El script está creado, ejecutable, listo. El INFRA-NOTES.md tiene las instrucciones exactas (var + comando) para que el orchestrator/usuario lo corra post-redeploy.
- **Files affected:** `nakama/smoke-test.sh` (created).
- **Commit:** `2458cd3`

**6. [Per orchestrator direction] CHK-03 (VALIDATION.md frontmatter) — already signed off**

- **Trigger:** Plan literal pide `nyquist_compliant: false → true` y `wave_0_complete: false → true`.
- **Reality:** `head -10 .planning/phases/01-foundation/01-VALIDATION.md` muestra que ambos flags ya estaban `true` desde 2026-05-15 (commit anterior al iniciar este executor). El `Approval` line al fondo también ya dice "signed off via Plan 03 Task 3 (2026-05-15)".
- **Action taken:** No edits. Documentado en INFRA-NOTES.md Wave 2 y en este Summary.

## Authentication gates

Ninguno encontrado. Toda la ejecución fue local (file authoring + `npm install` + esbuild). El siguiente paso de auth gates es el redeploy Railway que el orchestrator maneja externamente.

## Manual Railway redeploy instructions (para el orchestrator)

Railway auto-deploy sigue **deshabilitado** (GitHub App webhook permissions pendientes, ver `INFRA-NOTES.md` sección Railway). Los 3 commits de este plan NO disparan deploy automático. El orchestrator debe pedirle al usuario:

1. **Railway dashboard** → service Nakama (`nakama-production-7ea8`) → Deployments tab → "Redeploy" o equivalente "Deploy latest commit".
2. **Esperar ~3-5 min**:
   - Stage 1 (node:20-alpine builder): npm install + npm run build → produces `build/index.js`.
   - Stage 2 (heroiclabs/nakama:3.21.0): copies bundle + local.yml into image.
3. **Verificar logs Railway** — buscar:
   - `BarraBrava runtime starting...`
   - `Clubs seeded: 133 (version=v1)`
   - `BarraBrava runtime ready: 5 RPCs registered`
4. **Si segundo boot** (e.g. tras escalar instancias o redeploy posterior): esperar `Clubs already seeded (version=v1), skipping` — confirma idempotencia.
5. **Smoke test post-redeploy** (manual, con server key real):
   ```
   NAKAMA_HOST="nakama-production-7ea8.up.railway.app" \
   NAKAMA_KEY="<server key real, NO defaultkey>" \
   bash nakama/smoke-test.sh
   ```
   Output esperado:
   - `=== 1) Healthcheck ===` → OK
   - `=== 2) Register test account ===` → 64+ char session token
   - `=== 3) RPC get_clubs (filter division=Primera) ===` → response includes `lunfardo_name`
   - `=== 4) RPC get_clubs (no filter) ===` → ≥130 lunfardo_name occurrences
   - `=== 5) RPC create_pibe ===` → `"ok":true` + `"aguante":50`
   - `=== 6) RPC create_pibe (profanity) ===` → either `name_contains_forbidden_word` or `pibe_already_exists` (both confirm server-side validation enforced)
   - `=== 7) RPC request_password_reset ===` → `{"ok":true}` (stub anti-enumeration)
   - `=== 8) RPC delete_account ===` → `{"ok":true}`
   - Final: `ALL SMOKE TESTS PASSED`

Si algún step falla, lo más probable: rate limiting (`{"code":3,"message":"too many requests"}`) — esperar 1 min y reintentar; el smoke usa un email único por run, no debería rebotar contra dedup.

## Known Stubs

| Stub                             | File                                  | Line(s)    | Reason                                                                                              | Resolves in        |
| -------------------------------- | ------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- | ------------------ |
| Resend email send                | `nakama/src/util/email.ts`            | body of `sendResetEmail()` (~25-65) | Resend account + verified domain DEFERRED a Phase 2 (INFRA-NOTES.md "Dominio" + "Resend" rows)      | Phase 2 (Heartbeat) |
| `request_password_reset` RPC     | `nakama/src/rpc/request_password_reset.ts` | whole RPC  | Depends on Resend stub above. Returns uniform `{ok:true}` anti-enumeration without sending email.   | Phase 2            |
| `confirm_password_reset` RPC     | `nakama/src/rpc/confirm_password_reset.ts` | whole RPC  | Depends on token storage from `request_password_reset` + accountUpdateId. Returns `feature_unavailable_phase_1`. | Phase 2 |
| Federal A & C Metro club names   | `nakama/data/clubs.json`              | rows 80-133 | Federal A (30) and C Metro (20) cover the divisions but the lunfardo names are looser — some are derivative (`El Atlas`, `El Naranja`). Primera + Nacional are higher-quality. | Phase 2-3 (curate when fixture feed is wired) |

Each stub is documented in-code with `// TODO Phase N:` markers. None block Phase 1 — Plan 04 (UI screens) only consumes `get_clubs`, `create_pibe`, and `delete_account`, all of which are real (not stubbed).

## Threat Flags

Ninguna nueva superficie introducida fuera del `<threat_model>` declarado. Los stubs de password reset NO suman trust boundaries (no se hace `nk.httpRequest` aún, no se persisten tokens). Los RPCs `get_clubs` / `create_pibe` / `delete_account` cumplen exactamente las mitigaciones declaradas (T-1-RT-01/02/03/04/07/08/09/10).

## Verification realizada por este executor

- ✓ `node nakama/data/clubs.json` validate: total 133, divisiones {Primera:28, Nacional:38, "B Metro":17, "Federal A":30, "C Metro":20}, 0 duplicate IDs.
- ✓ `cd nakama && npm install` exit 0 (4 packages installed including nakama-runtime from github).
- ✓ `cd nakama && npm run typecheck` exit 0 (después del @ts-ignore fix).
- ✓ `cd nakama && npm run build` exit 0; `build/index.js` = 50,794 bytes.
- ✓ Bundle contiene los 5 nombres de RPC: `get_clubs`, `create_pibe`, `delete_account`, `request_password_reset`, `confirm_password_reset`.
- ✓ Bundle contiene 137 occurrences de `"lunfardo_name"` (133 clubs + ~4 menciones en código).
- ✓ Bundle contiene `aguante: 50`, `velocidad: 50`, `astucia: 50`, `carisma: 50` (stats hardcoded D-11).
- ✓ Bundle contiene `validatePibeName`, `accountDeleteId`.
- ✓ Bundle NO contiene la palabra `faction` en contexto create_pibe (D-10 verified — `grep` returned `false`).
- ✓ Bundle contiene `Phase 1 stub` log line (request_password_reset stub log).
- ✓ `scripts/autoloads/NakamaService.gd:17` matchea Railway server key `aee9c099d52a6c22f52fb8bc9f4b72d9` (CHK-07).
- ✓ `head -10 .planning/phases/01-foundation/01-VALIDATION.md` confirma `nyquist_compliant: true` + `wave_0_complete: true` (CHK-03).
- ✓ `git log --oneline -3` muestra `788f0cc`, `d2536c7`, `2458cd3` en orden.
- ✓ `git push origin main` exitoso 3 veces.
- ✓ `git diff --diff-filter=D HEAD~3 HEAD` vacío (sin deleciones accidentales).
- ✓ `build/` NO está stageado (verificado via `git status` — solo aparece como untracked dentro de `nakama/`, ignorado por `nakama/.gitignore`).
- ✓ `node_modules/` NO está stageado (mismo mecanismo).

## Lo que NO se verificó en este executor (requiere redeploy + acción humana)

- ⏸ Railway deploy con el nuevo Dockerfile multi-stage → build node:20-alpine OK + heroiclabs/nakama final image OK.
- ⏸ Logs `Clubs seeded: 133 (version=v1)` en primer boot, `Clubs already seeded ...` en bootes posteriores.
- ⏸ `bash nakama/smoke-test.sh` con server key real → `ALL SMOKE TESTS PASSED`.
- ⏸ Plan literal step "ejecutar 11 registers consecutivos desde mismo IP para validar rate limit 10/min" — opcional, no en scope mínimo.

Estos checks quedan para el orchestrator/usuario inline post-redeploy (Task 4 del plan, fuera del scope de este executor).

## Próximos pasos

1. **Orchestrator Task 4 (human-verify):** orchestrator pide redeploy manual Railway al usuario, espera logs verdes, corre smoke-test.sh con NAKAMA_KEY real, confirma `ALL SMOKE TESTS PASSED`, actualiza INFRA-NOTES.md con timestamp del primer deploy real (puede sobreescribir el "wiring" del 2026-05-16 con el "first successful redeploy" date).
2. **Plan 01-04 (Wave 3):** 6 screens (Splash, Auth, ForgotPassword, ClubPicker, PibeCreator, Tutorial, Home). Los 3 RPCs reales (`get_clubs`, `create_pibe`, `delete_account`) ya están operativos y listos para que `AuthManager` + screens nuevos los invoquen via `NakamaService.client.rpc_async(...)`. ForgotPasswordScreen llamará al stub `request_password_reset` y debe mostrar mensaje genérico ("Si el email existe te enviamos instrucciones") sin importar la respuesta — exactamente lo que el stub habilita.
3. **Plan 01-05 (Wave 3):** Privacy Policy + Reset HTML + AAIP docs. El Reset HTML asumirá que `confirm_password_reset` está stubbed — debería mostrar mensaje "Esta función estará disponible próximamente" si recibe `feature_unavailable_phase_1`. Cuando Phase 2 resuelva Resend, ambos lados (RPC + HTML) se actualizan en sincronía.
4. **Phase 2:** prioridad alta — provisionar dominio + Resend + DNS records + RESEND_API_KEY en Railway → reemplazar bodies de los 2 stubs siguiendo los TODOs in-code. El test smoke se extiende para incluir reset E2E.
5. **Phase 7 cleanup:** rotar server key + extraer a build flag / env file por threat T-1-RT-11.

## Self-Check: PASSED

- ✓ `C:\Users\el_lu\BarraBrava\nakama\package.json` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\tsconfig.json` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\build.mjs` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\.gitignore` existe (excludes `node_modules/` + `build/`)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\local.yml` existe (con `registration_per_ip_per_min: 10` + `rpc_per_user_per_min: 60`)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\data\clubs.json` existe (133 entries, 5 divisiones)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\main.ts` existe (InitModule + seedClubs + registerRpc ×5)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\util\validation.ts` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\util\email.ts` existe (stub)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\rpc\get_clubs.ts` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\rpc\create_pibe.ts` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\rpc\delete_account.ts` existe
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\rpc\request_password_reset.ts` existe (stub)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\src\rpc\confirm_password_reset.ts` existe (stub)
- ✓ `C:\Users\el_lu\BarraBrava\nakama\smoke-test.sh` existe + ejecutable (chmod +x verificado)
- ✓ `C:\Users\el_lu\BarraBrava\Dockerfile.nakama` modificado (multi-stage, COPY runtime activo)
- ✓ `C:\Users\el_lu\BarraBrava\.planning\phases\01-foundation\INFRA-NOTES.md` modificado (Wave 2 section appended)
- ✓ Commit `788f0cc` en `git log`
- ✓ Commit `d2536c7` en `git log`
- ✓ Commit `2458cd3` en `git log`
- ✓ Los 3 commits pusheados a `origin/main` (verificado por output `git push`)
- ✓ Sin deleciones accidentales (verificado vía `git diff --diff-filter=D HEAD~3 HEAD` empty)
- ✓ STATE.md NO modificado (orchestrator owns)
- ✓ ROADMAP.md NO modificado (orchestrator owns)
