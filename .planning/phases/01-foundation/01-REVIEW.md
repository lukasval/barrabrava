---
phase: 01-foundation
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 50
files_reviewed_list:
  - .github/workflows/build-android-debug.yml
  - .github/workflows/deploy-web.yml
  - .gitignore
  - Dockerfile.nakama
  - README.md
  - assets/theme/CardPanel.tres
  - assets/theme/LineEditFocused.tres
  - assets/theme/LineEditNormal.tres
  - assets/theme/PrimaryButton.tres
  - assets/theme/Theme.tres
  - export_presets.cfg
  - fly.toml
  - nakama/.gitignore
  - nakama/build.mjs
  - nakama/data/clubs.json
  - nakama/local.yml
  - nakama/package.json
  - nakama/smoke-test.sh
  - nakama/src/main.ts
  - nakama/src/rpc/confirm_password_reset.ts
  - nakama/src/rpc/create_pibe.ts
  - nakama/src/rpc/delete_account.ts
  - nakama/src/rpc/get_clubs.ts
  - nakama/src/rpc/request_password_reset.ts
  - nakama/src/util/email.ts
  - nakama/src/util/validation.ts
  - nakama/tsconfig.json
  - project.godot
  - scenes/AuthScreen.tscn
  - scenes/ClubPickerScreen.tscn
  - scenes/ForgotPasswordScreen.tscn
  - scenes/HomeScreen.tscn
  - scenes/PibeCreatorScreen.tscn
  - scenes/PlaceholderMain.tscn
  - scenes/SplashScreen.tscn
  - scenes/TutorialScreen.tscn
  - scenes/components/ChipButton.tscn
  - scenes/components/ClubCard.tscn
  - scenes/components/NavButton.tscn
  - scripts/PlaceholderMain.gd
  - scripts/autoloads/AppConfig.gd
  - scripts/autoloads/AppTheme.gd
  - scripts/autoloads/AuthManager.gd
  - scripts/autoloads/FlowRouter.gd
  - scripts/autoloads/NakamaService.gd
  - scripts/autoloads/PlayerStore.gd
  - scripts/components/ChipButton.gd
  - scripts/components/ClubCard.gd
  - scripts/components/NavButton.gd
  - scripts/screens/AuthScreen.gd
  - scripts/screens/ClubPickerScreen.gd
  - scripts/screens/ForgotPasswordScreen.gd
  - scripts/screens/HomeScreen.gd
  - scripts/screens/PibeCreatorScreen.gd
  - scripts/screens/SplashScreen.gd
  - scripts/screens/TutorialScreen.gd
  - scripts/utils/SafeArea.gd
  - scripts/utils/Tween.gd
  - web/index.html
  - web/privacy/en.html
  - web/privacy/index.html
  - web/reset-password/index.html
  - web/reset-password/script.js
  - web/reset-password/style.css
  - web/styles/base.css
  - web/terms/index.html
findings:
  critical: 4
  warning: 12
  info: 9
  total: 25
status: findings_present
---

# Fase 1: Reporte de Code Review

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 50 (de 64 listados — los `.tres` y `.tscn` se inspeccionaron pero no se tratan como código fuente con lógica)
**Status:** findings_present

## Resumen

Phase 1 entrega un foundation funcional: 5 RPCs server-authoritative con seed idempotente, flujo de auth + club picker + pibe creator en Godot, páginas legales bilingües, y un reset-password rediseñado para no exponer el server_key. La calidad general es alta — hay comentarios contextuales, mitigaciones explícitas de threats, y separación clara client/server.

**Sin embargo, hay un bug funcional crítico (CR-01) que rompe el flujo de "user vuelve a entrar al juego"**: `PlayerStore.load_from_server()` lee el pibe usando `key=pibe_id`, pero `create_pibe.ts` lo escribe siempre con `key='main'`. El pibe NUNCA va a aparecer después de un re-login — el nombre del pibe en HomeScreen siempre va a ser el placeholder "Pibe", y `has_profile()` siempre devuelve `false` porque `pibe_id` queda vacío. Esto se valida en runtime al re-loguear, no en el smoke-test (que crea+borra en la misma sesión sin leer back).

Otros bugs reales: el contrato de paginación entre `get_clubs` RPC (devuelve `total`) y `ClubPickerScreen._load_clubs` (espera `has_more`) está roto — funciona "por accidente" porque page_size default = 200 alcanza para los ~133 clubs, pero cualquier cambio rompe (CR-02). El smoke-test step 5 grep parsea el payload mal porque Nakama envuelve la respuesta RPC en `{"payload": "..."}` y el script busca el JSON interno sin desempaquetar — el known issue está en CR-04. Y el SplashScreen depende de un signal que `_try_restore_session` no emite en early-return → boot de 3 segundos garantizado cuando no hay sesión guardada (CR-03).

A nivel security: el flujo de reset es elegante pero registra **cualquier device-id derivado del reset token** y deja accounts huérfanos en la DB con cada submit del form — esto es un vector de DoS/account-spam (WR-01). El device-auth público con `create=true` también significa que cualquiera puede crear accounts sin verificación a tasa limitada solo por `registration_per_ip_per_min: 10` (WR-02). El validator de nombres acepta caracteres unicode que pueden suplantar (homoglyph "аdmin" con А cirílica no está en `ALLOWED_RE`, pero "𝓪𝓭𝓶𝓲𝓷" con math-alpha sí podría pasar la regex porque está fuera del rango À-ž pero la regex es estricta — confirmado seguro). Hay un substring-only deny-list que mata nombres legítimos como "Pelotuda" → "Pelo**tuda**" — falsos positivos (WR-03).

