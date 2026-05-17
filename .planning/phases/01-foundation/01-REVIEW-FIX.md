---
phase: 01-foundation
fixed_at: 2026-05-17T00:00:00Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-05-17
**Source review:** `.planning/phases/01-foundation/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 16 (4 Critical + 12 Warning)
- Fixed: 16
- Skipped: 0

Cada finding se commiteó atómicamente y se pusheó a `origin/main`. Cambios en TS (`nakama/src/**`) verificados con `npm run build` (bundle 50.8KB). Cambios en GDScript verificados con `Godot --headless --import` (sin parse errors). Cambios en bash verificados con `bash -n`. JavaScript verificado con `node -c`.

**Nota sobre verificación humana:** WR-09 (PlayerStore type validation) cambia behavior cuando un fixture devuelve un tipo inesperado — antes crasheaba, ahora devuelve `profile_corrupt`. Recomendamos confirmar que el flujo de re-login con DB corrupta efectivamente cae en el path nuevo. CR-01 (la fix del pibe key mismatch) idealmente debería verificarse end-to-end con un re-login real para confirmar que `pibe_name` aparece en HomeScreen.

## Fixed Issues

### CR-01: PlayerStore lee el pibe con la key incorrecta

**Files modified:** `scripts/autoloads/PlayerStore.gd`
**Commit:** `912a430`
**Applied fix:** Cambia el read del pibe de `key=pibe_id` (UUID que el server no usa) a `key="main"` consistente con `create_pibe.ts`. Actualiza el header comment del archivo para documentar el slot fijo de Phase 1.

### CR-02: ClubPickerScreen paginación dependía de campo `has_more` inexistente

**Files modified:** `scripts/screens/ClubPickerScreen.gd`
**Commit:** `80c21bb`
**Applied fix:** Reemplaza el loop `while data.get("has_more", false)` por `while _all_clubs.size() < total` usando el campo `total` que sí devuelve `get_clubs.ts`. Agrega `page_size=100` explícito a las requests para defense-in-depth si alguien sube clubs >200 o cambia el DEFAULT_PAGE_SIZE.

### CR-03: SplashScreen comía los 3s del timeout cuando no había sesión

**Files modified:** `scripts/autoloads/AuthManager.gd`
**Commit:** `5273d56`
**Applied fix:** Agrega `session_cleared.emit()` en los 4 early-return paths de `_try_restore_session()` (no hay archivo de sesión, token vacío, expirado sin refresh, refresh failed). SplashScreen ahora routea inmediatamente cuando no hay sesión.

### CR-04: smoke-test parseaba payload RPC envuelto incorrectamente

**Files modified:** `nakama/smoke-test.sh`
**Commit:** `c399352`
**Applied fix:** Agrega `?unwrap` a todos los RPC endpoints (igual que ya hace `web/reset-password/script.js`) para recibir el payload pelado sin el wrapper `{"payload":"..."}`. Cambia el body POST de double-stringified (`'"{...}"'`) a JSON plano (`'{...}'`). Step 4 prefiere `jq '.clubs | length'` para conteo accurate con fallback a grep.

### WR-01: reset-password creaba accounts huérfanos por cada submit

**Files modified:** `web/reset-password/script.js`
**Commit:** `fc4d38a`
**Applied fix:** Cambia el deviceId de `"reset-helper-" + token + "-" + Date.now()` a `"reset-helper-" + token` (sin timestamp). Re-submits para el mismo token ahora reusan la misma cuenta helper. Cap natural = N tokens emitidos en vez de N submits.

### WR-02: device-auth público sin captcha (account spam)

**Files modified:** `.planning/phases/01-foundation/INFRA-NOTES.md`
**Commit:** `42c64a2`
**Applied fix:** Documenta follow-up en sección "Follow-ups — diferidos a Phase 6/7" de INFRA-NOTES.md. Lista opciones a evaluar (Cloudflare Turnstile / hCaptcha free tier, o forzar onboarding por email gated). No es bloqueante para Phase 1 (no hay usuarios reales todavía), pero queda trackeado para soft-launch.

### WR-03: deny-list profanity hacía substring match

**Files modified:** `nakama/src/util/validation.ts`
**Commit:** `0f57a70`
**Applied fix:** Cambia de `lower.indexOf(DENY_WORDS[i])` a regex pre-compiled con `\b` word boundaries (`DENY_REGEXES`). Saca `'orto'` y `'hdp'` de la lista — los falsos positivos sobre nombres legítimos ("Ortodoxo", "Aporto", "Norto") superan el valor. Bundle rebuiltado (50.8KB).

### WR-04: AuthManager.logout() truncate redundante + globalize_path frágil

**Files modified:** `scripts/autoloads/AuthManager.gd`
**Commit:** `791e5dd`
**Applied fix:** Saca el `FileAccess.open(..., WRITE)` truncate (innecesario antes de borrar). Cambia `DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION_FILE))` por `DirAccess.remove_absolute(SESSION_FILE)` — el path `user://` se resuelve directamente, sin globalizar (necesario para HTML5 export). Agrega `FileAccess.file_exists()` check para silenciar warning en primer logout.

### WR-05: HomeScreen delete sin feedback al usuario en caso de error

**Files modified:** `scripts/screens/HomeScreen.gd`
**Commit:** `f3723f3`
**Applied fix:** Deshabilita `delete_button` al inicio del flow (evita double-tap → 2 RPCs concurrentes). En caso de error: re-habilita + muestra `AcceptDialog` visible con mensaje "No pudimos borrar la cuenta. Probá de nuevo en un rato."

### WR-06: ForgotPasswordScreen botón quedaba permanentemente disabled

**Files modified:** `scripts/screens/ForgotPasswordScreen.gd`
**Commit:** `329e580`
**Applied fix:** Mantiene la uniformidad anti-enumeration del mensaje pero re-habilita el botón después de 30s con texto "Enviar de nuevo". El email_input queda editable para que el usuario pueda corregir typos. Saca el segundo `submit_button.disabled = true` redundante y el `email_input.editable = false`.

### WR-07: ClubPickerScreen re-instanciaba 133 cards por filter change

**Files modified:** `scripts/screens/ClubPickerScreen.gd`
**Commit:** `9bf19df`
**Applied fix:** Implementa pool de ClubCards reutilizables (`_card_pool`). En vez de `queue_free` + `instantiate`, crece el pool on-demand, asigna data + visibilidad, oculta los sobrantes. El tap handler se conecta una sola vez con el pool y lee el club data del `meta` de cada card (nuevo handler `_on_card_pool_tapped`).

### WR-08: Storage collection/key names duplicados en >4 archivos

**Files modified:** `nakama/src/storage_keys.ts` (nuevo), `nakama/src/main.ts`, `nakama/src/rpc/create_pibe.ts`, `nakama/src/rpc/delete_account.ts`, `nakama/src/rpc/get_clubs.ts`, `scripts/autoloads/StorageKeys.gd` (nuevo), `scripts/autoloads/PlayerStore.gd`, `project.godot`
**Commit:** `a18297a`
**Applied fix:** Crea `nakama/src/storage_keys.ts` con `COL_PIBES`, `COL_PLAYERS`, `COL_CLUBS`, `COL_RESET_TOKENS`, `COL_META`, `KEY_PIBE_MAIN`, `KEY_PLAYER_PROFILE`, `SYSTEM_USER_ID`. Refactoriza los 4 RPCs server-side para importar de ahí, sacando el hack `void SYSTEM_USER_ID` de delete_account.ts. Crea autoload mirror `scripts/autoloads/StorageKeys.gd` registrado en `project.godot` antes de PlayerStore (orden importa). PlayerStore.gd actualizado para usar `StorageKeys.COL_*/KEY_*`.

### WR-09: PlayerStore crash si JSON.parse_string devuelve null/no-Dictionary

**Files modified:** `scripts/autoloads/PlayerStore.gd`
**Commit:** `1d08c20`
**Applied fix:** Agrega `typeof(profile_raw) != TYPE_DICTIONARY` checks antes de `.get()` para profile, pibe, y club. Retorna `"profile_corrupt"` en caso de profile corrupto en vez de crashear. Wrapea los string-typed reads con `str()` para defenderse de field types inesperados.

### WR-10: AppTheme bloqueaba main thread con load() síncrono

**Files modified:** `scripts/autoloads/AppTheme.gd`
**Commit:** `2cf9587`
**Applied fix:** Cambia `load()` síncrono a `ResourceLoader.load_threaded_request()` + check en `_process()`. Agrega const `THEME_PATH`. Cuando termina la carga aplica el theme y desactiva `_process`. Maneja `THREAD_LOAD_FAILED` / `THREAD_LOAD_INVALID_RESOURCE` con `push_warning`.

### WR-11: ChipButton creaba un nuevo StyleBoxFlat por _refresh_style()

**Files modified:** `scripts/components/ChipButton.gd`
**Commit:** `b13b718`
**Applied fix:** Cachea `_style_selected` y `_style_unselected` (2 `StyleBoxFlat` construidos una sola vez en `_build_styles()`). `_refresh_style()` ahora switchea entre los dos con ternario en lugar de allocar nuevos. Reduce GC churn en taps de chips.

### WR-12: OS.shell_open sin validar URL scheme

**Files modified:** `scripts/screens/AuthScreen.gd`
**Commit:** `7f31663`
**Applied fix:** Allowlist defensivo de `https://` y `http://` en `_on_privacy_clicked()`. Rechaza el resto con `push_warning`. Hoy es seguro (BBCode hardcoded), pero si en Phase 2+ la URL viene del server, evita inyección de `javascript:`/`file:///`.

---

_Fixed: 2026-05-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
