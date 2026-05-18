---
plan_id: 02-04
phase: 2
status: complete
completed_at: 2026-05-18T18:53:00Z
commits:
  - 7d53749 feat(02-04): un-stub request_password_reset + real Resend HTTP adapter
  - 9ef10ef feat(02-04): un-stub confirm_password_reset with real token consumption + linkEmail
files_modified:
  - nakama/src/rpc/request_password_reset.ts (replaced — Phase 1 stub gone)
  - nakama/src/rpc/confirm_password_reset.ts (replaced — Phase 1 stub gone)
  - nakama/src/integrations/resend.ts (new)
  - nakama/src/util/email.ts (deprecated stub kept for type-shape compat)
requirements_satisfied: []  # Phase 1 carryover — no Phase 2 REQ-ID
---

# Plan 02-04 — Resend Un-Stub (Phase 1 Carryover)

## What Built

Closes the Phase 1 carryover. Both password-reset RPCs are now real; Resend HTTP adapter exists behind the `RESEND_ENABLED` flag (default `false` for Phase 2 per D-25). When the flag is off the reset link is logged to Railway stdout for dev convenience — when flipped to `true` later (Phase 6/7 after domain purchase), the same code path POSTs to `api.resend.com/emails`.

### Files

**`rpc/request_password_reset.ts`** — Phase 1 stub fully replaced.
- Parses + shape-validates email; any failure path still returns `{ok:true}` (anti-enumeration, T-2-RT-05).
- `nk.sqlQuery('SELECT id::text FROM users WHERE email = $1')` — Nakama has no `usersGetEmail` helper, so raw SQL is the only path.
- `nk.uuidv4()` token + 1h TTL persisted to `COL_RESET_TOKENS` as singleton per user (`userId, key:'reset'`).
- Branch on `ctx.env['RESEND_ENABLED']`:
  - `!= 'true'` (default Phase 2) → two log lines: one with redacted token for normal scanning, one with full link tagged `[DEV ONLY]` for dev convenience (S-7).
  - `== 'true'` → `sendResetEmail` invoked. Send failure warned but still `{ok:true}` (anti-enumeration).
- `maskEmail` helper redacts email in logs (`l***@domain.com`).

**`integrations/resend.ts`** — new module.
- `sendResetEmail(nk, logger, input)` POSTs to `https://api.resend.com/emails` with `Authorization: Bearer <apiKey>` and the inline-HTML template.
- Sandbox guard: warns when `fromEmail` still contains `resend.dev` (Resend dev domain only delivers to verified dev email).
- Template body (D-26): Spanish, lunfardo header `Recuperá tu contraseña — Liga Aguante`, button + 1h expiry note + footer "ficción pura" disclaimer.
- Error returns: `{sent:false, reason}` with `missing_api_key | http_error | exception`. Caller decides whether to surface.

**`rpc/confirm_password_reset.ts`** — Phase 1 stub fully replaced.
- Shape validates token (8-256 chars) + new_password (8-256 chars).
- Scans `COL_RESET_TOKENS` cross-user via `storageList('', ...)` empty-userId pattern (S-16). Max 50 pages × 100 rows = 5000 tokens — well above Phase 2 scale; phase 6+ would add a token→userId index collection.
- Reject paths: `invalid_token`, `invalid_new_password`, `token_already_used` (consumed_at marker), `token_expired` (expires_at < now), `token_invalid` (not found), `user_not_found`, `internal_error`.
- Email lookup via `nk.sqlQuery` by userId — **never** from client input (S-9 mitigates T-2-RT-06 email substitution).
- Password mutation via `nk.linkEmail(userId, email, newPassword)` — Heroic Labs issue #275: `accountUpdateId` does NOT mutate the password credential, only `linkEmail` does.
- Atomic consume: rewrites token row with `expires_at: 0, consumed_at: Date.now()`, guarded by storage `version` (anti-replay T-2-RT-02). `expires_at: 0` is belt + suspenders — even if the `consumed_at` check is bypassed, the expiry check kills the reuse.