A nivel de architecture/code quality: la coupling cliente↔servidor sobre nombres de keys de Storage es frágil y debería centralizarse (WR-08). El `DENY_WORDS` hace substring match, lo que mata nombres legítimos como "Boludo" en "Saa**boludo**ria" — pero más urgentemente la lista actual contiene "orto" que va a rechazar "Orto**doxo**", "p**orto**ño", "ap**orto**" y cualquier nombre que contenga la subcadena (WR-03). El validator también NO normaliza Unicode (NFC) antes de chequear longitud, así que "ñ" descompuesto entra como 2 chars y consume cuota (IN-04). El `script_export_mode=2` en export_presets.cfg significa que los `.gd` se exportan como bytecode binario obfuscado — bien — pero `encrypt_pck=false` significa que un usuario con APKEditor puede leer todos los assets (incluyendo `clubs.json` si se incluyera) — aceptable para Phase 1 pero documentar (IN-05).

---

## Critical Issues

### CR-01: PlayerStore lee el pibe con la key incorrecta — re-login nunca carga datos del pibe

**File:** `scripts/autoloads/PlayerStore.gd:44-46`
**Issue:**

`create_pibe.ts` línea 96-102 escribe el pibe en Storage con `collection='pibes', key='main'` (un slot fijo por usuario porque Phase 1 = 1 pibe por cuenta). Pero `PlayerStore.load_from_server()` línea 44 lee con `collection='pibes', key=pibe_id` (el UUID generado por `nk.uuidv4()`).

Resultado:
1. Login fresh sin perfil → ClubPicker → PibeCreator → `create_pibe` RPC devuelve el pibe inline → `PlayerStore.pibe_name` se setea desde la response — funciona en el mismo flow.
2. Logout / kill-app / re-open → SplashScreen restaura sesión → `PlayerStore.load_from_server()` → lee `players/profile` OK (key="profile"), saca `pibe_id` correctamente, pero después intenta `pibes/<uuid>` que **no existe** (porque está bajo `pibes/main`). `pibe_resp.objects.size() == 0`, `pibe_name` queda "" → HomeScreen muestra "Pibe" en vez del nombre real → `has_profile()` sigue dando false en el primer if porque solo chequea `pibe_id != ""` (que sí está seteado del profile read), pero la UX queda rota.

Esto NO lo detecta el smoke-test porque crea+borra en la misma sesión y nunca hace un read-back desde un fresh login.

**Fix:**

Decidir una convención y aplicarla en ambos lados. Recomendación: usar `key='main'` consistentemente (el `pibe_id` UUID se conserva como atributo dentro del valor para identificación futura cuando se permita >1 pibe). Cambiar `PlayerStore.gd:45`:

```gdscript
var pibe_resp = await NakamaService.client.read_storage_objects_async(session, [
    {"collection": "pibes", "key": "main", "user_id": session.user_id},
])
```

Y borrar el sucio acoplamiento de "lee pibe_id del profile y úsalo como key". El profile sigue guardando `pibe_id` (el UUID interno) por compatibilidad futura, pero la lookup va por slot fijo.

Alternativa (menos preferida): cambiar `create_pibe.ts` para escribir bajo `key=pibeId` y agregar un segundo write a `pibes/_index` que apunte al pibe activo. Más writes, más complejidad — no vale la pena en Phase 1.

---

### CR-02: ClubPickerScreen paginación bug — depende de `has_more` que el RPC no devuelve

**File:** `scripts/screens/ClubPickerScreen.gd:68-77`
**Issue:**

```gdscript
var page = 2
while data.get("has_more", false) and page < 10:
    ...
```

El RPC `get_clubs` (`nakama/src/rpc/get_clubs.ts:96`) devuelve `{ clubs, total, page, page_size }` — **nunca un campo `has_more`**. Entonces `data.get("has_more", false)` siempre devuelve `false` y el `while` no ejecuta nunca → solo se carga la primera página.

Actualmente funciona "por accidente" porque `_load_clubs` envía `{division: "Todos", page: 1}` sin `page_size`, y el server defaultea a `DEFAULT_PAGE_SIZE=200`, lo cual cubre los ~133 clubs en una sola página. Pero:
- Si alguien sube clubs a 200+ (e.g. agrega Federal A regiones), bug latente se manifiesta.
- Si alguien cambia `DEFAULT_PAGE_SIZE` para reducir payload, se rompe silently.
- El "paginated, follows has_more=true up to 10 pages" del comment es falso.

**Fix:**

Opción A (recomendada — usar `total` que sí existe):

```gdscript
var page_size := 100
var payload = JSON.stringify({"division": "Todos", "page": 1, "page_size": page_size})
var resp = await NakamaService.client.rpc_async(session, "get_clubs", payload)
if resp.is_exception():
    push_error("[ClubPicker] get_clubs failed: %s" % resp.get_exception().message)
    return
var data = JSON.parse_string(resp.payload)
_all_clubs = data.get("clubs", [])
var total: int = int(data.get("total", _all_clubs.size()))
var page := 2
while _all_clubs.size() < total and page < 10:
    var p = JSON.stringify({"division": "Todos", "page": page, "page_size": page_size})
    var r = await NakamaService.client.rpc_async(session, "get_clubs", p)
    if r.is_exception():
        break
    data = JSON.parse_string(r.payload)
    _all_clubs.append_array(data.get("clubs", []))
    page += 1
```

Opción B (más simple — agregar `has_more` al server). Editar `get_clubs.ts:96`:

```typescript
const hasMore = start + pageSize < total;
return JSON.stringify({ clubs: slice, total, page, page_size: pageSize, has_more: hasMore });
```

Pero entonces el cliente sigue confiando en un contrato que se puede romper. Opción A es defense-in-depth.

