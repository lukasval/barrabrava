---
phase: 01-foundation
plan: 02
subsystem: godot-client
tags:
  - godot
  - skeleton
  - theme
  - nakama-sdk
  - autoload
requires:
  - infra-scaffold
  - android-debug-ci
  - railway-skeleton
provides:
  - godot-skeleton
  - nakama-sdk-vendored
  - global-theme
  - app-autoloads
affects:
  - project.godot
  - addons/com.heroiclabs.nakama/
  - assets/fonts/
  - assets/theme/
  - scripts/autoloads/
  - scenes/PlaceholderMain.tscn
tech-stack:
  added:
    - Godot 4.3 project (config_version=5, GL Compatibility renderer, portrait, canvas_items stretch)
    - Nakama-Godot SDK v3.4.0 (Apache 2.0, vendored at addons/com.heroiclabs.nakama/)
    - Nunito font family (SIL OFL 1.1) — Regular 400 + Bold 700, latin subset from fontsource CDN
  patterns:
    - Single Theme.tres applied project-wide via project.godot gui/theme/custom
    - Autoload singletons (Nakama from SDK, NakamaService wrapper, AuthManager, AppTheme)
    - Session persistence via ConfigFile in user://session.cfg (Phase 1 — Keychain deferred)
    - Reusable StyleBoxFlat .tres resources for local component overrides
key-files:
  created:
    - project.godot
    - icon.svg
    - scenes/PlaceholderMain.tscn
    - scripts/PlaceholderMain.gd
    - scripts/utils/SafeArea.gd
    - scripts/autoloads/AppTheme.gd
    - scripts/autoloads/NakamaService.gd
    - scripts/autoloads/AuthManager.gd
    - addons/com.heroiclabs.nakama/ (30 files, SDK v3.4.0)
    - assets/fonts/Nunito-Regular.ttf
    - assets/fonts/Nunito-Bold.ttf
    - assets/fonts/Nunito-OFL.txt
    - assets/theme/Theme.tres
    - assets/theme/PrimaryButton.tres
    - assets/theme/LineEditNormal.tres
    - assets/theme/LineEditFocused.tres
    - assets/theme/CardPanel.tres
  modified: []
decisions:
  - "Autoload renamed NakamaClient → NakamaService to avoid class_name collision with the SDK's class_name NakamaClient (Apache 2.0 SDK type)"
  - "SDK's Nakama.gd registered as autoload Nakama (per official SDK README) — Nakama.create_client(...) is an instance method, not static"
  - "Editor plugin entry removed from project.godot — SDK v3.4.0 ships no plugin.cfg, it is consumed as plain GDScript via autoload"
  - "Nunito sourced from fontsource CDN (latin subset, ~39KB each TTF) — googlefonts/nunito repo only ships variable fonts; static is needed for predictable rendering"
  - "Nakama server_key hardcoded in NakamaService.gd per user approval — public client identifier, will be rotated pre-launch (Phase 7)"
metrics:
  duration: "~15 min executor"
  completed: 2026-05-15
  tasks_executed: 3
  tasks_total_in_plan: 4
  tasks_pending: ["Task 4 (human-verify checkpoint — auto-approved per workflow.auto_advance=true)"]
  files_created: 47
  files_modified: 0
  commits: 4
  font_assets_total_bytes: 82913
---

# Phase 1 Plan 02: Godot 4.3 Skeleton + Nakama SDK + Theme + Autoloads Summary

Esqueleto del proyecto Godot 4.3 con autoloads (Nakama SDK + NakamaService wrapper + AuthManager + AppTheme), Theme.tres global con Nunito + paleta UI-SPEC, escena placeholder lista para que el CI Android Debug exporte un APK ejecutable. SDK Nakama v3.4.0 vendored en `addons/com.heroiclabs.nakama/`.

## Commits creados

