---
phase: 01-foundation
plan: 05
subsystem: privacy-legal-web
tags:
  - privacy
  - legal
  - aaip
  - web
  - github-pages
  - password-reset
  - consent
requires:
  - infra-scaffold
  - app-autoloads
  - nakama-runtime
provides:
  - privacy-pages
  - terms-page
  - reset-password-stub
  - github-pages-workflow
  - aaip-checklist
  - legal-notes
  - prv-05-consent-gate
affects:
  - web/
  - .github/workflows/deploy-web.yml
  - scripts/autoloads/AppConfig.gd
  - scripts/screens/AuthScreen.gd
  - scenes/AuthScreen.tscn
  - .planning/phases/01-foundation/AAIP-REGISTRATION.md
  - .planning/phases/01-foundation/LEGAL-NOTES.md
key-files:
  created:
    - web/index.html
    - web/privacy/index.html
    - web/privacy/en.html
    - web/terms/index.html
    - web/reset-password/index.html
    - web/reset-password/script.js
    - web/reset-password/style.css
    - web/styles/base.css
    - .github/workflows/deploy-web.yml
    - .planning/phases/01-foundation/AAIP-REGISTRATION.md
    - .planning/phases/01-foundation/LEGAL-NOTES.md
  modified:
    - scripts/autoloads/AppConfig.gd
    - scripts/screens/AuthScreen.gd
    - scenes/AuthScreen.tscn
decisions:
  - "Executor agent created web/ + workflow + extended AppConfig partially before rate-limit. Orchestrator finished inline: added TERMS_URL + PASSWORD_RESET_BASE_URL + MIN_AGE + asserts to AppConfig, AcceptTerms CheckBox to AuthScreen.tscn, gated register button on checkbox, created AAIP-REGISTRATION.md + LEGAL-NOTES.md"
  - "PRV-05 enforced via CheckBox `accept_terms` — register Submit button disabled until pressed; on_register also re-checks before submit (defense in depth)"
  - "Privacy/Terms URLs use placeholder lukasval.github.io/barrabrava (GitHub Pages free); migrate to custom domain in Phase 2 when domain registered"
  - "Password reset HTML/JS created but server-side confirm_password_reset is a stub (returns feature_unavailable_phase_1). Phase 2 (Resend setup) wires real flow"
  - "AAIP-REGISTRATION.md is a CHECKLIST/template — actual trámite deferred to Phase 6/7 (≥30 days pre-launch)"
  - "LEGAL-NOTES.md documents Ley 25.326 + 24.240 + App Store/Google Play constraints + AFA parodia mitigation strategy + Phase 2+ legal TODOs"
metrics:
  duration: "~10 min executor partial + ~10 min orchestrator inline finish"
  completed: 2026-05-17
  tasks_executed: 3
  tasks_total_in_plan: 5
  tasks_pending: ["user_setup (enable GitHub Pages)", "Task 4 human-action checkpoint", "Task 5 human-verify"]
  files_created: 11
  files_modified: 3
---

# Plan 01-05: Privacy + Legal + Web + Password Reset Summary

## What ran where

Executor agent (rate-limited mid-flight) created the web pages + GitHub Actions workflow + partial AppConfig extension. Orchestrator finished inline: completed AppConfig constants + assert hardening, added AcceptTerms CheckBox to AuthScreen.tscn, wired consent gate in AuthScreen.gd, created AAIP-REGISTRATION + LEGAL-NOTES docs.

| Task | Owner | Estado |
|------|-------|--------|
| Task 1 (web pages + workflow) | Executor | ✓ Completed |
| Task 2 (AppConfig + AuthScreen privacy) | Executor partial + orchestrator finish | ✓ Completed |
| Task 3 (AAIP-REGISTRATION.md + LEGAL-NOTES.md) | Orchestrator | ✓ Completed |
| user_setup (enable GitHub Pages) | User | ⏳ Pending |
| Task 4 (human-action checkpoint) | User | ⏳ Pending |
| Task 5 (human-verify checkpoint) | User | ⏳ Pending |