---

### CR-03: SplashScreen siempre espera el timeout de 3s cuando no hay sesión guardada

**File:** `scripts/autoloads/AuthManager.gd:68-91` + `scripts/screens/SplashScreen.gd:37-43`
**Issue:**

`SplashScreen._wait_and_route` espera hasta 3 segundos a que `_restore_attempted` sea `true` o `AuthManager.session != null`. `_restore_attempted` solo se setea cuando `AuthManager` emite `session_ready` o `session_cleared`.

Pero `AuthManager._try_restore_session` (línea 68) tiene tres early-return paths que **no emiten ningún signal**:
1. Línea 71 — `cfg.load(SESSION_FILE) != OK` (no hay archivo de sesión, primer launch o post-logout)
2. Línea 76 — `token == ""` (config corrupto)
3. Línea 81 — `refresh == ""` y token expirado
4. Línea 84 — refresh falló

En esos casos, ningún signal viaja → `_restore_attempted` queda en `false` → splash espera la totalidad de los 3 segundos antes de routear a AuthScreen. Para un primer launch, el tiempo a primer pixel interactivo es: `max(800ms, 3000ms) = 3000ms`. Esperable: ~800ms.

**Fix:**

Hacer que `_try_restore_session` emita siempre un signal terminal:

```gdscript
func _try_restore_session() -> void:
    var cfg = ConfigFile.new()
    if cfg.load(SESSION_FILE) != OK:
        print("[AuthManager] no saved session")
        session_cleared.emit()  # signal terminal
        return
    var token = cfg.get_value("auth", "token", "")
    var refresh = cfg.get_value("auth", "refresh_token", "")
    if token == "":
        session_cleared.emit()
        return
    var restored = NakamaService.client.restore_session(token)
    if restored.expired:
        if refresh == "":
            print("[AuthManager] session expired, no refresh token")
            session_cleared.emit()
            return
        var refreshed = await NakamaService.client.session_refresh_async(restored, refresh)
        if refreshed.is_exception():
            print("[AuthManager] refresh failed: %s" % refreshed.get_exception().message)
            session_cleared.emit()
            return
        session = refreshed
    else:
        session = restored
    _save_session()
    session_ready.emit(session)
```

Alternativa: agregar un signal `restore_complete` que se emite siempre, y que SplashScreen lo escuche en lugar de los dos signals separados.

---

### CR-04: Smoke-test step 4 (count de clubs) — extrae conteo del JSON envuelto, no del payload real

**File:** `nakama/smoke-test.sh:86-93` (también afecta step 5)
**Issue:**

Esto está documentado como known-issue en `project_context` pero queda registrado para tracking. Nakama envuelve respuestas RPC en `{"payload": "<json-string-escaped>"}`. El script hace:

```bash
COUNT=$(echo "$GET_ALL_RESP" | grep -o "lunfardo_name" | wc -l)
```

Como el payload viene escapado (`\"lunfardo_name\"`), `grep -o "lunfardo_name"` igual matchea sin las quotes — pero esto es por accidente de que el regex no incluye comillas. Si Nakama cambia el wire format (e.g. usa `?unwrap` y devuelve payload pelado), el conteo va a duplicarse o quedar en 0.

El step 5 + 6 + 7 + 8 tienen el mismo problema: buscan `'"ok":true'` literal pero el `:` está escapado en el wire (`\"ok\":true` — coincide, pero solo porque Nakama escapa quotes y no colons). Frágil.

**Fix:**

Usar `?unwrap` query param en TODAS las calls RPC (la página de reset ya lo hace, ver `web/reset-password/script.js:75`), o desempaquetar con jq:

```bash
GET_ALL_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/get_clubs?unwrap" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"page_size":500}')

if [ -n "$JQ" ]; then
  COUNT=$(echo "$GET_ALL_RESP" | jq '.clubs | length')
else
  COUNT=$(echo "$GET_ALL_RESP" | grep -o "lunfardo_name" | wc -l)
fi
```

Bonus: con `?unwrap` el payload del POST también deja de necesitar el double-stringify ridículo (`'"{...}"'`) — pasa a ser un body JSON plano `'{...}'`.

---

## Warnings

### WR-01: Reset-password page crea accounts huérfanos por cada submit — vector de DoS / DB bloat

**File:** `web/reset-password/script.js:46-65`
**Issue:**

```javascript
async function fetchBearerToken() {
  var deviceId = "reset-helper-" + token + "-" + Date.now();
  var resp = await fetch(
    "https://" + NAKAMA_HOST + "/v2/account/authenticate/device?create=true",
    ...
```

Cada vez que un usuario hace submit del form (válido o no, exitoso o no), se crea una cuenta Nakama nueva en la DB (porque `create=true` + un `deviceId` único con `Date.now()` garantiza no-collision). Un atacante puede hacer un bot que pegue al `/reset?token=xxx` 1M veces y crear 1M de cuentas huérfanas — ataque DoS a la DB.

Mitigación parcial: `local.yml` setea `registration_per_ip_per_min: 10` (10 cuentas/min/IP). Pero un atacante distribuido o con IP rotation lo evade.

**Fix:**

Opción A (preferida): reutilizar el mismo deviceId derivado del token, sin `Date.now()`:
```javascript
var deviceId = "reset-helper-" + token;
```
Así un mismo token solo crea UNA cuenta. Igualmente queda en la DB pero ya hay limit natural = N tokens emitidos.

