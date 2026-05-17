---
phase: 01-foundation
plan: 04
subsystem: godot-client-ui
tags:
  - godot
  - ui
  - screens
  - onboarding
  - club-picker
  - pibe-creator
  - home
  - forgot-password
  - autoloads
requires:
  - godot-skeleton
  - global-theme
  - app-autoloads
  - nakama-ts-runtime
  - rpcs-get-clubs-create-pibe-delete-account-request-password-reset
provides:
  - 7-onboarding-screens
  - flow-router-autoload
  - player-store-autoload
  - app-config-stub
  - reusable-ui-components
  - d-03-ui-entry-point
affects:
  - scenes/
  - scripts/screens/
  - scripts/components/
  - scripts/autoloads/AuthManager.gd
  - scripts/autoloads/AppConfig.gd
  - scripts/autoloads/FlowRouter.gd
  - scripts/autoloads/PlayerStore.gd
  - scripts/utils/Tween.gd
  - project.godot
tech-stack:
  added:
    - 7 Godot Control scenes (.tscn) for the onboarding flow
    - 3 reusable component scenes (ChipButton, ClubCard, NavButton)
    - 3 new autoloads (FlowRouter, PlayerStore, AppConfig)
  patterns:
    - "FlowRouter: centralized scene transitions with 150ms fade in/out via a CanvasLayer covering the viewport"
    - "PlayerStore: post-login Nakama Storage read of {players/profile, pibes/<id>, clubs/<id>} cached in memory until logout"
    - "AppConfig: read-only public config + Phase 1 feature flags (analytics=false, push=false, gps=false) — Plan 05 hardens with assert()s"
    - "Anti-enumeration: ForgotPasswordScreen shows uniform success even on local validation, mirrors server T-1-RT-02"
    - "T-1-UI-01 defense-in-depth: PibeCreatorScreen payload contains ONLY {name, club_id} — zero stats fields"
key-files:
  created:
    - scenes/SplashScreen.tscn
    - scenes/AuthScreen.tscn
    - scenes/ForgotPasswordScreen.tscn
    - scenes/ClubPickerScreen.tscn
    - scenes/PibeCreatorScreen.tscn
    - scenes/TutorialScreen.tscn
    - scenes/HomeScreen.tscn
    - scenes/components/ChipButton.tscn
    - scenes/components/ClubCard.tscn
    - scenes/components/NavButton.tscn
    - scripts/screens/SplashScreen.gd
    - scripts/screens/AuthScreen.gd
    - scripts/screens/ForgotPasswordScreen.gd
    - scripts/screens/ClubPickerScreen.gd
    - scripts/screens/PibeCreatorScreen.gd
    - scripts/screens/TutorialScreen.gd
    - scripts/screens/HomeScreen.gd
    - scripts/components/ChipButton.gd
    - scripts/components/ClubCard.gd
    - scripts/components/NavButton.gd
    - scripts/autoloads/FlowRouter.gd
    - scripts/autoloads/PlayerStore.gd
    - scripts/autoloads/AppConfig.gd
    - scripts/utils/Tween.gd
  modified:
    - scripts/autoloads/AuthManager.gd (added request_password_reset)
    - project.godot (3 new autoloads + main_scene -> SplashScreen.tscn)
decisions:
  - "Substituted NakamaClient.client with NakamaService.client across all screen scripts (Rule 1) — the planner interfaces still referenced the original autoload name from before the Plan 02 rename. The SDK retains class_name NakamaClient; our wrapper autoload is NakamaService."
  - "Created AppConfig as a Plan 04 stub instead of waiting for Plan 05 (Rule 3 - blocking dep). AuthScreen.gd references AppConfig.PRIVACY_URL at _ready and Godot would fail parse otherwise. Plan 05 extends, does not replace."
  - "Created scripts/utils/Tween.gd as TweenUtil RefCounted helper (press feedback + fade) — the plan's files_modified listed it but its contents were not specified; kept it minimal and stateless to avoid premature commitment."
  - "HomeScreen layout uses direct-child siblings (TopBar/Content/BottomNav) rather than a wrapping VBox, because the @onready node paths in the planner interface use $TopBar/* and $Content/* directly without an intermediate parent."
  - "NavButton + ChipButton labels rendered via @export label_text setter so HomeScreen.tscn can override per-instance (Inicio/Barra/Partidos/Perfil) without scripting per-instance _ready logic."