| Hash | Message | Files |
|------|---------|-------|
| `19b6bd6` | `chore(01-02): scaffold Godot 4.3 project.godot + icon.svg + dir structure` | project.godot, icon.svg, scenes/PlaceholderMain.tscn, scripts/PlaceholderMain.gd, scripts/utils/SafeArea.gd, scripts/autoloads/{AppTheme,NakamaClient,AuthManager}.gd |
| `8bde1c2` | `chore(01-02): vendor Nakama-Godot SDK v3.4.0 addon` | addons/com.heroiclabs.nakama/* (32 files, ~13694 LOC including LICENSE + CHANGELOG) |
| `a4f2185` | `fix(01-02): rename NakamaClient autoload to NakamaService + add Nakama SDK singleton` | project.godot, scripts/PlaceholderMain.gd, scripts/autoloads/AuthManager.gd, rename NakamaClient.gd → NakamaService.gd |
| `e9aa6aa` | `feat(01-02): add global Theme.tres + Nunito fonts + StyleBox resources` | assets/fonts/{Nunito-Regular.ttf,Nunito-Bold.ttf,Nunito-OFL.txt}, assets/theme/{Theme,PrimaryButton,LineEditNormal,LineEditFocused,CardPanel}.tres |

Todos pusheados a `origin/main`.

## Estado vs success criteria del plan

| Criterio | Estado |
|----------|--------|
| `project.godot` con `config_version=5`, 4 autoloads (Nakama, NakamaService, AuthManager, AppTheme), portrait, `canvas_items` stretch | ✓ |
| `addons/com.heroiclabs.nakama/` populado con SDK Godot 4 v3.4.0 | ✓ (30 .gd files + LICENSE + CHANGELOG) |
| `assets/fonts/Nunito-Regular.ttf` + `Nunito-Bold.ttf` + `Nunito-OFL.txt` válidos | ✓ (39288 + 39240 + 4385 bytes; `file` confirma TrueType) |
| `assets/theme/Theme.tres` + 4 StyleBox `.tres` con Nunito + paleta UI-SPEC | ✓ (accent `#D62828` aparece 3 veces: button bg, lineedit focus border, caret) |
| `NakamaService.gd` apunta a Railway host:port + ssl + server_key | ✓ (`nakama-production-7ea8.up.railway.app:443` scheme `https`, server_key `aee9c099...`) |
| `AuthManager.gd` con `authenticate_email_async` + session restore desde `user://session.cfg` | ✓ |
| `AppTheme.gd` con `safe_area_top` + color constants UI-SPEC | ✓ |
| `scenes/PlaceholderMain.tscn` + `scripts/PlaceholderMain.gd` referenciada como main_scene | ✓ |
| `scripts/utils/SafeArea.gd` existe | ✓ |
| Cada task = commit atómico pushed a `origin/main` | ✓ (4 commits) |
| STATE.md / ROADMAP.md no modificados | ✓ (orchestrator owns those) |
| No secrets en commits (server_key OK por aprobación) | ✓ |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Autoload `NakamaClient` colisionaba con `class_name NakamaClient` del SDK**

- **Found during:** Task 2 (post-extract del SDK)
- **Issue:** El SDK Nakama v3.4.0 declara `class_name NakamaClient` en `addons/com.heroiclabs.nakama/client/NakamaClient.gd`. Nuestro autoload original también se llamaba `NakamaClient`. En Godot 4, esto causa shadowing: cualquier `var x: NakamaClient = ...` apunta al autoload (Node) en vez de la clase del SDK, rompiendo el typing.
- **Fix:** Renombré nuestro autoload a `NakamaService` (`scripts/autoloads/NakamaService.gd`). Actualicé references en `AuthManager.gd` (3 sitios) y `PlaceholderMain.gd` (1 sitio). Esto preserva la API pública del SDK y nuestra capa wrapper.
- **Files modified:** `project.godot`, `scripts/autoloads/NakamaService.gd` (renamed from NakamaClient.gd), `scripts/autoloads/AuthManager.gd`, `scripts/PlaceholderMain.gd`
- **Commit:** `a4f2185`

**2. [Rule 1 - Bug] `Nakama.create_client(...)` es método de instancia, no static**

- **Found during:** Task 2 (al inspeccionar `Nakama.gd` del SDK)
- **Issue:** El plan `<interfaces>` mostraba `var NakamaSDK = preload(...); NakamaSDK.create_client(...)` como si `create_client` fuera static. En la realidad, `create_client` es método de instancia y el SDK README oficial documenta el patrón con `Nakama` registrado como autoload del SDK.
- **Fix:** Registré `Nakama="*res://addons/com.heroiclabs.nakama/Nakama.gd"` como autoload en `project.godot`. Reescribí `NakamaService._ready()` para usar `Nakama.create_client(...)` (singleton instance call) en vez de preload + call.
- **Files modified:** `project.godot`, `scripts/autoloads/NakamaService.gd`
- **Commit:** `a4f2185`

**3. [Rule 3 - Blocking] SDK v3.4.0 NO ships `plugin.cfg`**

- **Found during:** Task 2 (verify step esperaba `addons/com.heroiclabs.nakama/plugin.cfg`)
- **Issue:** El plan asumía que el SDK es un editor plugin con `plugin.cfg`. La realidad es que v3.4.0 (Godot 4 line) NO incluye `plugin.cfg` ni `plugin.gd` — el SDK se consume como plain GDScript via autoload. El `editor_plugins enabled=PackedStringArray("res://addons/.../plugin.cfg")` que el plan agregaba a `project.godot` habría producido warning de plugin missing y bloqueado el editor en algunos casos.
- **Fix:** Removí la sección `[editor_plugins]` de `project.godot`. El SDK funciona vía autoload `Nakama` como documenta el README oficial.
- **Files modified:** `project.godot`
- **Commit:** `a4f2185`

**4. [Rule 3 - Blocking] Nunito static TTFs no existen en googlefonts/nunito repo**

- **Found during:** Task 3 (descarga de fonts)
- **Issue:** Las URLs del plan (`https://github.com/googlefonts/nunito/raw/main/fonts/ttf/Nunito-{Regular,Bold}.ttf`) devuelven 404. El repo `googlefonts/nunito` solo publica variable fonts en `fonts/variable/Nunito[wght].ttf`.
- **Fix:** Usé `https://cdn.jsdelivr.net/fontsource/fonts/nunito@latest/latin-{400,700}-normal.ttf` (fontsource CDN, same SIL OFL 1.1 license, latin subset ~39KB cada uno — apropiado para el mercado argentino, no necesitamos cirílico/CJK). `Nunito-OFL.txt` sí descargó del repo oficial.
- **Files modified:** `assets/fonts/Nunito-Regular.ttf`, `assets/fonts/Nunito-Bold.ttf`
- **Commit:** `e9aa6aa`

### Non-breaking adjustments

- **plan_files_modified list rename:** El plan lista `scripts/autoloads/NakamaClient.gd` en `files_modified`. Real: el archivo es `scripts/autoloads/NakamaService.gd`. Ver Deviation #1.
- **Linter pass on project.godot:** Después de Task 1, un linter (probablemente VS Code o un git hook silencioso) reordenó keys en `[display]` (movió `window/handheld/orientation=1` al final). Sin impacto funcional — Godot acepta keys en cualquier orden dentro de una sección. Incluido en commit `e9aa6aa`.
- **Plan task 4 (checkpoint:human-verify) auto-approved:** Per `workflow.auto_advance=true` en `.planning/config.json` y `autonomous: true` en el plan frontmatter. Logged: `⚡ Auto-approved: Godot 4.3 skeleton + autoloads + Theme + SDK addon (verificación humana del editor + CI Android se hará durante Plan 03 o cuando el usuario abra Godot localmente)`.

## Authentication gates

Ninguno encontrado durante Tasks 1-3. (Task 4 normalmente requeriría el usuario abriendo Godot local + observando CI verde, pero fue auto-approved per auto_advance.)

## Known Stubs

- **Server key hardcoded** (`scripts/autoloads/NakamaService.gd:14`): `aee9c099d52a6c22f52fb8bc9f4b72d9` — público por diseño de Nakama (no es secreto), aprobado por el usuario para Phase 1. Phase 7 lo extrae a build config o flag de export per threat T-1-CLI-02.
- **No real auth attempted yet:** `AuthManager._try_restore_session()` solo se ejecuta al boot; si no hay `user://session.cfg`, loguea "no saved session" y retorna. La función `login()` / `register()` están listas pero ningún caller las invoca todavía — eso lo conecta Plan 04 (AuthScreen.tscn).
- **No tests todavía:** Ningún test unitario / integration. Plan 03 (Nakama TS runtime) y Plan 04 (pantallas) testean indirectamente via E2E.

## Threat Flags

No se introdujo nueva superficie de threat fuera del threat_model declarado en el plan. Cambios de scope (rename, autoload, SDK consumption pattern) son refactors estructurales sin nuevas trust boundaries.

## Verification realizada

- ✓ `test -f project.godot` + `grep config_version=5` + `grep PlaceholderMain.tscn` + 3 autoloads matched (Nakama, NakamaService, AuthManager, AppTheme — 4 total)
- ✓ `addons/com.heroiclabs.nakama/Nakama.gd` existe + tiene `func create_client` (línea 43)
- ✓ `file assets/fonts/Nunito-Regular.ttf` → "TrueType Font data, 15 tables" (válido)
- ✓ `wc -c assets/fonts/Nunito-OFL.txt` → 4385 (>1KB ✓)
- ✓ `grep -c "Color(0.839, 0.157, 0.157" assets/theme/Theme.tres` → 3 (button bg + lineedit focus border + caret)
- ✓ `grep -q "default_font_size = 16" assets/theme/Theme.tres` + `Button/font_sizes/font_size = 14`
- ✓ Threat T-1-CLI-05: `grep -nE "print.*token" scripts/autoloads/*.gd` → única match es string literal "no refresh token", NO loguea el token activo
- ✓ Ningún commit tiene file deletions accidentales (`git diff --diff-filter=D HEAD~4 HEAD` está limpio)
- ✓ 4 commits pushed a `origin/main` confirmado por `git push` output

## Lo que NO se verificó en este executor (requiere humano o Godot CLI)

- ⏸ Editor Godot abre `project.godot` sin errores fatales (requiere GUI — no se puede automatizar sin pintar en X11/Wayland)
- ⏸ Run scene (F5) muestra la pantalla placeholder con fuente Nunito y fondo `#1A1A1A` (visual verification)
- ⏸ Output console muestra los 4 logs `[Nakama] / [NakamaService] / [AuthManager] / [PlaceholderMain] / [AppTheme]` durante boot
- ⏸ GitHub Actions Android Debug Build ahora termina verde (el push de `e9aa6aa` debería triggerar el workflow — verificar en `https://github.com/lukasval/barrabrava/actions`)
- ⏸ APK artifact descargable > 1MB

Estos checks quedan pendientes para **Plan 03** o **on-demand user verification**.

## Próximos pasos para Plan 03

1. **Verificar editor Godot local:** abrir el proyecto, confirmar autoloads, verificar Theme aplicado.
2. **Verificar CI Android verde:** primer build con `project.godot` válido. Si falla, leer logs y aplicar fix incremental.
3. **Plan 03 (Wave 2):** Build TypeScript runtime de Nakama + 5 RPCs + `clubes.json` seed. NakamaService + AuthManager ya están listos para invocar `client.rpc(...)`.
4. **Plan 04 (Wave 3):** AuthScreen.tscn invoca `AuthManager.login()` y `AuthManager.register()`. El theme global se aplica automáticamente, los StyleBoxes de `assets/theme/*.tres` se pueden referenciar como `theme_override_styles/normal = preload("res://assets/theme/PrimaryButton.tres")` para componentes que necesiten variantes.
5. **Phase 7 cleanup:** Extraer `NAKAMA_SERVER_KEY_DEFAULT` a un mecanismo de config externa (build flag, env file, o feature flag) per threat T-1-CLI-02.

## Self-Check: PASSED

- ✓ `project.godot` existe en `C:\Users\el_lu\BarraBrava\project.godot`
- ✓ `addons/com.heroiclabs.nakama/Nakama.gd` existe
- ✓ `assets/fonts/Nunito-Regular.ttf` (39288 bytes, TrueType)
- ✓ `assets/fonts/Nunito-Bold.ttf` (39240 bytes, TrueType)
- ✓ `assets/fonts/Nunito-OFL.txt` (4385 bytes, "SIL Open Font License Version 1.1")
- ✓ `assets/theme/Theme.tres` referencia ambas fuentes + accent color 3 veces
- ✓ `assets/theme/{PrimaryButton,LineEditNormal,LineEditFocused,CardPanel}.tres` existen
- ✓ `scenes/PlaceholderMain.tscn` + `scripts/PlaceholderMain.gd` existen, scene es main_scene
- ✓ `scripts/autoloads/{AppTheme,NakamaService,AuthManager}.gd` existen
- ✓ `scripts/utils/SafeArea.gd` existe
- ✓ Commit `19b6bd6` en `git log` (Task 1)
- ✓ Commit `8bde1c2` en `git log` (Task 2)
- ✓ Commit `a4f2185` en `git log` (Task 1 fix — autoload rename)
- ✓ Commit `e9aa6aa` en `git log` (Task 3)
- ✓ Todos pushed a `origin/main` (verificado por `git push` output)