Opción B: cambiar el RPC `confirm_password_reset` para aceptar llamadas no autenticadas (server-key auth via Basic), elimina la necesidad del device-auth dance. El client manda `Authorization: Basic base64(server_key:)` directamente. El server_key seguiría sin estar en JS público porque la página confirmaría el token con el server vía un endpoint que recibe `{token, new_password}` y el server hace todo. Pero eso re-introduce el server_key en JS — contradice CHK-06.

Opción C: en lugar de device-auth, exponer un RPC público `confirm_password_reset_unauthenticated` que el server registra con `registerRpc` y se llama vía servidor con server-key auth de un proxy ligero. Más complejo.

Recomendación: **Opción A** ahora (one-liner), tracking en Phase 2 para evaluar B/C cuando esto deje de ser stub.

Plus: al `nk.accountDeleteId` no llamar nunca a estas cuentas reset-helper, quedan acumulando. Agregar un job de housekeeping en Phase 2 que purgue cuentas `device-id` que empiezan con `"reset-helper-"` cada X días.

---

### WR-02: device-auth público sin captcha permite account spam

**File:** Cualquier llamada a `/v2/account/authenticate/device?create=true`
**Issue:**

Nakama por default permite device-auth público sin captcha. El rate limit `registration_per_ip_per_min: 10` es la única defensa. Para un launch público (Phase 7), esto es insuficiente — atacantes pueden generar usuarios masivamente para spammear leaderboards / drenar recursos AI barras (cuando existan en Phase 2+).

**Fix:**

No es bloqueante para Phase 1 (no hay usuarios reales aún). Trackear para Phase 6/7:
- Considerar registrar `before_authenticate_device` hook que requiera un captcha token (Cloudflare Turnstile / hCaptcha free tier).
- O deshabilitar `create=true` en device-auth público y forzar todo el onboarding por email (que ya estará gated por verificación de email cuando Resend esté wired).

Documentar en `INFRA-NOTES.md` como follow-up.

---

### WR-03: Deny-list de profanity hace substring match — falsos positivos sobre nombres legítimos

**File:** `nakama/src/util/validation.ts:82-87`
**Issue:**

```typescript
const lower = name.toLowerCase();
for (let i = 0; i < DENY_WORDS.length; i++) {
  if (lower.indexOf(DENY_WORDS[i]) !== -1) {
    return { ok: false, error: 'name_contains_forbidden_word' };
  }
}
```

Substring match sin word-boundary. Casos que rompen:
- `"orto"` en deny list → rechaza `"Ortodoxo"`, `"Portoño"`, `"Aporto"`, `"Tortoise"`, cualquier nombre con la subcadena. "Norto" (común en regiones del norte) también.
- `"trolo"` → `"Pa**trolo**gía"`, `"Ki**trolo**vskaya"` (improbable pero posible).
- `"hdp"` → `"Hdp**lus**"`, raro pero un user creativo podría picarse.
- `"sistema"` / `"system"` → un usuario que quiera llamarse `"Sistemo"` queda OK pero `"Sistematico"` cae.
- `"root"` → cualquier nombre con `"root"` (`"Rootkit"`, `"Bootroot"`).

Más importante: hay falsos negativos triviales — `"P u t a"` (con espacios), `"pUtA1"`, separadores, l33tspeak (`"pvta"`, `"p u t a"`, `"p.uta"`).

**Fix:**

Para Phase 1, dos cambios de bajo esfuerzo:

1. Cambiar a word-boundary match para palabras que como subcadena causan falsos positivos. Usar regex con `\b`:

```typescript
const denyRegexes = DENY_WORDS.map((w) => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
for (let i = 0; i < denyRegexes.length; i++) {
  if (denyRegexes[i].test(name)) {
    return { ok: false, error: 'name_contains_forbidden_word' };
  }
}
```

2. Sacar `"orto"` y `"hdp"` de la lista — los falsos positivos superan el valor. Reemplazar por matchers explícitos (`/^hdp$/i`, `/\borto\b/i`) si realmente se quieren.

Para Phase 5 (Mundo Social) hay que reemplazar todo esto por una solución más robusta (e.g. Levenshtein contra una lista canonical + un servicio externo). Documentar.

---

### WR-04: `AuthManager.logout()` deja side effects desordenados en mobile/web

**File:** `scripts/autoloads/AuthManager.gd:38-44`
**Issue:**

```gdscript
func logout() -> void:
    session = null
    var fa = FileAccess.open(SESSION_FILE, FileAccess.WRITE)
    if fa:
        fa.close()
    DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION_FILE))
    session_cleared.emit()
```

Problemas:
1. `FileAccess.open(..., WRITE)` trunca el archivo a 0 bytes — innecesario porque ya vamos a borrarlo.
2. `DirAccess.remove_absolute(ProjectSettings.globalize_path(...))` — `globalize_path` para `user://` funciona en desktop pero el path resultante no siempre es válido en web (HTML5 export usa IndexedDB virtual FS). En mobile suele andar pero es frágil.
3. La forma idiomática en Godot 4 es `DirAccess.remove_absolute(SESSION_FILE)` o `DirAccess.remove_absolute("user://session.cfg")` — el path `user://` es resolved por DirAccess directamente, sin globalizar.

**Fix:**

```gdscript
func logout() -> void:
    session = null
    if FileAccess.file_exists(SESSION_FILE):
        DirAccess.remove_absolute(SESSION_FILE)
    session_cleared.emit()
```

Saca el truncate redundante, evita la globalización, y solo intenta borrar si existe (silencia el warning en consola de "file not found" en primer logout).

---

### WR-05: HomeScreen `_on_delete` no muestra confirmación si el RPC falla — usuario queda en limbo

**File:** `scripts/screens/HomeScreen.gd:32-43`
**Issue:**

