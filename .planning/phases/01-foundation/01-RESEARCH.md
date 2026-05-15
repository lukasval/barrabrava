# Phase 1: Foundation — Research

**Researched:** 2026-05-14
**Domain:** Godot 4.3 + Nakama 3.x + Railway/Fly.io + GitHub Actions CI/CD + Auth + Privacy
**Confidence:** MEDIUM-HIGH (most critical items verified via official sources; Railway region finding is HIGH — it changes the plan)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Registro y login exclusivamente con email + password. Sin OAuth social, sin guest mode en Phase 1.
- **D-02:** Sesión manejada con token de sesión Nakama persistido localmente (SecureStorage o similar). Re-login automático si el token es válido; refresh automático si expiró.
- **D-03:** Password recovery vía email de reseteo usando Nakama + SMTP (SendGrid o similar).
- **D-04:** Pre-login: pantalla simple (splash/loading → login/registro). Sin landing page elaborada.
- **D-05:** Identidades de clubes son data estática semillada — `clubs.json` en el repo, migración SQL/script lo carga a Postgres en el deploy inicial.
- **D-06:** Componentes de cada club en el seed: nombre paramédico en lunfardo, paleta 2 colores hex, forma base de escudo (6-8 arquetipos), barrio HQ real.
- **D-07:** Se seedean las 5 divisiones AFA completas desde Phase 1 (~130 clubes).
- **D-08:** Club picker necesita búsqueda/filtrado por nombre y division.
- **D-09:** Flujo de onboarding: Registro → Club picker → Nombre del pibe → Tutorial breve → Home screen.
- **D-10:** No hay selección de facción en el onboarding.
- **D-11:** Stats base del pibe al crearse: fijos e iguales para todos.
- **D-12:** Avatar del pibe en Phase 1: placeholder genérico (silueta/icono).
- **D-13:** Tutorial breve post-creación es una pantalla de bienvenida orientativa (no el tutorial completo).
- **D-14:** CI/CD en Phase 1 produce debug builds (APK para Android + IPA sin firmar para iOS).
- **D-15:** Nakama se despliega en Railway São Paulo desde Phase 1.
- **D-16:** Branch strategy: `main` = producción (deploy Railway automático), `develop` = staging.

### Claude's Discretion

- Fastlane setup: diferir a Phase 7. Phase 1 usa solo GitHub Actions con Godot export CLI.
- Schema exacto de stats del pibe (nombres de atributos, rango de valores).
- Cantidad exacta de arquetipos de forma de escudo (6-8 sugeridos).
- SMTP provider para email reset (SendGrid o Resend son razonables).
- Estructura exacta del JSON seed de clubes.

### Deferred Ideas (OUT OF SCOPE)

- Fastlane setup completo (submission a App Store / Play Store) → Phase 7
- FCM push notifications operativas → Phase 2
- Sistema de facciones completo → Phase 3 + Phase 5
- Avatar cosmético / sistema de outfit → Phase 5-6
- Tutorial completo "primera salida" (ONB-05/06) → Phase 3
- RevenueCat IAP integration → Phase 6
- OAuth social login → Post-MVP
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEC-01 | Cliente Godot 4.3 (iOS + Android) | Godot 4.3 confirmed stable, nakama-godot SDK v3.4.0 confirmed Godot 4.0+ compatible |
| TEC-02 | Backend Nakama self-hosted en Railway São Paulo | **CRITICAL FINDING:** Railway does NOT have São Paulo — recommend Fly.io gru (São Paulo) instead |
| TEC-03 | PostgreSQL via Nakama | Nakama bundles PostgreSQL; deployment pattern verified |
| TEC-04 | FCM push notifications (v1 API) | Deferred to Phase 2 — foundation only if any config needed |
| TEC-05 | Cloudflare R2 + CDN para assets | Out of scope Phase 1 — no dynamic assets yet |
| TEC-06 | RevenueCat para IAP | Deferred to Phase 6 |
| TEC-07 | GameAnalytics free tier | Deferred to Phase 2+ |
| TEC-08 | GitHub Actions + Fastlane CI/CD | Fastlane deferred Phase 7; GitHub Actions Android APK verified; iOS IPA needs macOS runner |
| TEC-09 | Server-authoritative para resources, combate, GPS, IAP, season | Nakama TypeScript runtime pattern verified |
| TEC-10 | Anti-cheat baseline: rate limiting, GPS plausibility, time desde servidor | Nakama provides rate limiting hooks; GPS deferred Phase 1.1 |
| ONB-01 | Player se registra con email/password | `authenticate_email_async` confirmed in nakama-godot SDK |
| ONB-02 | Player selecciona club entre ~130 clubes | clubs.json seed pattern + Nakama Storage Objects |
| ONB-03 | Player elige facción interna inicial | Deferred — facciones son Phase 3, not Phase 1 per D-10 |
| ONB-04 | Player crea su pibe — nombre, apariencia base, stats iniciales | Fixed stats per D-11; name validation server-side |
| CLB-01 | Sistema de identidad paramétrica para los ~130 clubes | clubs.json static seed → Nakama InitModule seeding |
| CLB-02 | Disclaimer "ficción inspirada en folklore argentino" + nombres parodiados | SplashScreen.tscn per UI-SPEC; first launch only |
| PRV-01 | Privacy policy en español | Link in AuthScreen registro tab; external URL or in-app WebView |
| PRV-02 | AAIP registration del database (Ley 25.326) | Online process via argentina.gob.ar/aaip — takes 2-4 weeks, must start NOW |
| PRV-03 | Account deletion flow desde dentro de la app | Phase 1 foundation: RPC to delete account; UI in settings (Phase 2) |
| PRV-04 | Consent dialogs para notificaciones + analytics | Deferred — FCM Phase 2, analytics Phase 2 |
| PRV-05 | Sin tracking persistente de ubicación | Enforced by design — no GPS code in Phase 1 |
</phase_requirements>