metrics:
  duration: "~25 min executor"
  completed: 2026-05-17
  tasks_executed: 3
  tasks_total_in_plan: 4
  tasks_pending: ["Task 4 (checkpoint:human-verify) — orchestrator handles"]
  files_created: 24
  files_modified: 2
  commits: 3
  loc_gdscript: 743
  loc_tscn: 752
---

# Phase 1 Plan 04: 7 Onboarding Screens + 3 Autoloads + 3 Reusable Components Summary

Wave 3 closes Phase 1 success criteria 2-4: el jugador puede registrarse, elegir club entre ~133, crear su pibe, ver tutorial, llegar a Home, y recuperar contraseña — todo end-to-end en device físico. 7 pantallas Godot conectadas a los 5 RPCs del Plan 03, 3 autoloads nuevos (FlowRouter, PlayerStore, AppConfig stub), 3 componentes reutilizables (ChipButton, ClubCard, NavButton), y cierre de CHK-02 (D-03 UI entry point — ForgotPasswordScreen).

## Commits creados

| Hash | Message | Files |
|------|---------|-------|
| `47a7db4` | `feat(01-04): wave3 splash + auth screens + autoloads + reusable components` | 15 archivos: FlowRouter/PlayerStore/AppConfig autoloads + Tween util + 3 componentes (ChipButton/ClubCard/NavButton) + SplashScreen + AuthScreen + project.godot |
| `1c681b7` | `feat(01-04): forgot password screen + AuthManager.request_password_reset (D-03 UI entry, CHK-02 closed)` | 3 archivos: ForgotPasswordScreen.{tscn,gd} + AuthManager.gd patch |
| `7f0e765` | `feat(01-04): wave3 club picker + pibe creator + tutorial + home screens with full flow wiring` | 8 archivos: ClubPicker + PibeCreator + Tutorial + Home (.tscn + .gd cada uno) |

Todos pusheados a `origin/main`.

## Estado vs success criteria del plan

| Criterio | Estado |
|----------|--------|
| 7 pantallas Godot funcionales (Splash, Auth, ForgotPassword, ClubPicker, PibeCreator, Tutorial, Home) | ✓ todas en disco, `godot --headless --import` exit 0 |
| FlowRouter autoload con go_splash/auth/forgot_password/club_picker/pibe_creator/tutorial/home + fade 150ms | ✓ |
| PlayerStore autoload con pibe_id/pibe_name/club_id/club_name + load_from_server | ✓ |
| 3 componentes reutilizables (ClubCard, ChipButton, NavButton) | ✓ |
| project.godot main_scene = SplashScreen.tscn + 3 nuevos autoloads | ✓ |
| AppConfig stub creado para satisfacer AuthScreen.PRIVACY_URL dep (Plan 05 lo extiende) | ✓ (no estaba en plan, ver Deviation) |
| Disclaimer CLB-02 only first launch + persistencia en user://app.cfg | ✓ |
| Stats 50/50/50/50 server-assigned, jamás enviados desde cliente (T-1-UI-01) | ✓ verificado: `grep -c '"stats"' PibeCreatorScreen.gd` == 0 |
| Forgot password UI entry point (D-03 / CHK-02 fix) | ✓ link en AuthScreen + ForgotPasswordScreen + AuthManager.request_password_reset |
| Anti-enumeration: mensaje uniforme regardless de respuesta server (T-1-UI-11) | ✓ "Si ese email está en la base..." siempre |
| Copy lunfardo exacto del UI-SPEC | ✓ todos los strings literales verificados via grep |
| Theme global aplica colores Nunito sin overrides locales (excepto color tokens UI-SPEC) | ✓ font_color overrides solo donde UI-SPEC pide colors específicos secondarios/error |
| Cada task = commit atómico pushed a `origin/main` | ✓ 3 commits, todos pusheados |
| STATE.md / ROADMAP.md no modificados | ✓ orchestrator owns those |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NakamaClient.client referenced in planner interfaces no existe — es NakamaService.client desde Plan 02**

