---
plan_id: 02-03
phase: 2
status: complete
completed_at: 2026-05-18T18:08:00Z
commits:
  - 19ca71f feat(02-03): FCM v1 push integration — OAuth2 JWT, topic validator, real sendTopic wired
files_modified:
  - nakama/src/integrations/fcm.ts (new)
  - nakama/src/util/topic_name.ts (new)
  - nakama/src/rpc/admin_test_validate_topic.ts (new)
  - nakama/src/scheduler/windows.ts (stub removed + real import)
  - nakama/src/main.ts (register admin_test_validate_topic)
requirements_satisfied: [DAY-03]
---

# Plan 02-03 — FCM v1 Push Integration

## What Built

`integrations/fcm.ts` ships the complete FCM v1 send-to-topic flow: GCP service-account loaded from `FCM_SERVICE_ACCOUNT_B64`, RS256 JWT signed via `nk.jwtGenerate`, OAuth2 access_token exchanged at `oauth2.googleapis.com/token` and cached server-side with 60-second safety margin, push POSTed to `fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send` with bare topic name (v1 spec).

`util/topic_name.ts` validates topic names against `[a-zA-Z0-9_.~%-]+` + 900-char cap. Called from `sendTopic` BEFORE any HTTP work — invalid names return false and log warn without burning quota.

`rpc/admin_test_validate_topic.ts` exposes `validateTopicName` over RPC for the test harness (VALIDATION.md 02-04-DAY03-topic). Double-gated: `ADMIN_TEST_MODE=true` env + bearer-token via `requireAdmin`.

`scheduler/windows.ts` no longer carries the stub. Single import line `import { sendTopic } from '../integrations/fcm';` replaces the ~20-line dead stub from plan 02-02. D-13 payload (title `¡Ventana abierta!`, body `Tu club juega ahora. Mové el orto al aguantadero.`, `type:"window_open"` + `fixture_id` + `club_id` + `kickoff_utc` + `closes_at`) preserved verbatim; data values already cast to strings (FCM v1 requirement).

`main.ts` registers `admin_test_validate_topic` RPC. Total RPCs: 6 (5 Phase 1 + 1 new). The other Phase 2 RPCs land in plans 02-05/02-06.

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` clean (no filters) | exits 0 |
| `npm run build` | 88.9kb (was 83.1kb after 02-02) |
| `grep nk.jwtGenerate fcm.ts` | 1 hit |
| `grep base64ToUtf8 fcm.ts` | 2 hits (def + call) |
| `grep FCM_PROJECT_ID fcm.ts` | 1 hit |
| `grep validateTopicName fcm.ts` | 1 hit |
| `grep "/topics/" fcm.ts` | 0 hits ✓ (v1 API — bare name) |
| `grep TOPIC_ALLOWED_RE topic_name.ts` | 1 hit |
| `grep test_mode_disabled admin_test_validate_topic.ts` | 1 hit |
| `grep admin_test_validate_topic main.ts` | 1 hit |
| `grep "[fcm][stub]" windows.ts` | 0 hits ✓ stub gone |
| `grep "¡Ventana abierta!" windows.ts` | 1 hit ✓ D-13 preserved |
| `grep "Mové el orto" windows.ts` | 1 hit |
| `grep "from '../integrations/fcm'" windows.ts` | 1 hit |

## Must-Haves

- ✅ Service account loaded from `FCM_SERVICE_ACCOUNT_B64`; `base64ToUtf8` helper handles Goja ArrayBuffer→string.
- ✅ OAuth2 token via `nk.jwtGenerate('RS256', ...)` + POST to oauth2.googleapis.com/token.
- ✅ Token cached in `meta:fcm_oauth_token`, `expires_at = now + (expires_in - 60) * 1000`.
- ✅ `sendTopic` sends bare topic name (not `/topics/` prefix — v1 API).
- ✅ `validateTopicName` rejects invalid chars before any FCM call.
- ✅ Push payload D-13 preserved (title + body + data shape).
- ✅ Anti-spam handled in windows.ts `notified_open_at` marker (set in same `storageWrite` as state transition — plan 02-02 already in place).
- ✅ `windows.ts` stub replaced with real import.
- ✅ `admin_test_validate_topic` RPC exists, ADMIN_TEST_MODE-gated, returns `{ok, normalized?, error?}`.

## Threat Disposition

| Threat ID | Disposition | Implemented? |
|-----------|-------------|--------------|
| T-2-FCM-01 (topic spoofing) | mitigate | ✅ validateTopicName before HTTP |
| T-2-FCM-02 (double-push DoS) | mitigate | ✅ notified_open_at marker (in 02-02 already) |
| T-2-FCM-03 (service-account leak) | mitigate | ✅ loaded once, used, discarded; never logged |
| T-2-FCM-04 (cached token tamper) | accept | ✅ COL_META permissionRead:0 |
| T-2-INJ-01 (topic injection from club_id) | mitigate | ✅ regex enforced; warn+skip on violation |

## Deviations

- Plan said "Update the logger.info count to 15 RPCs" — that count counts future plan 02-04/05/06 RPCs. Used accurate count (6 RPCs total after this plan). Plans 02-04/05/06 will increment as they each register more.
- Added explicit `try/catch` around `getAccessToken` in `sendTopic` — caller logs warn + returns false instead of propagating. Matches the existing graceful-degradation pattern (missing key → return false).

## Risks Carried Forward

- Real Android push delivery requires plan 02-07 (FCM Android plugin) before end-to-end smoke. Server-side path is complete; device-side wiring is Wave 2.
- `admin_inject_test_fixture` (created in 02-01) is NOT yet registered in main.ts — gets registered alongside other admin RPCs in plan 02-05.

## Next

Plan 02-04: Resend wiring un-stub (Phase 1 carryover — `request_password_reset` + `confirm_password_reset` real token gen behind `RESEND_ENABLED` flag).