```gdscript
func _perform_delete() -> void:
    var session = AuthManager.session
    var resp = await NakamaService.client.rpc_async(session, "delete_account", "")
    if resp.is_exception():
        push_error("[HomeScreen] delete_account failed: %s" % resp.get_exception().message)
        return
    ...
```

Si `delete_account` falla (network, server error), el usuario ve **nada**: el `push_error` solo va a la consola de debug. La UI no muestra error label, no re-habilita el botón (porque nunca lo deshabilitó), no toast — el botón parece haber sido tappeado sin efecto. Usuario re-tappea N veces y eventualmente la 2da llamada exitosa borra todo, pero las que fallaron antes pueden haber dejado state parcial.

Adicionalmente: no se deshabilita el botón mientras está in-flight, así que double-tap dispara dos RPCs concurrentes. Si la 1ra borra y la 2da llega después con session ya invalidada → error sin feedback.

**Fix:**

```gdscript
func _perform_delete() -> void:
    delete_button.disabled = true
    var session = AuthManager.session
    var resp = await NakamaService.client.rpc_async(session, "delete_account", "")
    if resp.is_exception():
        delete_button.disabled = false
        push_error("[HomeScreen] delete_account failed: %s" % resp.get_exception().message)
        # TODO: agregar Label de error visible al usuario
        var err_dlg = AcceptDialog.new()
        err_dlg.dialog_text = "No pudimos borrar la cuenta. Probá de nuevo en un rato."
        add_child(err_dlg)
        err_dlg.popup_centered()
        return
    AuthManager.logout()
    PlayerStore.clear()
    FlowRouter.go_splash()
```

---

### WR-06: ForgotPasswordScreen botón queda permanentemente deshabilitado tras submit (incluso si falla)

**File:** `scripts/screens/ForgotPasswordScreen.gd:25-43`
**Issue:**

```gdscript
func _on_submit() -> void:
    ...
    submit_button.disabled = true
    status_label.visible = false
    var _res = await AuthManager.request_password_reset(email)
    submit_button.disabled = true  # <-- queda true para siempre
    ...
    email_input.editable = false
```

El botón se setea a `disabled=true` antes Y después de la call (línea 32 y 35). El email_input también se desactiva. Si el RPC falla por network, el usuario ve un mensaje de "éxito" (anti-enumeration uniforme) y no puede reintentar — pero el reset NUNCA salió. El usuario está pinchado y tiene que cerrar la app.

Este es el comportamiento intencional para anti-enumeration (no dar feedback distinto entre éxito y falla), pero deja al usuario sin escape en caso de network issue real.

**Fix:**

Mantener la uniformidad de mensaje pero permitir re-submit después de un timeout (e.g. 30s) o desde un botón secundario "Reintentar":

```gdscript
func _on_submit() -> void:
    var email := email_input.text.strip_edges()
    if email.length() == 0 or email.find("@") == -1:
        status_label.text = "Poné un email válido, chabón."
        status_label.add_theme_color_override("font_color", AppTheme.DESTRUCTIVE)
        status_label.visible = true
        return
    submit_button.disabled = true
    status_label.visible = false
    var _res = await AuthManager.request_password_reset(email)
    # Anti-enumeration: uniform success message regardless of server result.
    status_label.text = "Si ese email está en la base, te llega un link en unos minutos. Revisá spam también."
    status_label.add_theme_color_override("font_color", AppTheme.TEXT_SECONDARY)
    status_label.visible = true
    # Re-enable after 30s to allow retry in case of real network failure.
    await get_tree().create_timer(30.0).timeout
    submit_button.disabled = false
    submit_button.text = "Enviar de nuevo"
```

(Mantener `email_input.editable = false` o no es decisión de UX — yo lo dejaría editable también.)

---

### WR-07: `ClubPickerScreen._render_clubs()` instancia 133 ClubCards por filter change — performance trap

**File:** `scripts/screens/ClubPickerScreen.gd:79-103`
**Issue:**

Cada cambio de filtro de división o cada keystroke en search (debounced 200ms) llama a `_render_clubs`, que hace `queue_free` de todos los cards anteriores y `instantiate()` de los nuevos. Con 133 clubs filtrados a "Todos" + sin search, eso es 133 instancias de PanelContainer + HBoxContainer + ColorRect + VBoxContainer + 2 Labels = ~6 nodos × 133 = ~800 nodos creados/destruidos. En cada keystroke.

En mobile esto va a sentir lag visible (200ms+ frame hitches). El user pidió específicamente "patterns que van a explotar a escala".

**Fix (Phase 1 — bajo esfuerzo):**

Hacer pool de cards reutilizables: en lugar de free + instantiate, ocultar/mostrar y reasignar `set_club(club)`:

```gdscript
var _card_pool: Array = []

func _render_clubs() -> void:
    _selected_card = null
    _selected_club_id = ""
    cta.disabled = true
    var q := search.text.strip_edges().to_lower()
    var filtered: Array = []
    for club in _all_clubs:
        if _current_division != "Todos" and club.get("division", "") != _current_division:
            continue
        if q.length() > 0:
            var name_str = str(club.get("lunfardo_name", "")).to_lower()
            var barrio = str(club.get("barrio_hq", "")).to_lower()
            if not (q in name_str or q in barrio):
                continue
        filtered.append(club)
    empty_state.visible = filtered.size() == 0
    scroll.visible = filtered.size() > 0
    # Grow pool to match
    while _card_pool.size() < filtered.size():
        var card = ClubCardScene.instantiate()
        list_box.add_child(card)
        card.tapped.connect(_on_card_tapped.bind(card))
        _card_pool.append(card)
    # Assign data + visibility
    for i in range(_card_pool.size()):
        var card = _card_pool[i]
        if i < filtered.size():
            card.set_club(filtered[i])
            card.set_meta("club_data", filtered[i])
            card.visible = true
            card.set_selected(false)
        else:
            card.visible = false

func _on_card_tapped(card: Node) -> void:
    var club = card.get_meta("club_data", {})
    if _selected_card != null and is_instance_valid(_selected_card):
        _selected_card.set_selected(false)
    _selected_card = card
    card.set_selected(true)
    _selected_club_id = str(club.get("id", ""))
    cta.disabled = false
```