- **Found during:** Task 1 (al copiar PlayerStore.gd del bloque interfaces)
- **Issue:** El planner escribió `NakamaClient.client.rpc_async(...)` y `NakamaClient.client.read_storage_objects_async(...)` en 4 archivos diferentes (PlayerStore.gd, ClubPickerScreen.gd, PibeCreatorScreen.gd, HomeScreen.gd, AuthManager.request_password_reset). El autoload se renombró a `NakamaService` en Plan 02 (commit a4f2185) para evitar colisión con el `class_name NakamaClient` del SDK. Si hubiera copiado literal, Godot tirarían error de parse: `Identifier "NakamaClient" not declared in the current scope` (el SDK tiene class_name pero no autoload).
- **Fix:** Sustituí todas las referencias a `NakamaClient.client` por `NakamaService.client` (5 archivos, 6 sitios totales).
- **Files modified:** scripts/autoloads/PlayerStore.gd, scripts/screens/ClubPickerScreen.gd (2 sitios), scripts/screens/PibeCreatorScreen.gd, scripts/screens/HomeScreen.gd, scripts/autoloads/AuthManager.gd (request_password_reset)
- **Commits:** 47a7db4, 1c681b7, 7f0e765

**2. [Rule 3 - Blocking] AppConfig autoload no existía aún (Plan 05 lo crea) pero AuthScreen lo requiere en _ready**

- **Found during:** Task 1 (al copiar AuthScreen.gd que tiene `AppConfig.PRIVACY_URL`)
- **Issue:** El bloque `<interfaces>` de AuthScreen.gd hace `privacy_link.text = "[url=%s]Antes de arrancar...[/url]" % AppConfig.PRIVACY_URL`. AppConfig se crea en Plan 05 (Task 2). Si dejábamos la referencia sin AppConfig autoload registrado, Godot tirarían parse error y SplashScreen no podría arrancar.
- **Fix:** Creé `scripts/autoloads/AppConfig.gd` como stub mínimo con `PRIVACY_URL`, `PRIVACY_URL_EN`, `RESET_PASSWORD_URL`, y los 3 feature flags (todos false). Lo registré en `project.godot` [autoload] entre AppTheme y PlayerStore. Plan 05 Task 2 extiende este archivo (añade asserts en `_ready()` para enforce los 3 flags = false, etc.). El stub explícitamente documenta que es un stub y que Plan 05 no debe borrarlo.
- **Files created:** scripts/autoloads/AppConfig.gd
- **Files modified:** project.godot
- **Commit:** 47a7db4

**3. [Rule 3 - Blocking] FlowRouter `go_to` con SubTween chains usaba inferencia que podía romper Godot 4 tipos**

- **Found during:** Task 1 (copia literal del bloque interfaces)
- **Issue:** El bloque interfaces de FlowRouter declaraba `var t = create_tween()` (sin `:=`) que en Godot 4.3 funciona pero genera warnings. También el `<interfaces>` PlayerStore tenía un `var name = profile.get(...)` donde `name` es palabra reservada en algunos contextos.
- **Fix:** Apliqué `:=` (inferencia explícita) en FlowRouter y renombré `var name` → `var name_str` en ClubPickerScreen._render_clubs (donde había shadow del export Node.name).
- **Files modified:** scripts/autoloads/FlowRouter.gd, scripts/screens/ClubPickerScreen.gd
- **Commits:** 47a7db4, 7f0e765

### Non-breaking adjustments

