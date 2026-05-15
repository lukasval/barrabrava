---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
revised: 2026-05-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**Status (2026-05-15):** Plans 01-05 satisfy Nyquist by including `<automated>` verify commands in every code-producing task. Wave 0 deliverables (smoke-test.sh, build-android-debug.yml, Nakama+Postgres on Railway, clubs.json seeded) are scoped across Plans 01 and 03 and become the foundation Plans 04-05 build on. iOS CI is formally deferred to Phase 7 — see `DEFERRED-IOS-CI.md` — and is therefore NOT a Phase 1 Nyquist requirement.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (Phase 1) — curl smoke tests + manual device testing |
| **Config file** | `nakama/smoke-test.sh` — created in Plan 03 Task 3 |
| **Quick run command** | `curl -f https://$NAKAMA_HOST/healthcheck` |
| **Full suite command** | `bash nakama/smoke-test.sh` (register → clubs → pibe → profanity → delete) |
| **Estimated runtime** | ~30 seconds (automated); ~10 min (manual device) |

---

## Sampling Rate

- **After every task commit:** Run `curl -f https://$NAKAMA_HOST/healthcheck`
- **After every plan wave:** Run `bash nakama/smoke-test.sh`
- **Before `/gsd-verify-work`:** Full suite must be green + manual device smoke
- **Max feedback latency:** 30 seconds (automated); manual steps documented below

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-infra-01 | 01 | 0 | TEC-02 | — | Nakama health endpoint returns 200 | smoke | `curl -f $NAKAMA_HOST/healthcheck` | ✅ via Plan 01 T4 | ⬜ pending |
| 1-ci-01 | 01 | 0 | TEC-01 | — | GitHub Actions CI green on push (Android only) | CI | GitHub Actions check | ✅ via Plan 01 T3 | ⬜ pending |
| 1-auth-01 | 03 | 2 | ONB-01 | T-1-01 | Registration creates account | integration | `curl POST /v2/account/authenticate/email?create=true` | ✅ via smoke-test.sh | ⬜ pending |
| 1-auth-02 | 03 | 2 | ONB-01 | T-1-02 | Login returns valid session token | integration | `curl POST /v2/account/authenticate/email?create=false` | ✅ via smoke-test.sh | ⬜ pending |
| 1-auth-03 | 03 | 2 | ONB-01 | T-1-03 | Profanity pibe name rejected server-side | integration | `curl POST /v2/rpc/create_pibe -d '{"name":"hijo de puta"}'` | ✅ via smoke-test.sh | ⬜ pending |
| 1-auth-04 | 03 | 2 | PRV-03 | — | Account deletion RPC removes account | integration | `curl POST /v2/rpc/delete_account` | ✅ via smoke-test.sh | ⬜ pending |
| 1-clubs-01 | 03 | 2 | CLB-01, ONB-02 | — | 130+ clubs seeded in Nakama Storage | integration | `curl POST /v2/rpc/get_clubs -d '{"page":1}'` returns 130+ | ✅ via smoke-test.sh | ⬜ pending |
| 1-pibe-01 | 03 | 2 | ONB-04 | T-1-04 | Pibe created with fixed stats (server-side) | integration | `curl POST /v2/rpc/create_pibe` → verify stats in response | ✅ via smoke-test.sh | ⬜ pending |
| 1-forgot-01 | 04 | 3 | D-03 | T-1-RT-02 | ForgotPasswordScreen UI calls RPC + shows uniform anti-enumeration response | manual + integration | Device tap "¿Olvidaste tu contraseña?" → ForgotPasswordScreen → submit | ✅ via Plan 04 T2 | ⬜ pending |
| 1-reset-01 | 05 | 3 | D-03, PRV-03 | T-1-WEB-02 | Reset HTML page uses Bearer token (NOT exposed server key) and changes password | manual + integration | Email reset link → form submit → re-login with new pw | ✅ via Plan 05 T1+T4 | ⬜ pending |
| 1-privacy-01 | 05 | 3 | PRV-01 | — | Privacy policy URL accessible without login | manual | Open URL in browser — no auth required | manual | ⬜ pending |
| 1-disclaimer-01 | 04 | 3 | CLB-02 | — | Fiction disclaimer on first launch, not on re-launch | manual | Fresh install → see splash; relaunch → no splash | manual | ⬜ pending |
| 1-session-01 | 02 | 1 | ONB-01 | T-1-05 | Auto-login works on app restart | manual | Kill app → reopen → already logged in | manual | ⬜ pending |
| 1-serverkey-01 | 03 | 2 | TEC-09 (CHK-07) | — | NakamaClient.gd server key matches Railway env var | manual | `bash nakama/smoke-test.sh` with NAKAMA_KEY=$REAL_KEY → all pass | ✅ via Plan 03 T3 | ⬜ pending |
| 1-ios-defer-01 | 01 | 0 | TEC-08 (revised) | — | iOS CI workflow formally deferred to Phase 7 | doc | `test -f .planning/phases/01-foundation/DEFERRED-IOS-CI.md` | ✅ via Plan 01 T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (closed)