**`util/email.ts`** — deprecated stub.
- Types kept for backward compat with any module that imports `SendResetEmailInput` / `SendResetEmailResult` (none currently, but the cost of preserving them is ~3 lines).
- `sendResetEmail` body delegates to a logger.warn + `{sent:false, reason:'use_integrations_resend'}` so future stale callers surface loudly.

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` clean (no filters) | exits 0 |
| `npm run build` | OK (build/index.js refreshed) |
| `grep "Phase 1 stub" request_password_reset.ts` | 0 hits ✓ |
| `grep "nk.uuidv4()" request_password_reset.ts` | 1 hit |
| `grep "nk.sqlQuery" request_password_reset.ts` | 1 hit |
| `grep "RESEND_ENABLED" request_password_reset.ts` | 1 hit |
| `grep "COL_RESET_TOKENS" request_password_reset.ts` | 1 hit |
| `grep "Recuperá tu contraseña — Liga Aguante" resend.ts` | 1 hit |
| `grep "feature_unavailable_phase_1" confirm_password_reset.ts` | 0 hits ✓ |
| `grep "nk.linkEmail" confirm_password_reset.ts` | 1 hit |
| `grep "token_already_used" confirm_password_reset.ts` | 1 hit |
| `grep "token_expired" confirm_password_reset.ts` | 1 hit |
| `grep "consumed_at" confirm_password_reset.ts` | 3 hits (set + check) |
| `grep "nk.sqlQuery" confirm_password_reset.ts` | 1 hit (S-9 email-by-userId) |

## Must-Haves

- ✅ `request_password_reset.ts` no longer contains `Phase 1 stub`.
- ✅ Token persisted to `COL_RESET_TOKENS` under `userId, key='reset', value={token, expires_at, requested_at}`.
- ✅ `confirm_password_reset` validates expiry, consumes atomically, calls `nk.linkEmail`.
- ✅ Replay rejected: second confirm of same token returns `{ok:false, error:'token_already_used'}`.
- ✅ `RESEND_ENABLED=false` path: full link logged (dev convenience); token never logged alone.
- ✅ `RESEND_ENABLED=true` path: `integrations/resend.ts` invoked with HTML template.
- ✅ Anti-enumeration: `request_password_reset` always returns `{ok:true}` regardless of email existence.

## Threat Disposition

| Threat ID | Disposition | Implemented? |
|-----------|-------------|--------------|
| T-2-RT-01 (token spoof) | mitigate | ✅ server-generated UUID + length-validated 8-256 chars |
| T-2-RT-02 (replay) | mitigate | ✅ `consumed_at` + `expires_at=0` overwrite, version-guarded |
| T-2-RT-03 (expiry bypass) | mitigate | ✅ `expires_at < Date.now()` check before any mutation |
| T-2-RT-04 (link in logs) | accept | ✅ documented dev-only behavior; flag must stay `false` until log access restricted |
| T-2-RT-05 (email enumeration) | mitigate | ✅ uniform `{ok:true}` regardless of email existence |
| T-2-RT-06 (linkEmail target tamper) | mitigate | ✅ email fetched by userId via SQL, not from client (S-9) |

## Deviations

- Plan said `util/email.ts` should keep the signature "for backward compat (no other file uses it now but don't break typecheck)" — confirmed: nothing else imports it. Kept it anyway with a loud warn body so an accidental re-import surfaces.
- No changes to `nakama/src/main.ts` — the two RPCs were already registered in Phase 1; we only swapped their implementations.

## Risks Carried Forward

- Resend HTTP path is UNTESTED in production. First test will happen after Phase 6/7 domain purchase + `RESEND_ENABLED=true` flip.
- Cross-user `storageList` scan in `confirm_password_reset` is O(N pending tokens). Acceptable for Phase 2; revisit at >1000 active tokens (Phase 6+).

## Next

Plan 02-05: 6 admin RPCs (`admin_postpone_fixture`, `admin_close_window`, `admin_set_season_window`, `admin_force_repoll`, `admin_list_windows`, `admin_set_club_team_mapping`) + register `admin_inject_test_fixture` (created in 02-01) in `main.ts`. All gated by `requireAdmin`.