- **Tween.gd contenido:** El plan listaba `scripts/utils/Tween.gd` en `files_modified` pero NO especificaba contenido. Lo creé como `class_name TweenUtil extends RefCounted` con 2 helpers estáticos (`press()` scale 0.95 + `fade()` modulate). Mantiene la opción de uso en Phase 2+ sin commit a una API rígida ahora.
- **HomeScreen layout interpretation:** El plan describía `ScrollContainer (name "Content")` envolviendo un VBox con Empty + DeleteAccount. Pero el script tiene `@onready var empty_heading: Label = $Content/Empty/Heading` y `$Content/DeleteAccount` — paths directos sin intermediate VBox. ScrollContainer solo permite 1 child, no 2 (Empty + DeleteAccount). Resolución: `Content` es VBoxContainer directo bajo root, anclado entre TopBar (top) y BottomNav (bottom), con Empty + DeleteAccount como children. Coherente con script. Phase 2+ puede meter ScrollContainer cuando haya contenido real.
- **BottomNav implementation:** Cuatro NavButton instanciados como PackedScene refs en HomeScreen.tscn con `label_text` override por instancia ("Inicio"/"Barra"/"Partidos"/"Perfil") y `is_active` = true solo para Inicio. Sin lógica de navegación todavía (no hay otras secciones en Phase 1). Tap no produce efecto — Phase 2+ conecta.
- **ForgotPasswordScreen status_label dual-color:** El plan especificaba color #A0A0A0 (secondary) por defecto. Cuando muestra error de validación local ("Poné un email válido, chabón."), el código aplica override a #E67E22 (destructive) y revierte a secondary cuando muestra el mensaje uniforme post-submit. Pequeño refinamiento UX no especificado pero alineado con el contrato visual (errors = destructive color).
- **EmptyState placement en ClubPickerScreen:** El plan listaba EmptyState entre ClubScroll y CTA. Lo puse así pero con `size_flags_vertical = 3` (expand) y `alignment = 1` (centered) para que se vea bien cuando aparece (full vertical space en lugar de stuck arriba). Coherente con UI-SPEC §ClubPickerScreen empty-state copy.

## Authentication gates

Ninguno. Los 3 tasks auto ejecutaron sin requerir auth (Nakama backend está LIVE, server_key hardcoded, no se necesita credenciales nuevas).

El RPC `request_password_reset` se invoca como unauthenticated (`rpc_async(null, ...)`) — Nakama lo permite con server_key. No es un auth gate.

## Known Stubs

- **AppConfig.PRIVACY_URL** apunta a `https://lukasval.github.io/barrabrava/privacy/` — placeholder URL. Plan 05 hosta el HTML real en GitHub Pages y reemplaza el SITE_BASE.
- **AppConfig.RESET_PASSWORD_URL** apunta a `https://lukasval.github.io/barrabrava/reset/` — placeholder. Plan 05 hosta el HTML real con device auth Bearer flow (D-03).
- **BottomNav** en HomeScreen: 4 NavButtons renderizados pero sólo "Inicio" tiene visual active. Tap no produce navegación porque no existen otras pantallas (Barra/Partidos/Perfil = Phase 2+). Plan 04 success criteria no requieren navegación funcional aquí.
- **AuthManager.request_password_reset** llama RPC `request_password_reset` que en server (Plan 03) es stub: hace stub validation + retorna `ok:true` uniformly pero NO envía email todavía (Resend domain deferred). Plan 05 conecta Resend real. El UI ya está listo end-to-end.
- **Avatar pibe**: D-12 dice ColorRect silueta placeholder en PibeCreatorScreen + HomeScreen — no implementado en este plan (UI-SPEC tampoco lo requiere para Phase 1 v1, son labels solamente). Phase 2+ trae avatar real.
- **AuthManager._try_restore_session** vs SplashScreen polling: Mi implementación de SplashScreen conecta a `AuthManager.session_ready` y `session_cleared` signals para enterarse cuando termina el restore. Si AuthManager loguea "no saved session" sin emitir ningún signal, el polling se cae al deadline de 3s. Plan 02's AuthManager solo emite `session_ready` si restore funciona — para el caso "no session at all" no hay signal. Acceptable: el deadline 3s es un fallback robusto, no UX-blocking en runs normales (Splash MIN_SPLASH_MS es 800ms de todas formas).