- [x] `nakama/smoke-test.sh` — smoke test script (created in Plan 03 Task 3)
- [x] `.github/workflows/build-android-debug.yml` — CI pipeline for TEC-01 (Android only — iOS deferred to Phase 7 per DEFERRED-IOS-CI.md)
- [x] Nakama instance on Railway operational — covers TEC-02, TEC-03 (Plan 01 Task 4)
- [x] `nakama/data/clubs.json` seeded — covers CLB-01, ONB-02 (Plan 03 Task 1; deploy in Plan 03 Task 3)

*Wave 0 is infrastructure-only — no test framework to install. Tests run via curl against live Railway instance.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fiction disclaimer shows on first launch only | CLB-02 | UI state (ConfigFile flag) — no API to test | Fresh install → open app → verify SplashScreen shows disclaimer. Restart app → verify disclaimer not shown again. |
| Privacy policy link opens browser pre-login | PRV-01 | UI interaction — no curl equivalent | Open app → tap "Política de privacidad" link on registro tab → verify OS browser opens policy URL. |
| Auto-login on app restart | ONB-01 | Mobile device state required | Login → kill app process → reopen → verify already logged in (no login screen shown). |
| Club picker search/filter works | ONB-02 | UI — client-side filter | Open club picker → type partial club name → verify list narrows. Change division filter → verify list changes. |
| Forgot password UI entry point | D-03 (CHK-02) | UI nav | AuthScreen → tap "¿Olvidaste tu contraseña?" → ForgotPasswordScreen → submit email → confirm uniform status message |
| Reset password email → HTML → re-login | D-03 (CHK-06) | External email + browser | ForgotPasswordScreen submit → check inbox → tap link → submit new pw on HTML page → re-login app with new pw |
| iOS IPA builds locally (deferred to Phase 7 CI) | TEC-08 revised | No macOS GitHub runner in Phase 1 — cost-deferred to Phase 7 per DEFERRED-IOS-CI.md | On developer Mac: Godot export → Xcode archive → confirm no errors. Phase 7 will replace this with `build-ios-release.yml`. |

---

## Threat Model (ASVS Level 1)

| Threat ID | Category | Threat | Mitigation in Plans |
|-----------|----------|--------|---------------------|
| T-1-01 | Account enumeration | Password reset reveals if email exists | Always return same response regardless of email existence (Plan 03 RPC + Plan 04 UI + Plan 05 HTML) |
| T-1-02 | Credential stuffing | Bot accounts via registration | Rate limit registration endpoint in Nakama server config (Plan 03 local.yml) |
| T-1-03 | Input injection | Pibe name with XSS/SQL injection | Server-side deny list + Nakama Storage handles escaping (Plan 03 validatePibeName) |
| T-1-04 | Stat manipulation | Client sends fake stats on pibe creation | Stats assigned 100% server-side, client input ignored for stats (Plan 03 create_pibe + Plan 04 PibeCreatorScreen) |
| T-1-05 | Token replay | Reuse session token after logout | Nakama token invalidation on logout + refresh token rotation (Plan 02 AuthManager) |
| T-1-WEB-02 | Token leak via public JS | Reset HTML page exposes server key in public source | Plan 05 redesigned: device auth → Bearer token → RPC (CHK-06 fix) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (closed by Plans 01 + 03)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (automated)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter (closed by Plan 03 Task 3 deploy)

**Approval:** signed off via Plan 03 Task 3 (2026-05-15) — see `01-03-PLAN.md` must_haves. Wave 0 deliverables: build-android-debug.yml (P01), nakama/smoke-test.sh (P03), Railway Nakama operational (P01 T4), clubs.json seeded (P03). iOS CI explicitly out-of-scope for Phase 1 per `DEFERRED-IOS-CI.md`.