**Fix (Phase 2 — proper):**

Migrar a un `ItemList` o un VirtualScrollContainer custom que solo renderice los cards visibles en viewport. Con 133 entries esto es overkill pero hace falta para Phase 5 (Mundo Social) cuando pueda haber listados grandes.

---

### WR-08: Coupling cliente↔servidor por nombres de Storage keys mágicos — sin centralizar

**File:** `nakama/src/rpc/create_pibe.ts`, `nakama/src/rpc/delete_account.ts`, `scripts/autoloads/PlayerStore.gd`
**Issue:**

Hay strings literales `'pibes'`, `'players'`, `'profile'`, `'main'`, `'clubs'`, `'reset_tokens'`, `'meta'`, `'00000000-0000-0000-0000-000000000000'` repartidos en al menos 4 archivos en ambos lados de la wire. Cualquier divergencia (como CR-01) es silenciosa.

**Fix:**

Server-side, crear `nakama/src/storage_keys.ts`:

```typescript
export const COL_PIBES = 'pibes';
export const COL_PLAYERS = 'players';
export const COL_CLUBS = 'clubs';
export const COL_RESET_TOKENS = 'reset_tokens';
export const COL_META = 'meta';

export const KEY_PIBE_MAIN = 'main';
export const KEY_PLAYER_PROFILE = 'profile';

export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
```

Y client-side `scripts/autoloads/StorageKeys.gd` (autoload):

```gdscript
extends Node
const COL_PIBES := "pibes"
const COL_PLAYERS := "players"
const COL_CLUBS := "clubs"
const KEY_PIBE_MAIN := "main"
const KEY_PLAYER_PROFILE := "profile"
const SYSTEM_USER_ID := "00000000-0000-0000-0000-000000000000"
```

No es Hard requirement de Phase 1 pero hace que Phase 2 no repita CR-01 con más colecciones.

---

### WR-09: PlayerStore no marca campos como typed correctamente — `pibe_id` puede contener un Variant Dictionary

**File:** `scripts/autoloads/PlayerStore.gd:41-49`
**Issue:**

```gdscript
var profile = JSON.parse_string(resp.objects[0].value)
pibe_id = profile.get("pibe_id", "")
club_id = profile.get("club_id", "")
```

`JSON.parse_string` devuelve `Variant`. Si por algún motivo (test bug, fixture roto) el server devuelve `pibe_id` como número o null, `pibe_id = profile.get(...)` asigna ese Variant a una variable declarada como `var pibe_id: String = ""`. Godot 4 va a hacer un cast implícito que en algunos casos lanza error en runtime y en otros silenciosamente convierte.

Más fundamentalmente: si `profile` resulta ser `null` (JSON.parse de un value vacío), `profile.get(...)` crashea con "Invalid call to method 'get' on a base of type 'Nil'".

**Fix:**

```gdscript
var profile_raw = JSON.parse_string(resp.objects[0].value)
if typeof(profile_raw) != TYPE_DICTIONARY:
    return {"ok": false, "error": "profile_corrupt"}
var profile: Dictionary = profile_raw
pibe_id = str(profile.get("pibe_id", ""))
club_id = str(profile.get("club_id", ""))
```

Idem para `pibe_resp` (línea 48) y `club_resp` (línea 53). El `str(...)` wrap garantiza string type.

---

### WR-10: AppTheme carga el theme con `load()` síncrono en main thread — primer frame hitch en boot

**File:** `scripts/autoloads/AppTheme.gd:45-53`
**Issue:**

```gdscript
if ResourceLoader.exists("res://assets/theme/Theme.tres"):
    var t := load("res://assets/theme/Theme.tres") as Theme
    if t:
        get_tree().root.theme = t
```

`load()` es síncrono. El Theme.tres carga 2 FontFile resources (Nunito-Regular + Nunito-Bold) que son binarios de varios MB cada uno. En mobile esto bloquea el main thread durante el primer frame del autoload — entre 50-300ms de freeze.

El comentario dice "avoids boot-time chicken-and-egg with font imports in CI" — el motivo del lazy load es válido (originalmente el crash fix), pero el `load()` síncrono lo agrava.

**Fix:**

Usar `ResourceLoader.load_threaded_request` + check en `_process`:

```gdscript
func _ready() -> void:
    var rect = DisplayServer.get_display_safe_area()
    var screen_size = DisplayServer.screen_get_size()
    safe_area_top = max(0, rect.position.y)
    safe_area_bottom = max(34, screen_size.y - rect.position.y - rect.size.y)
    print("[AppTheme] safe_area top=%d bottom=%d" % [safe_area_top, safe_area_bottom])
    if ResourceLoader.exists("res://assets/theme/Theme.tres"):
        ResourceLoader.load_threaded_request("res://assets/theme/Theme.tres")
        set_process(true)

func _process(_dt: float) -> void:
    var status = ResourceLoader.load_threaded_get_status("res://assets/theme/Theme.tres")
    if status == ResourceLoader.THREAD_LOAD_LOADED:
        var t := ResourceLoader.load_threaded_get("res://assets/theme/Theme.tres") as Theme
        if t:
            get_tree().root.theme = t
            print("[AppTheme] global theme applied (threaded)")
        set_process(false)
    elif status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
        push_warning("[AppTheme] Theme.tres failed to load threaded")
        set_process(false)
```