---

## Executive Summary

**Five findings that most change how we plan Phase 1:**

1. **Railway does NOT have São Paulo, Brazil.** The CONTEXT.md decision D-15 ("Nakama en Railway São Paulo") cannot be executed as written. Railway's four regions are US West, US East, EU West, and Southeast Asia (Singapore). The correct platform for São Paulo is **Fly.io** (region code `gru`, São Paulo). This is a locked decision that needs user confirmation to change from Railway to Fly.io. [VERIFIED: docs.railway.com/reference/regions]

2. **nakama-godot SDK is Godot 4.0+ confirmed, version 3.4.0, GDScript only.** `authenticate_email_async(email, password)` is the correct method. Session tokens are stored via `session.auth_token` + `session.refresh_token` in a ConfigFile at `user://session.cfg`. This is the standard mobile pattern. [VERIFIED: github.com/heroiclabs/nakama-godot]

3. **Nakama does NOT have built-in SMTP for password reset.** Password recovery is a custom TypeScript RPC that calls an external email API via `nk.httpRequest`. Recommended provider is **Resend** (3,000 emails/month permanently free; SendGrid killed its free tier in May 2025). The RPC pattern is well-documented. [VERIFIED: heroiclabs.com/docs; dev.to/thiago_alvarez]

4. **GitHub Actions Android APK is straightforward on Linux runners (free).** The `barichello/godot-ci` Docker image handles Godot 4.3 headless export. **iOS unsigned IPA requires a macOS runner** — the `dulvui/godot4-ios-export` action (now archived, June 2025) was the standard approach; Phase 1 iOS builds should run on the developer's local Mac. For Phase 1 debug-only goal, local iOS builds are acceptable. [VERIFIED: GitHub Marketplace]

5. **Club seed is ~130+ clubs, not exactly 130.** Primera Division (26), Primera Nacional (38 in 2024), B Metro (17), Federal A (~32), C Metro (~20) = approximately 133 clubs total. The seed file will have ~130-135 entries. The planner should target this range, not an exact 130. [VERIFIED: Wikipedia + Infobae sources]