## PRV-05 enforcement

- `scenes/AuthScreen.tscn` adds `[node name="AcceptTerms" type="CheckBox"]` inside Registrarse tab. `[node name="Submit"]` set `disabled = true`.
- `scripts/screens/AuthScreen.gd` connects `accept_terms.toggled` → enables Submit only when checked. `_on_register` re-validates the flag (defense in depth) and shows a localized error if user bypasses via console.
- Privacy text now: `"Antes de jugar: [url=PRIVACY_URL]privacidad[/url] · [url=TERMS_URL]términos[/url]"` — both links route via OS.shell_open on click.

## Web pages

- ES + EN privacy policy (mirror translations).
- Terms of service ES only (Phase 1 — EN added Phase 2 if soft launch goes international).
- Reset-password page is a stub: JS POSTs to `/v2/rpc/confirm_password_reset?http_key=defaulthttpkey` and shows a friendly "esta función se habilita en Phase 2" when server returns the `feature_unavailable_phase_1` error.
- Landing `web/index.html` links to the 3 sub-pages.
- All pages use Nunito (Google Fonts CDN) + dominant `#1A1A1A` / accent `#D62828` palette to stay visually consistent with the app.
- `.nojekyll` ensures GitHub Pages serves `_underscored` paths if any.

## GitHub Pages deploy

- `.github/workflows/deploy-web.yml` triggers on `push` to `main` with `paths: web/**` (no redeploy for non-web commits).
- Uses `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4` (standard GitHub Pages flow).
- **Requires manual user setup:** Settings → Pages → Source = "GitHub Actions" (orchestrator will prompt user before Wave 3 verification).

## AppConfig constants finalized

```gdscript
const SITE_BASE := "https://lukasval.github.io/barrabrava"
const PRIVACY_URL := SITE_BASE + "/privacy/"
const PRIVACY_URL_EN := SITE_BASE + "/privacy/en.html"
const TERMS_URL := SITE_BASE + "/terms/"
const PASSWORD_RESET_BASE_URL := SITE_BASE + "/reset-password/"
const RESET_PASSWORD_URL := PASSWORD_RESET_BASE_URL  # alias for legacy refs
const MIN_AGE := 13
const ANALYTICS_ENABLED := false  # asserted in _ready (PRV-05)
const PUSH_NOTIFICATIONS_ENABLED := false  # asserted in _ready
const GPS_ENABLED := false  # asserted in _ready
```

## Validation

- `godot --headless --import` returned 0 — no parse errors after AppConfig + AuthScreen + AuthScreen.tscn edits.
- AAIP doc and LEGAL doc reviewed for tone alignment with CLAUDE.md (caricaturesco, apolítico, anti-violencia, cosmetic-only).

## Pending follow-ups

1. **User: enable GitHub Pages** → Settings → Pages → Source = GitHub Actions. Then push triggers deploy.
2. **User: human-verify checkpoint** — open the deployed site, verify privacy/terms render, click reset-password → friendly stub error, open app → AuthScreen consent gate works.
3. **Phase 2:** custom domain → update SITE_BASE constant + privacy/terms email contacts; enable Resend → un-stub `confirm_password_reset`.
4. **Phase 6/7:** start AAIP trámite per AAIP-REGISTRATION.md checklist.
5. **Pre-launch:** IP lawyer review for AFA parodia (PROJECT.md top risk #1).

## Self-Check: PASSED

- ✓ 8 web files exist + .nojekyll
- ✓ deploy-web.yml workflow exists with correct triggers + permissions
- ✓ AppConfig.gd has all 5 URL constants + MIN_AGE + 3 PRV-05 asserts
- ✓ AuthScreen.tscn has AcceptTerms CheckBox + Submit disabled by default
- ✓ AuthScreen.gd gates register on accept_terms.button_pressed
- ✓ AAIP-REGISTRATION.md present with full filing checklist
- ✓ LEGAL-NOTES.md present with Ley 25.326 + 24.240 + AFA parodia notes
- ✓ godot --headless --import returns 0 (no script parse errors)