Funciona porque las screens ya tienen fallback styles (CardPanel.tres, LineEditFocused.tres etc. son aplicados via `theme_override_stylebox`) y los Labels arrancan con default font.

---

### WR-11: `ChipButton._refresh_style()` crea un StyleBoxFlat nuevo en cada llamada — basura para GC + leak de overrides

**File:** `scripts/components/ChipButton.gd:31-58`
**Issue:**

Cada vez que cambia `is_selected`, se crea un nuevo `StyleBoxFlat`, se llama `add_theme_stylebox_override("panel", sb)`. El override anterior se reemplaza, lo cual está OK funcionalmente, pero crea 2 instancias x N chips por filter change. Con 6 chips (DIVISIONS) y un tap, 12 StyleBoxFlat instances. Para Phase 1 no es bloqueante, pero el patrón se va a replicar en Phase 2+.

**Fix (opcional, low priority):**

Tener dos `StyleBoxFlat` const-en-script (uno selected, uno unselected) y switchear:

```gdscript
var _style_selected: StyleBoxFlat
var _style_unselected: StyleBoxFlat

func _build_styles() -> void:
    _style_selected = StyleBoxFlat.new()
    _style_selected.bg_color = AppTheme.ACCENT
    # ...
    _style_unselected = StyleBoxFlat.new()
    _style_unselected.bg_color = AppTheme.SECONDARY
    # ...

func _refresh_style() -> void:
    if _style_selected == null:
        _build_styles()
    add_theme_stylebox_override("panel", _style_selected if is_selected else _style_unselected)
    if _label:
        _label.add_theme_color_override("font_color", AppTheme.TEXT_PRIMARY if is_selected else AppTheme.TEXT_SECONDARY)
```

---

### WR-12: `OS.shell_open(str(meta))` sin validar el meta — XSS-by-link en futuro

**File:** `scripts/screens/AuthScreen.gd:88-89`
**Issue:**

```gdscript
func _on_privacy_clicked(meta: Variant) -> void:
    OS.shell_open(str(meta))
```

Hoy `meta` viene de un BBCode literal hardcoded en `privacy_link.text = "...[url=%s]...[url=%s]..."`, así que es seguro. Pero si en el futuro la URL viene del server (e.g. para A/B testing del privacy URL), un attacker podría inyectar `javascript:` o `file:///` URLs.

Generalmente `OS.shell_open` solo abre apps registradas para esquemas conocidos pero `javascript:` en algunos browsers es honored.

**Fix (defensive):**

```gdscript
func _on_privacy_clicked(meta: Variant) -> void:
    var url = str(meta)
    if not (url.begins_with("https://") or url.begins_with("http://")):
        push_warning("[AuthScreen] rejected suspicious URL: %s" % url)
        return
    OS.shell_open(url)
```

Aplica también para `_on_forgot_clicked` (línea 91) — aunque ahí el meta es "forgot" (no es URL) y va a FlowRouter, no OS.shell_open. Acción separada, no issue.

---

## Info

### IN-01: Comentario stale en `AppConfig.gd` referencia "Plan 04/Plan 05" sin tener el resto del archivo

**File:** `scripts/autoloads/AppConfig.gd:6-11`

El comentario dice "This is a Plan 04 STUB. Plan 05 (Task 2) extends this file with full constants and asserts." Pero los asserts ya están en el archivo (líneas 33-36). El comment quedó obsoleto al merge de Plan 05. Quitar las primeras 11 líneas o reescribir como historial completo.

**Fix:**
```gdscript
extends Node

# Public config + feature flags. URLs are public (privacy policy, reset
# password page). Feature flags enforce Phase 1 invariants (no analytics, no
# push, no GPS yet — PRV-05 hardens this with assert()s and AAIP
# documentation).
```

---

### IN-02: `SYSTEM_USER_ID` re-declarado en cada RPC file con `void SYSTEM_USER_ID` truco en delete_account.ts

**File:** `nakama/src/rpc/delete_account.ts:15-16`

```typescript
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
void SYSTEM_USER_ID;
```

El `void SYSTEM_USER_ID` es un hack para silenciar `noUnusedLocals` de TS. Y el constante está re-declarada en `main.ts:20`, `create_pibe.ts:16`, `get_clubs.ts:12`. Si cambiamos el value (impossible — es el nil UUID de Postgres) no se actualiza en todos lados.

**Fix:** Centralizar en `nakama/src/storage_keys.ts` (ver WR-08). Sacar la re-declaración en delete_account.ts ya que no se usa.

---

### IN-03: `PlaceholderMain.gd` y `PlaceholderMain.tscn` referenciados en ningún lado — dead code

**File:** `scripts/PlaceholderMain.gd`, `scenes/PlaceholderMain.tscn`

`project.godot` línea 16 setea `run/main_scene="res://scenes/SplashScreen.tscn"` — PlaceholderMain.tscn no es la escena principal. No es referenciado por ningún otro script o scene. Si era el placeholder de Plan 02 para validar autoloads, ya cumplió su rol.

**Fix:** Borrar `scenes/PlaceholderMain.tscn` y `scripts/PlaceholderMain.gd`. Si se quiere mantener como smoke-test de autoloads para CI futuro, agregar comment explícito y moverlo a `tests/` o `dev_scenes/`.

---

### IN-04: `validatePibeName` no normaliza Unicode antes de medir length

**File:** `nakama/src/util/validation.ts:62-89`

```typescript
const name = raw.trim();
if (name.length < MIN_LENGTH) { ... }
if (name.length > MAX_LENGTH) { ... }
```