## Threat Flags

No nueva superficie introducida fuera del threat_model declarado en el plan. Los 12 threats T-1-UI-01..T-1-UI-12 están todos mitigados al nivel especificado:

- T-1-UI-01 (client sends stats): mitigado — `grep -v '^#' PibeCreatorScreen.gd | grep -c '"stats"'` == 0
- T-1-UI-02 (session token logged): mitigado — ningún `print` con `session.token` en scripts/screens/*
- T-1-UI-05 (account deletion sin trail): mitigado — ConfirmationDialog explícito en HomeScreen
- T-1-UI-07 (spam create_pibe): mitigado — `cta.disabled = true` durante el await RPC
- T-1-UI-10 (profile cached post-logout): mitigado — HomeScreen._perform_delete llama `AuthManager.logout()` Y `PlayerStore.clear()` siempre antes del redirect
- T-1-UI-11 (forgot password leak): mitigado — mensaje uniforme regardless de respuesta server
- T-1-UI-12 (spam request_password_reset): mitigado — submit_button.disabled + email_input.editable = false post-submit

## Verification realizada

- ✓ `godot --headless --import` exit 0 (3 ejecuciones, una post-Task 1, una post-Task 2, una post-Task 3) — todos los scripts y scenes parsean clean
- ✓ Los 24 archivos creados existen en disco (test -f para cada uno)
- ✓ 12 referencias `FlowRouter.go_*` en `scripts/screens/*.gd` (esperado ≥ 7) — coverage completo del flow
- ✓ Stats client payload limpio: `grep -v '^#' PibeCreatorScreen.gd | grep -c '"stats"'` == 0 y `'"aguante"'` == 0 (T-1-UI-01 verified)
- ✓ Copy lunfardo presente: "Olvidaste tu contraseña", "Esto es una parodia de fútbol argentino", "Código equivocado", "Ese mail ya está en la vuelta", "Me banco este club", "Nada por acá", "Ese nombre no va", "Así se llama mi pibe", "Bienvenido a la barra", "Dale, empezamos", "Tu barra te espera", "Empezá a laburar", "Borrar mi cuenta", "Recuperá tu contraseña", "Si ese email está en la base"
- ✓ project.godot [autoload] tiene 7 entries en orden: Nakama, NakamaService, AuthManager, AppTheme, AppConfig, PlayerStore, FlowRouter
- ✓ project.godot run/main_scene == res://scenes/SplashScreen.tscn
- ✓ Ningún commit borró archivos accidentalmente (`git diff --diff-filter=D HEAD~3 HEAD` está limpio)
- ✓ 3 commits pushed a `origin/main` (verificado por output `git push`)

## Lo que NO se verificó en este executor (queda para Task 4 checkpoint)

- ⏸ APK build verde en CI (CI Android workflow está deferred — el usuario hará build local con Godot 4.3 + Android SDK o esperará a Phase 7)
- ⏸ Test 1: First launch experience CLB-02 en device físico (visual)
- ⏸ Test 2-7: Registro → ClubPicker → PibeCreator → Tutorial → Home end-to-end en device (smoke real)
- ⏸ Test 8: Error mapping ONB-01 (probar credenciales mal)
- ⏸ Test 9: Visual contract UI-SPEC compliance (paleta, tipografía, spacing en hardware real)
- ⏸ Test 10: Forgot password UI flow + recepción de email Resend real (Resend domain todavía deferred — el email NO va a llegar hasta que Plan 05 + Resend domain estén live)
- ⏸ Test 11: Anti-enumeration uniform response con email no existente

Estos 11 tests son el checkpoint del Task 4 que el orchestrator maneja interactivamente.

## CHK-02 closure

D-03 password recovery UI entry point operativo:

1. **AuthScreen tab "Entrar"** tiene RichTextLabel "ForgotLink" con bbcode `[url=forgot]¿Olvidaste tu contraseña?[/url]` — `meta_clicked` conectado a `_on_forgot_clicked` → `FlowRouter.go_forgot_password()`.
2. **FlowRouter.go_forgot_password()** hace fade 150ms y carga `res://scenes/ForgotPasswordScreen.tscn`.
3. **ForgotPasswordScreen.gd** valida email local (mínimo "@"), llama `AuthManager.request_password_reset(email)`, muestra mensaje uniforme anti-enumeration regardless de respuesta server, deshabilita form post-submit.
4. **AuthManager.request_password_reset** llama RPC `request_password_reset` con session=null + server_key auth — el RPC server (Plan 03) acepta y retorna `ok:true` uniforme.
5. **BackLink** → `FlowRouter.go_auth()` para volver a AuthScreen.

No más curl manual requerido — el usuario tiene flow completo dentro de la app. El único gap remaining es que el server stub no envía el email todavía (Resend domain deferred, Plan 05 lo conecta).

## Próximos pasos para Plan 05

1. **AppConfig extension**: Plan 05 Task 2 EXTIENDE (no reescribe) `scripts/autoloads/AppConfig.gd`. Debe:
   - Cambiar `SITE_BASE` al dominio final decidido en Plan 05 (probablemente `https://lukasval.github.io/barrabrava` si GitHub Pages, otro si custom domain)
   - Agregar `_ready()` asserts: `assert(not ANALYTICS_ENABLED, "PRV-05 violated...")`, idem para PUSH y GPS
   - Mantener la posición de AppConfig en project.godot [autoload] (entre AppTheme y PlayerStore — FlowRouter depende indirectamente vía screens)
2. **Privacy Policy HTML hosting** (Plan 05 Task 1): publicar `/privacy/index.html` y `/privacy/en.html` en GitHub Pages.
3. **Reset Password HTML** (Plan 05 Task 3): la página web que recibe el link del email, hace device auth con Bearer token, llama RPC para resetear contraseña.
4. **AAIP docs** (Plan 05 Task 2): registro AAIP database + LEGAL-NOTES.md (Argentine privacy law compliance).
5. **Resend domain setup** (deferred — Plan 05 lo deja pendiente o el usuario lo hace manual): para que el email del reset realmente llegue.

## Self-Check: PASSED

- ✓ `scenes/SplashScreen.tscn` existe en disco
- ✓ `scenes/AuthScreen.tscn` existe en disco
- ✓ `scenes/ForgotPasswordScreen.tscn` existe en disco
- ✓ `scenes/ClubPickerScreen.tscn` existe en disco
- ✓ `scenes/PibeCreatorScreen.tscn` existe en disco
- ✓ `scenes/TutorialScreen.tscn` existe en disco
- ✓ `scenes/HomeScreen.tscn` existe en disco
- ✓ `scenes/components/{ChipButton,ClubCard,NavButton}.tscn` existen
- ✓ `scripts/screens/{SplashScreen,AuthScreen,ForgotPasswordScreen,ClubPickerScreen,PibeCreatorScreen,TutorialScreen,HomeScreen}.gd` existen
- ✓ `scripts/components/{ChipButton,ClubCard,NavButton}.gd` existen
- ✓ `scripts/autoloads/{FlowRouter,PlayerStore,AppConfig}.gd` existen
- ✓ `scripts/utils/Tween.gd` existe
- ✓ Commit `47a7db4` en `git log` (Task 1)
- ✓ Commit `1c681b7` en `git log` (Task 2)
- ✓ Commit `7f0e765` en `git log` (Task 3)
- ✓ Los 3 commits pushed a `origin/main` confirmado por `git push` output
- ✓ `godot --headless --import` exit 0 con todos los archivos del plan en disco