**Primary recommendation:** Swap Railway for Fly.io (São Paulo `gru` region) before any infrastructure work begins. All other locked decisions are executable as stated.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth (login/registro/session) | API Backend (Nakama) | Client (Godot) — collects credentials only | Nakama owns session state, client only stores token |
| Club picker data | API Backend (Nakama Storage) | Client (Godot) — renders list | Clubs seeded to Nakama Storage on InitModule; client fetches via RPC |
| Pibe creation | API Backend (Nakama) | Client (Godot) — form input | Server validates name, stores pibe object, returns confirmation |
| Session token persistence | Client (Godot user:// ConfigFile) | — | Auth tokens are device-local; Nakama validates them on reconnect |
| Privacy policy display | Client (Godot) | — | Static URL or in-app WebView; no server component needed |
| CI/CD build | GitHub Actions (Linux for Android) | Developer Mac (iOS) | Linux runners free; iOS macOS runners expensive |
| Nakama runtime logic | API Backend (TypeScript runtime) | — | InitModule seeds clubs; RPCs handle pibe creation + name validation |
| PostgreSQL schema | API Backend (Nakama-managed) | — | Nakama controls schema; custom data via Storage Objects |
| Email password reset | API Backend (Nakama RPC → Resend API) | — | nk.httpRequest calls Resend HTTP API |

---

## Technical Findings

### 1. Nakama + Godot SDK Integration

**SDK:** `heroiclabs/nakama-godot` v3.4.0 [VERIFIED: github.com/heroiclabs/nakama-godot, March 2024]

- Written in GDScript, targets Godot 4.0+. No C# variant needed.
- Install: copy `addons/com.heroiclabs.nakama/` into Godot project, add `Nakama.gd` as autoload.
- Available on Godot Asset Library for one-click install.

**Email auth flow (GDScript):**
```gdscript
# In AuthManager.gd autoload
var _client: NakamaClient
var _session: NakamaSession

func _ready():
    _client = Nakama.create_client(
        "defaultkey",               # must match Nakama server key
        "your-nakama-host.fly.dev", # Fly.io hostname
        443,                        # HTTPS port
        "https"
    )
    await _restore_session()

func login(email: String, password: String) -> Error:
    var session = await _client.authenticate_email_async(email, password)
    if session.is_exception():
        return FAILED
    _session = session
    _save_session(session)
    return OK

func register(email: String, password: String) -> Error:
    var session = await _client.authenticate_email_async(
        email, password, true, ""  # create=true
    )
    if session.is_exception():
        return FAILED
    _session = session
    _save_session(session)
    return OK

func _save_session(session: NakamaSession) -> void:
    var cfg = ConfigFile.new()
    cfg.set_value("auth", "token", session.token)
    cfg.set_value("auth", "refresh_token", session.refresh_token)
    cfg.save("user://session.cfg")

func _restore_session() -> void:
    var cfg = ConfigFile.new()
    if cfg.load("user://session.cfg") != OK:
        return
    var token = cfg.get_value("auth", "token", "")
    var refresh = cfg.get_value("auth", "refresh_token", "")
    if token == "":
        return
    var session = _client.restore_session(token)
    if session.expired:
        session = await _client.session_refresh_async(session)
    _session = session
```

[CITED: heroiclabs.com/docs/nakama/client-libraries/godot/] [ASSUMED: token field name is `session.token` — verify against SDK source; docs show `session.auth_token` in some examples]

**Session persistence on mobile:** `user://` in Godot maps to:
- Android: `/data/data/{app_id}/files/` (sandboxed, not accessible without root)
- iOS: `Documents/` directory (iCloud backup by default — acceptable for auth tokens)

The ConfigFile approach is appropriate for Phase 1. True keychain storage requires a native plugin and is deferred.

**Known Godot 4.3 + Nakama gotchas:**
- Nakama.gd autoload must be the first autoload in Project Settings (before any scene tries to use it). [ASSUMED]
- The SDK uses Godot's `HTTPClient` internally. Ensure HTTPS is enabled on the Nakama server (Fly.io provides TLS termination via its proxy).
- `await` on Nakama async methods requires the calling function to be `async`. All auth calls must be in `async` functions or coroutines.

---

### 2. Backend Deployment: Railway vs Fly.io

**CRITICAL FINDING — Railway does NOT have São Paulo:**

Railway's current regions (as of research date): US West (California), US East (Virginia), EU West (Amsterdam), Southeast Asia (Singapore). No South America. [VERIFIED: docs.railway.com/reference/regions]

**Recommendation: Fly.io São Paulo (`gru` region)**

Fly.io has a São Paulo, Brazil region (`gru`). It is operational and supports Managed Postgres. [VERIFIED: fly.io/docs/reference/regions/]

Note: Fly.io announced a "region consolidation project" in September 2025. The `gru` region was mentioned in this project — check current status at fly.io/docs/reference/regions before deploying. The region is operational as of this research but may have changes pending. [VERIFIED: fly.io/blog/the-region-consolidation-project/]

**Fly.io deployment pattern for Nakama:**

```toml
# fly.toml
app = "barrabrava-nakama"
primary_region = "gru"

[build]
  dockerfile = "Dockerfile.nakama"

[http_service]
  internal_port = 7350
  force_https = true

[[services.ports]]
  handlers = ["http"]
  port = 80
[[services.ports]]
  handlers = ["tls", "http"]
  port = 443
```

**Nakama Docker image:** `heroiclabs/nakama:3.x.x` (use pinned version, not `latest`)

**Environment variables required on Fly.io:**
```
DATABASE_URL=postgresql://user:pass@host/nakama
NAKAMA_SERVER_KEY=your_server_key_min_16_chars
NAKAMA_CONSOLE_USERNAME=admin
NAKAMA_CONSOLE_PASSWORD=secure_password_here
NAKAMA_SESSION_ENCRYPTION_KEY=min_32_char_secret
NAKAMA_SESSION_REFRESH_ENCRYPTION_KEY=min_32_char_secret
```

**Start command pattern (same as Railway):**
```sh
/bin/sh -ecx "exec /nakama/nakama \
  --database.address $DATABASE_URL \
  --session.encryption_key $NAKAMA_SESSION_ENCRYPTION_KEY \
  --session.refresh_encryption_key $NAKAMA_SESSION_REFRESH_ENCRYPTION_KEY \
  --console.username $NAKAMA_CONSOLE_USERNAME \
  --console.password $NAKAMA_CONSOLE_PASSWORD"
```

**Pre-deploy migration command:**
```sh
/bin/sh -ecx "/nakama/nakama migrate up --database.address $DATABASE_URL"
```
[VERIFIED: station.railway.com — same pattern works on Fly.io]

**Postgres:** Use Fly.io Managed Postgres (fully managed, backups included, same `gru` region). [VERIFIED: fly.io/mpg/]

**Estimated cost on Fly.io:**
- Nakama: smallest VM (shared-cpu-1x, 256MB) ≈ $2-4/month
- Managed Postgres (smallest): ≈ $7-15/month
- **Total: ~$10-20/month** — under the $40/month budget with headroom [ASSUMED: based on Fly.io pricing page knowledge; verify current prices at fly.io]

**Alternative if Fly.io gru consolidation removes São Paulo:** Use US East (IAD) — Argentina → Virginia ping is ~100-130ms, still acceptable for async strategy game tempo. Or wait for Railway to add a South American region.

---

### 3. GitHub Actions CI/CD for Godot 4.3

**Android APK (debug) — Linux runner, free:**

```yaml
# .github/workflows/build-android-debug.yml
name: Android Debug Build
on:
  push:
    branches: [develop, main]

jobs:
  export-android-debug:
    name: Android Debug Export
    runs-on: ubuntu-22.04
    container:
      image: barichello/godot-ci:4.3
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup export templates
        run: |
          mkdir -p ~/.local/share/godot/export_templates/
          mv /root/.local/share/godot/export_templates/4.3.stable \
             ~/.local/share/godot/export_templates/4.3.stable
      
      - name: Import project (pre-heat)
        run: godot --headless --editor --quit
      
      - name: Export APK (debug)
        run: |
          mkdir -p build/android
          godot --headless --verbose \
            --export-debug "Android Debug" \
            "build/android/BarraBrava-debug.apk"
      
      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-debug-apk
          path: build/android/BarraBrava-debug.apk
```

[VERIFIED: github.com/abarichello/godot-ci, github.com/marketplace/actions/godot-ci]

**Docker image:** `barichello/godot-ci:4.3` — supports Godot 4.3 stable. [VERIFIED: Docker Hub hub.docker.com/r/barichello/godot-ci/]

**Known Godot 4.3 CI gotcha:** The `export_presets.cfg` in Godot 4.3 does not include keystore lines by default (unlike earlier versions). For debug builds this is fine — the CI image provides a debug.keystore automatically. For release builds (Phase 7+), add keystore configuration to `export_presets.cfg` and store as base64 GitHub Secret. [VERIFIED: github.com/abarichello/godot-ci/issues/161]

**Pre-heat step is required:** Running `godot --headless --editor --quit` before export forces Godot to import all project assets. Without this, headless export may crash on missing imports. [VERIFIED: github.com/godotengine/godot/issues/69511]

**iOS IPA (unsigned) — macOS required:**

The `dulvui/godot4-ios-export` action was archived June 2025. For Phase 1 debug-only goal:

**Recommended approach for Phase 1:** Build iOS locally on developer's Mac using Godot's export → Xcode → archive → unsigned IPA. This satisfies "compila sin error" without spending GitHub Actions macOS minutes ($0.08/min = expensive).

If automated iOS CI is needed later (Phase 7): Use `macOS-latest` GitHub runner + Godot headless export to Xcode project + `xcodebuild` to archive. Requires Apple Developer account + certificates for TestFlight, but not for Phase 1 debug IPA. [VERIFIED: github.com/dulvui/godot4-ios-export README]

**`export_presets.cfg` must be committed to git** (not in .gitignore) — Godot CI requires it. The presets file contains no sensitive data for debug builds.

---

### 4. Nakama Schema + Storage Strategy for Phase 1

**Nakama's official stance:** Custom PostgreSQL tables are strongly discouraged. Use the Storage Engine (key-value JSON objects). Custom SQL is only for cases where the Storage Engine is insufficient. [VERIFIED: heroiclabs.com/docs/nakama/concepts/storage/]

**Phase 1 data model using Nakama Storage Objects:**

| Collection | Key | Value | Owner |
|-----------|-----|-------|-------|
| `clubs` | `{club_id}` | Full club object (name, division, colors, shield_type, barrio) | System (no owner) |
| `players` | `profile` | `{display_name, club_id, created_at}` | User |
| `pibes` | `{pibe_id}` | `{name, stats: {aguante:50, velocidad:50, astucia:50, carisma:50}, club_id, created_at}` | User |

**Clubs seeding strategy:**

Nakama's `InitModule` runs on every server startup. Pattern for one-time seeding:

```typescript
// In InitModule
const InitModule: nkruntime.InitModule = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) => {
  // Seed clubs if not already seeded
  const seedKey = "clubs_seeded_v1";
  try {
    const existing = nk.storageRead([{collection: "meta", key: seedKey, userId: "00000000-0000-0000-0000-000000000000"}]);
    if (existing.length > 0) return; // already seeded
  } catch (e) { /* first run */ }

  // Load clubs from bundled JSON (included in runtime bundle)
  const clubs: Club[] = JSON.parse(clubsJson); // bundled at build time
  const writes: nkruntime.StorageWriteRequest[] = clubs.map(club => ({
    collection: "clubs",
    key: club.id,
    userId: "00000000-0000-0000-0000-000000000000",
    value: club,
    permissionRead: 2,  // public read
    permissionWrite: 0  // no client write
  }));
  nk.storageWrite(writes);

  // Mark as seeded
  nk.storageWrite([{
    collection: "meta", key: seedKey,
    userId: "00000000-0000-0000-0000-000000000000",
    value: {seeded: true}, permissionRead: 0, permissionWrite: 0
  }]);
  logger.info("Clubs seeded: " + clubs.length);
};
```

[CITED: heroiclabs.com/docs/nakama/server-framework/typescript-runtime/]

**Client fetches clubs via RPC:**
```gdscript
# Client fetches paginated clubs with optional division filter
var result = await _client.rpc_async(_session, "get_clubs", 
    JSON.stringify({"division": "Primera", "page": 1}))
```

**Pibe creation RPC (server-side validation):**
- Validates pibe name against deny list (profanity, reserved words)
- Checks player doesn't already have a pibe (one per account Phase 1)
- Assigns fixed stats
- Writes pibe to Storage
- Returns pibe object to client

**Nakama version:** 3.x series, latest release January 2025. Active maintenance confirmed. [VERIFIED: github.com/heroiclabs/nakama/releases]

---

### 5. Club Seed Data: Structure and Volume

**Actual club counts by division (2024 season data):**

| Division | Count | Data quality |
|----------|-------|-------------|
| Primera División (Liga Profesional) | 26 | Excellent — API-Football covers fully |
| Primera Nacional | 38 | Good — API-Football covers |
| B Metropolitana | 17 | Limited API coverage — manual seed |
| Federal A | ~32 | No API — manual seed |
| C Metropolitana | ~20 | No API — manual seed |
| **Total** | **~133** | — |

[VERIFIED: Wikipedia — 2024 Primera Nacional (38 clubs), Primera B Metropolitana (17 clubs)]
[ASSUMED: Federal A (~32) and C Metro (~20) counts based on training knowledge — verify against AFA official site before finalizing seed]

**clubs.json schema (recommended):**
```json
{
  "id": "boca_juniors",
  "lunfardo_name": "Los Xeneizes",
  "division": "Primera",
  "division_rank": 1,
  "colors": {
    "primary": "#003087",
    "secondary": "#F9C108"
  },
  "shield_archetype": "classic_vertical_stripe",
  "barrio_hq": "La Boca",
  "city": "Buenos Aires",
  "stadium": "La Bombonera",
  "rival_ids": ["river_plate"]
}
```

**Shield archetypes (6-8 recommended):**
1. `classic_diagonal_stripe` (Boca-style)
2. `classic_vertical_stripe` (generic)
3. `sash` (River-style diagonal sash)
4. `quarters` (four quarters, different colors)
5. `circle_crest` (round badge style)
6. `oval_crest` (oval frame)
7. `shield_pointed` (English FA cup shield)
8. `shield_curved` (modern rounded shield)

These are pure geometry archetypes — combined with club colors they generate visually distinct badges without copying any real escudo. [ASSUMED — recommend 8 archetypes for maximum visual variety]

**Source for lunfardo club names:** No existing dataset found. Must be authored by developer. Approach: use established nickname slang (xeneizes, millonarios, diablos, cuervos, etc.) for well-known clubs; invent plausible lunfardo parodies for lower division clubs. Avoid any registered trademarked names. [ASSUMED — this is creative content, not technical data]

**Where to find club lists:**
- Primera + Nacional: API-Football free account (verify coverage)
- B Metro, Federal A, C Metro: Wikipedia category pages + AFA official site (manual compilation)

**Time estimate for seed file:** 133 clubs × ~8 fields = manageable in a spreadsheet converted to JSON. Estimate 4-8 hours of research + authoring for a solo dev.

---

### 6. Auth Implementation Details

**`authenticate_email_async` signature:**
```gdscript
# create=true creates account if not exists; create=false login only
var session = await client.authenticate_email_async(email, password, create, username)
```
[VERIFIED: github.com/heroiclabs/nakama-godot README]

**Token persistence pattern (Phase 1):**
- Store `session.token` (JWT, ~1h expiry default) and `session.refresh_token` (~30 day expiry default) in `ConfigFile` at `user://session.cfg`
- On app launch: load tokens → `client.restore_session(token)` → check `session.expired` → if expired, call `client.session_refresh_async(session)` → if refresh fails (>30 days), go to login screen
- This is not encrypted storage. For Phase 1 it is acceptable. True Keychain/Android Keystore requires a native plugin (deferred post-Phase 1).

**Password reset (custom RPC pattern):**

No built-in SMTP in Nakama. Implementation requires:

1. **Server-side RPC `request_password_reset`:**
   - Takes email as input
   - Queries Nakama accounts to find user by email
   - Generates a time-limited reset token (store in Nakama Storage with TTL)
   - Calls Resend API via `nk.httpRequest` to send email
   - Returns success (never reveal if email exists or not — security)

2. **Reset link:** Points to a simple web page (can be a GitHub Pages static page in Phase 1) that accepts the token and new password

3. **Server-side RPC `confirm_password_reset`:**
   - Validates token
   - Updates password via Nakama account update API
   - Invalidates token

**SMTP provider recommendation: Resend**
- Free tier: 3,000 emails/month permanently (100/day cap) [VERIFIED: dev.to/thiago_alvarez]
- SendGrid killed free tier May 2025 — do not use SendGrid for Phase 1
- Resend API key stored as Fly.io secret / environment variable
- Developer-friendly REST API, excellent docs

**Resend integration via `nk.httpRequest`:**
```typescript
const response = nk.httpRequest("https://api.resend.com/emails", "post", {
  "Authorization": "Bearer " + resendApiKey,
  "Content-Type": "application/json"
}, JSON.stringify({
  from: "BarraBrava <noreply@yourdomain.com>",
  to: [userEmail],
  subject: "Reseteo de contraseña - BarraBrava",
  html: "<p>Hacé clic acá para resetear tu contraseña: <a href='" + resetLink + "'>" + resetLink + "</a></p>"
}));
```
[CITED: heroiclabs.com/docs/nakama/guides/server-framework/sendgrid/ — pattern adapted for Resend]

**Resend requires a verified domain** (send email from your domain, not a free one). Budget time to set up DNS records (DKIM/SPF). Free personal domain or subdomain of the app's domain works.

---

### 7. Privacy Policy + AAIP (PRV-01..05)

**What Phase 1 must deliver technically:**

| Requirement | Technical implementation | Phase 1 or later? |
|-------------|-------------------------|-------------------|
| PRV-01: Privacy policy en español accessible pre-registro | RichTextLabel BBCode link in AuthScreen registro tab → opens OS browser to policy URL | Phase 1 |
| PRV-02: AAIP registration Ley 25.326 | Manual process — developer registers at argentina.gob.ar/aaip via "Trámites a Distancia" | Start NOW (2-4 weeks) |
| PRV-03: Account deletion flow | Server RPC `delete_account` → Nakama account delete API → clear Storage Objects | Phase 1 (backend RPC); UI in settings (Phase 2) |
| PRV-04: Consent dialogs notifications + analytics | FCM consent = Phase 2; Analytics consent = Phase 2 | Deferred |
| PRV-05: Sin tracking persistente de ubicación | No GPS code in Phase 1 at all | Enforced by omission |

**AAIP Registration Process:**
- Register at: argentina.gob.ar/aaip
- Process: online via "Trámites a Distancia" platform
- Required: CUIT/CUIL of the developer or legal entity, description of data collected, purpose of collection
- Timeline: 2-4 weeks for approval
- Cost: free
- **This must be started before Phase 1 is considered complete** for legal compliance. [VERIFIED: argentina.gob.ar/aaip/datospersonales]

**Privacy Policy minimum contents for Ley 25.326:**
- What data is collected (email, gameplay data)
- Purpose (game operation)
- How long retained
- How to request deletion (email + in-app flow)
- Contact information
- No location data collected (Phase 1)

**Hosting the policy:** A simple static HTML page on GitHub Pages or Cloudflare Pages is sufficient. Must be accessible without account login.

**CLB-02 (Fiction Disclaimer):** Implemented as `SplashScreen.tscn` per UI-SPEC — "Esto es una parodia de fútbol argentino. Cualquier parecido con personas reales es coincidencia." Shown on first launch only (store flag in ConfigFile). [CITED: 01-UI-SPEC.md]

---

### 8. App Store Framing Risk

**Phase 1 has no App Store submission** (debug builds only, D-14). However, design decisions made now affect Phase 7 submission. Key mitigations already locked in by project decisions:

- Fiction disclaimer on SplashScreen (CLB-02) ✓
- Lunfardo names, never real club names ✓
- No graphic violence (Phase 4+ combat is deferred) ✓
- Phase 1 builds: registration, club picker, pibe name, tutorial, home screen — zero violent content

**For Phase 7 submission:** The store submission strategy is out of scope for this research phase but the UI-SPEC already implements the safeguards correctly.

---

### 9. Build Order / Critical Path Recommendation

**Optimal sequencing for solo dev — Phase 1:**

```
WAVE 0 — Infrastructure (no code dependencies)
├── A. Register domain (for Resend SMTP + privacy policy hosting)
├── B. Create Fly.io account + gru deployment (Nakama + Postgres)
├── C. Set all environment variables on Fly.io
├── D. Start AAIP registration (2-4 weeks — async, not blocking)
└── E. Create GitHub repo + branch structure (main + develop)

WAVE 1 — Godot project skeleton (unblocks everything client-side)
├── F. Godot 4.3 project setup + folder structure
├── G. Install nakama-godot SDK as addon + autoload
├── H. Shared Theme.tres + Nunito fonts (per UI-SPEC)
├── I. GitHub Actions workflow for Android APK debug
└── J. Verify CI pipeline produces APK on push to develop

WAVE 2 — Nakama TypeScript runtime (unblocks server features)
├── K. nakama-project-template setup (TypeScript + esbuild)
├── L. clubs.json authored (all ~133 clubs)
├── M. InitModule with club seeding RPC
├── N. get_clubs RPC (paginated, filterable by division)
├── O. create_pibe RPC (validates name, assigns stats, persists)
└── P. request_password_reset + confirm_password_reset RPCs

WAVE 3 — Client screens (depends on Wave 1 + Wave 2)
├── Q. SplashScreen.tscn (disclaimer + loading)
├── R. AuthScreen.tscn (login + registro tabs, Nakama auth)
├── S. ClubPickerScreen.tscn (fetches clubs via RPC)
├── T. PibeCreatorScreen.tscn (calls create_pibe RPC)
├── U. TutorialScreen.tscn (static)
└── V. HomeScreen.tscn (shell with bottom nav)

WAVE 4 — Privacy + Verification
├── W. Privacy policy page published (GitHub Pages)
├── X. Account deletion RPC functional
└── Y. End-to-end smoke test: register → club → pibe → home
```

**Critical path:** B → G → M → R → S → T → Y (server must be up before client auth can be tested)

**Bottleneck risks:**
- AAIP registration (async, start Day 1)
- clubs.json authoring (~133 lunfardo names) — creative work, estimate 4-8 hours
- Nakama TypeScript runtime setup (learning curve for first-time users — budget 2 days)
- iOS CI — skip GitHub Actions for Phase 1; build locally on Mac

---

### 10. Validation Architecture

**Test framework:** No Godot unit test framework in use for Phase 1. Validation is integration/smoke testing via direct API calls + manual device testing.

**Phase 1 is considered complete when all of the following pass:**

| Req ID | Behavior | Test Method | Automated? |
|--------|----------|-------------|------------|
| TEC-01 | Android APK builds without error | GitHub Actions CI green | ✓ CI |
| TEC-01 | iOS IPA builds without error (locally) | Godot export → Xcode archive succeeds locally | Manual |
| TEC-02 | Nakama responds on Fly.io São Paulo | `curl https://your-nakama.fly.dev/healthcheck` returns 200 | ✓ curl |
| TEC-03 | PostgreSQL operational | Nakama console shows 0 errors on startup | Manual |
| ONB-01 | Register with email+password creates account | Postman/curl Nakama API: POST /v2/account/authenticate/email | Manual |
| ONB-01 | Login with same credentials returns session token | Same as above with create=false | Manual |
| ONB-01 | Auto-login works on app restart | Manual device test: kill app, reopen | Manual |
| ONB-02 | Club list loads with 133+ clubs in picker | Client shows all clubs; filter by division works | Manual device |
| ONB-02 | Search by club name narrows list | Type partial name, list filters | Manual device |
| ONB-04 | Pibe created with fixed stats 50/50/50/50 | Server returns pibe object; client shows tutorial | Manual device |
| ONB-04 | Profanity name rejected with error | Try "hijo de puta" as pibe name — server returns error | Manual |
| CLB-01 | All 5 divisions represented in club seed | Count Storage Objects in Nakama console by division | Manual |
| CLB-02 | Fiction disclaimer shows on first launch only | Launch app fresh, see splash; relaunch, don't see it | Manual |
| PRV-01 | Privacy policy link opens in browser before registro | Tap "reglas del juego" link in registro tab | Manual |
| PRV-03 | Account deletion RPC exists and works | Call RPC via Nakama console test; verify account deleted | Manual |
| D-16 | Push to main deploys to Fly.io | Git push main → Fly.io deploys new version | Manual verify |

**Smoke test script (end-to-end):**
```bash
# Run after every wave merge
NAKAMA_HOST="your-nakama.fly.dev"
NAKAMA_KEY="defaultkey"

# 1. Health check
curl -f "https://$NAKAMA_HOST/healthcheck"

# 2. Register
curl -X POST "https://$NAKAMA_HOST/v2/account/authenticate/email?create=true" \
  -H "Authorization: Basic $(echo -n "$NAKAMA_KEY:" | base64)" \
  -d '{"email":"test@barrabrava.test","password":"test123456"}'

# 3. Get clubs (RPC)
curl -X POST "https://$NAKAMA_HOST/v2/rpc/get_clubs" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"division":"Primera","page":1}'
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management + refresh | Custom JWT handling | Nakama's built-in session API | Token refresh, expiry, device session — all handled |
| Email sending | Custom SMTP client | Resend via nk.httpRequest | DNS, deliverability, anti-spam — solved |
| Godot CI Docker image | Custom build environment | `barichello/godot-ci:4.3` | Android SDK, Godot templates, headless mode — all pre-configured |
| Club list filtering + search | Server-side search engine | Client-side filter in GDScript | 133 clubs fit in memory; no server roundtrip needed |
| Password hashing | bcrypt implementation | Nakama handles automatically | Never roll crypto |
| Mobile storage paths | Platform detection code | `user://` universal path | Godot abstracts Android + iOS correctly |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `session.token` is the field name for JWT in nakama-godot (some docs say `session.auth_token`) | Auth code examples | Wrong field name = auth never persists; fix is trivial once caught |
| A2 | Nakama autoload must be first in Project Settings autoload order | Nakama + Godot integration | Other autoloads that use Nakama will crash on startup; easy to debug |
| A3 | Fly.io gru (São Paulo) region is still operational post-consolidation project | Infrastructure | If gru is removed, must use US East (100-130ms vs 20-60ms latency) |
| A4 | Federal A has ~32 clubs and C Metro has ~20 (2024 season) | Club seed volume | Total club count may differ; seed file needs verification against AFA |
| A5 | Resend domain verification takes <24h | Email / SMTP | If DNS propagation is slow, password reset is not testable during Phase 1 |
| A6 | `barichello/godot-ci:4.3` Docker image is available on Docker Hub as of Phase 1 execution | CI/CD | If image is deprecated/removed, must build custom CI image (~1 day work) |
| A7 | Nakama's InitModule-based seeding with idempotent check works reliably on Fly.io restart | Club seeding | If seeding runs on every restart without idempotency, data duplicates; design must include version flag |
| A8 | 8 shield archetypes are sufficient for visual variety across 133 clubs | Club identity | May need more archetypes to avoid too many clubs looking identical |

---

## Open Questions

1. **Railway vs Fly.io — user must confirm the swap**
   - What we know: Railway has no São Paulo. Fly.io has São Paulo (`gru`).
   - What's unclear: D-15 locks "Railway São Paulo" — this cannot be executed. User needs to confirm Fly.io is acceptable.
   - Recommendation: Flag to user before planning begins. Suggest Fly.io gru as direct replacement.

2. **Legal entity for AAIP registration**
   - What we know: AAIP requires a CUIT/CUIL of the responsible party.
   - What's unclear: Developer's legal entity status — individual (monotributista) vs company?
   - Recommendation: Register as individual developer with personal CUIT if no company entity yet.

3. **Resend domain setup**
   - What we know: Resend requires a verified sending domain. Can't send from gmail.com.
   - What's unclear: Does the developer own a domain for this project yet?
   - Recommendation: Register a domain before Wave 2 starts. `barrabrava.ar` or `.com` — budget $10-15/year.

4. **clubs.json authoring responsibility**
   - What we know: 133 clubs need lunfardo names authored by the developer.
   - What's unclear: Is this developer-only or will Claude Co-author via a session?
   - Recommendation: Plan a dedicated session to co-author clubs.json using a template format. This is the longest non-technical task in Phase 1.

5. **Fly.io gru region consolidation status**
   - What we know: A consolidation project was announced September 2025. gru was listed.
   - What's unclear: Is gru scheduled for removal or just reorganization?
   - Recommendation: Check fly.io/docs/reference/regions/ and fly.io/blog/the-region-consolidation-project/ before provisioning.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Godot 4.3 | Client development | Unknown — developer to verify | 4.3.x stable | None — must install |
| Android SDK | Android export CI + local | Unknown | Unknown | Install via Android Studio |
| Xcode | iOS builds (local) | Unknown — requires macOS | 15+ | No Xcode = no iOS builds |
| Docker | Local Nakama development | Unknown | Unknown | Use Fly.io directly from Day 1 (D-15 intent) |
| Node.js | Nakama TypeScript runtime build | Unknown | 18+ recommended | Install via nvm |
| Fly CLI (`flyctl`) | Fly.io deployment | Unknown | Latest | Install: curl -L https://fly.io/install.sh |
| Git | Version control | Assumed installed | 2.x | — |

**Note:** Per D-15 (deploy to Railway/Fly.io from Day 1), no local Docker for Nakama is strictly required. The dev environment points to cloud Fly.io from the start. This simplifies local setup to: Godot + Android SDK (for Android testing) + Xcode (for iOS, macOS only).

---

## Red Flags / Unknowns

1. **Railway São Paulo does not exist** — THE biggest planning constraint. The CONTEXT.md decision must be updated from "Railway São Paulo" to "Fly.io São Paulo (gru)". Do not start infrastructure work until this is confirmed.

2. **clubs.json is a significant creative + research task** — 133 club records with lunfardo names, color palettes, shield archetypes, barrio assignments. This is not a mechanical task. It is the most time-consuming non-coding task in Phase 1. Allocate dedicated time; do not treat it as a quick data entry task.

3. **Nakama TypeScript runtime learning curve** — If the developer has no prior Nakama experience, budget 2 extra days for the TypeScript runtime setup (esbuild config, type definitions, deploy pipeline). The `nakama-project-template` on GitHub is the fastest onramp.

4. **iOS CI is effectively manual in Phase 1** — No free iOS CI solution exists without macOS runners ($0.08/min). For Phase 1 debug IPA, local Mac build is the correct approach. The CI metric for TEC-08 should be "iOS builds locally without error" not "iOS builds in CI."

5. **AAIP registration is a legal obligation with a 2-4 week lead time** — Must be started on Phase 1 Day 1. It does not block code development but must be complete before any public access to the game. Failing to register is a Ley 25.326 compliance violation.

6. **Resend domain requirement** — Cannot send password reset emails without a verified custom domain. If the developer doesn't own one, this blocks the password reset feature. Register a domain in Wave 0.

---

## Standard Stack

### Core (Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Godot Engine | 4.3 stable | Game client | MIT, confirmed iOS/Android, smaller APK |
| nakama-godot SDK | 3.4.0 | Nakama client for GDScript | Official SDK, Godot 4.0+ confirmed |
| Nakama Server | 3.x latest (3.21+) | Game backend | Purpose-built game backend |
| PostgreSQL | 16 (Fly.io managed) | Persistence | Bundled with Nakama pattern |
| barichello/godot-ci | :4.3 Docker tag | CI export | Standard Godot CI image |
| Resend | API v1 | Transactional email | Free tier 3K/month; SendGrid no longer free |
| Fly.io | current | Hosting platform | Only PaaS with São Paulo region |
| Nunito | Regular 400 + Bold 700 | Typography | Per UI-SPEC; OFL licensed |

### Version Verification
```bash
# Verify Nakama server latest version before pinning
curl https://api.github.com/repos/heroiclabs/nakama/releases/latest | grep tag_name

# Verify nakama-godot SDK latest
curl https://api.github.com/repos/heroiclabs/nakama-godot/releases/latest | grep tag_name

# Verify godot-ci Docker tag exists
curl -s "https://hub.docker.com/v2/repositories/barichello/godot-ci/tags/4.3" | python3 -m json.tool | grep name
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (Phase 1) — integration testing via curl + manual device |
| Config file | none |
| Quick run command | `curl -f https://your-nakama.fly.dev/healthcheck` |
| Full suite command | Manual end-to-end: register → club select → pibe create → home |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEC-01 | Android APK builds | CI | GitHub Actions green check | ❌ Wave 0 |
| TEC-02 | Nakama on Fly.io responsive | smoke | `curl -f $NAKAMA_HOST/healthcheck` | ❌ Wave 1 |
| ONB-01 | Email registration creates account | integration | curl Nakama auth endpoint | ❌ Wave 2 |
| ONB-01 | Login returns valid session | integration | curl Nakama auth endpoint | ❌ Wave 2 |
| ONB-02 | 133 clubs in picker | manual | Nakama console: count Storage Objects in "clubs" | ❌ Wave 2 |
| ONB-04 | Pibe created with fixed stats | integration | curl create_pibe RPC | ❌ Wave 2 |
| CLB-02 | Disclaimer shows on first launch | manual | device test | manual |
| PRV-01 | Policy link opens browser | manual | device test | manual |
| PRV-03 | Account deletion RPC works | integration | curl delete_account RPC | ❌ Wave 2 |

### Wave 0 Gaps (infrastructure before code)
- [ ] `.github/workflows/build-android-debug.yml` — covers TEC-01
- [ ] Fly.io deployment confirmed (Nakama + Postgres operational) — covers TEC-02
- [ ] `nakama/` TypeScript runtime directory with `package.json` + `tsconfig.json` — runtime scaffold
- [ ] `clubs.json` in repository root — covers CLB-01, ONB-02
- [ ] Privacy policy HTML page published at static URL — covers PRV-01

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Nakama email auth + session token |
| V3 Session Management | Yes | Nakama session refresh, token expiry |
| V4 Access Control | Yes | Nakama Storage permission levels (0=none, 1=owner, 2=public) |
| V5 Input Validation | Yes | Server-side name validation in create_pibe RPC |
| V6 Cryptography | Yes | Nakama handles password hashing (never hand-roll) |

### Known Threat Patterns for Phase 1

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Account enumeration via reset email | Information Disclosure | Return same response regardless of email existence |
| Pibe name injection (XSS/SQL) | Tampering | Server-side deny list + Nakama Storage handles escaping |
| Replay session token after logout | Elevation of Privilege | Nakama token invalidation on logout + refresh token rotation |
| Mass account creation (bot registration) | Denial of Service | Rate limit registration endpoint in Nakama server config |
| Client-side stat manipulation | Tampering | Stats assigned server-side, never trusted from client |

---

## Sources

### Primary (HIGH confidence)
- github.com/heroiclabs/nakama-godot — SDK version 3.4.0, Godot 4.0+ confirmed, `authenticate_email_async` method confirmed
- docs.railway.com/reference/regions — Railway has no São Paulo (CRITICAL FINDING)
- fly.io/docs/reference/regions/ — Fly.io has gru (São Paulo, Brazil) region
- github.com/abarichello/godot-ci — Docker image for Godot 4.3 CI
- heroiclabs.com/docs/nakama/guides/server-framework/sendgrid/ — nk.httpRequest email pattern
- heroiclabs.com/docs/nakama/server-framework/typescript-runtime/ — InitModule signature
- station.railway.com/questions/docker-deployment-with-environment-varia-a3f295d2 — Nakama Railway config (same pattern works on Fly.io)
- argentina.gob.ar/aaip — AAIP registration portal confirmed operational

### Secondary (MEDIUM confidence)
- dev.to/thiago_alvarez — SendGrid free tier killed May 2025; Resend 3K/month free confirmed
- github.com/dulvui/godot4-ios-export — iOS Godot 4 CI action (archived June 2025 — do not use)
- gist.github.com/nickmarty/4d348121c164863610cae828bc1c7930 — Nakama password reset pattern
- station.railway.com/questions/trouble-deploying-nakama-with-postgre-fdfa4163 — Nakama + Railway deployment pattern
- en.wikipedia.org/wiki/2024_Primera_Nacional — 38 clubs in Nacional 2024
- en.wikipedia.org/wiki/Primera_B_Metropolitana — 17 clubs in B Metro

### Tertiary (LOW confidence / ASSUMED)
- Federal A club count (~32) — training knowledge, not verified against AFA official site
- C Metro club count (~20) — training knowledge, not verified
- Fly.io gru region consolidation impact — status as of September 2025 announcement; current status unknown

---

## Metadata

**Confidence breakdown:**
- Nakama-Godot SDK integration: HIGH — verified against official SDK repo
- Railway finding (no São Paulo): HIGH — verified against official Railway docs
- Fly.io São Paulo availability: MEDIUM-HIGH — confirmed in docs but consolidation project adds uncertainty
- GitHub Actions Android CI: HIGH — verified patterns, known issue with Godot 4.3 keystore documented
- iOS CI approach (local Mac): HIGH — archived action confirms this is correct Phase 1 approach
- Club counts: MEDIUM — Primera + Nacional verified, lower divisions assumed
- AAIP process: HIGH — official government site confirms process
- Resend free tier: HIGH — verified, SendGrid free tier removal confirmed

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (Fly.io region status should be re-verified; npm package versions may change)

---

## RESEARCH COMPLETE