`"José"` en NFC normalization es 4 chars, en NFD (decomposed: `J + o + s + e + combining-acute`) es 5 chars. Un usuario con teclado Mac (que defaultea a NFD a veces) puede llegar a quedar capado en el límite mientras otro con teclado Windows no.

**Fix:**

```typescript
const name = raw.trim().normalize('NFC');
```

Si Goja no soporta `String.prototype.normalize` (chequear), usar un polyfill mínimo o documentar limitación.

---

### IN-05: `export_presets.cfg` — `encrypt_pck=false` permite que cualquiera saque assets del APK

**File:** `export_presets.cfg:15-18`

```
encrypt_pck=false
encrypt_directory=false
script_export_mode=2
```

`script_export_mode=2` (binary tokens) ofusca .gd files OK. Pero `encrypt_pck=false` significa que un APK pulled puede extraerse con APKEditor y los `.tscn`, `.tres`, `.json` (si se inclueyeran) son legibles. Para Phase 1 esto es aceptable (no hay secretos en assets), pero al meter `clubs.json` en el APK en Phase 2 (offline mode), eso filtraría toda la spec.

Hoy `clubs.json` solo vive en `nakama/data/clubs.json` (no exportado al APK), así que está OK. Documentar para Phase 2.

---

### IN-06: `web/privacy/*.html` / `web/terms/index.html` — placeholders no rellenados que pueden quedar en producción

**File:** `web/privacy/index.html:35-46`, `web/privacy/en.html:36-47`, `web/terms/index.html`

Placeholders `{nombre dev}`, `{CUIT}`, `{ciudad provincia}`, `{NRO-TRAMITE-AAIP}` aparecen en HTML público que se va a deploy a GitHub Pages. El workflow `deploy-web.yml` solo reemplaza `{YYYY-MM-DD del deploy}` — los demás placeholders se publican literalmente, lo que es:

1. Legally awkward (la policy queda incompleta).
2. SEO-bad (Google indexa el placeholder).
3. Trust-eroding para users que abran el privacy.

**Fix:**

Antes de deploy real, rellenar todos los placeholders (idealmente vía workflow injection desde GitHub Secrets):

```yaml
- name: Inject controller info into legal pages
  run: |
    sed -i "s|{nombre dev}|${{ secrets.LEGAL_NAME }}|g" web/privacy/*.html web/terms/*.html
    sed -i "s|{CUIT}|${{ secrets.LEGAL_CUIT }}|g" web/privacy/*.html web/terms/*.html
    sed -i "s|{ciudad provincia}|${{ secrets.LEGAL_LOCATION }}|g" web/privacy/*.html web/terms/*.html
    sed -i "s|{NRO-TRAMITE-AAIP}|${{ secrets.AAIP_FILING_NUMBER }}|g" web/privacy/*.html
```

O agregar un check de pre-deploy que falle si quedan placeholders sin reemplazar (excepto el de fecha que se rellena).

Mientras estos placeholders queden, agregar un banner visible en HTML: "BORRADOR — no usar como referencia legal hasta confirmar datos del responsable." Comentado: ya está documentado en `LEGAL-NOTES.md` como pendiente para Phase 7, pero el HTML público no lo refleja.

---

### IN-07: Smoke-test `TEST_EMAIL` con `+` y `.test` TLD — Nakama puede rechazar el TLD

**File:** `nakama/smoke-test.sh:22`

```bash
TEST_EMAIL="smoketest+$(date +%s)@barrabrava.test"
```

`.test` es un reserved TLD (RFC 2606) que algunas validaciones rechazan. Y `+` en el local-part puede ser stripped por algunos validators. Nakama actualmente acepta — pero si en Phase 2 endurecemos validation (e.g. agregamos `validateEmailMX`), este test va a empezar a fallar.

**Fix:** usar `example.com` (también reservado pero más universalmente aceptado):
```bash
TEST_EMAIL="smoketest-$(date +%s)@example.com"
```
(usar `-` no `+` para evitar el strip; usar `.com` para evitar TLD-validation).

---

### IN-08: `Dockerfile.nakama` no fija version de node patch — reproducibilidad rota a largo plazo

**File:** `Dockerfile.nakama:10`

```dockerfile
FROM node:20-alpine AS runtime-builder
```

`node:20-alpine` pulls la última 20.x.x cada rebuild — si Railway hace rebuild a 6 meses, puede traer 20.99 con behaviors distintos. Buena práctica: fijar a un patch específico (e.g. `node:20.11.1-alpine`) y bumpear deliberadamente.

Pero para Phase 1 esto está OK — el sub-image `heroiclabs/nakama:3.21.0` sí está fijado a patch, que es lo que más importa.

**Fix opcional:**
```dockerfile
FROM node:20.11.1-alpine AS runtime-builder
```

---

### IN-09: `web/reset-password/script.js` no maneja el caso de doble-submit del form

**File:** `web/reset-password/script.js:109-157`

El form listener no chequea `submitBtn.disabled` antes de procesar, así que si un usuario hace doble-tap muy rápido, dos calls concurrentes a `fetchBearerToken()` + `callResetRpc()` se disparan. `submitBtn.disabled = true` se setea a línea 121 pero ya hay otra invocación en flight. La 2da call probablemente fallará con "token already used" cuando llegue la 1ra a confirmar.

**Fix:**
```javascript
form.addEventListener("submit", async function (ev) {
  ev.preventDefault();
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;  // lock immediately
  // ... resto del flow
});
```

(Y mover el `submitBtn.disabled = true` actual al inicio en vez de después de las validaciones de pw — así un submit con pw inválida sigue dejándolo enabled para reintentar.)

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
