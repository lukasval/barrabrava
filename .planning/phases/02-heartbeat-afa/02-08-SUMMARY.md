---
plan_id: 02-08
phase: 2
status: complete
completed_at: 2026-05-18T19:18:00Z
commits:
  - "feat(02-08): flip push flag + extend autoloads with FCM/window wiring"
  - "feat(02-08): wire HomeScreen WindowBanner + FlowRouter.confirm_club_pick"
files_modified:
  - scripts/autoloads/AppConfig.gd
  - scripts/autoloads/PlayerStore.gd
  - scripts/autoloads/NakamaService.gd
  - scripts/autoloads/FlowRouter.gd
  - scripts/screens/ClubPickerScreen.gd
  - scripts/screens/HomeScreen.gd
  - scenes/HomeScreen.tscn
requirements_satisfied: [DAY-03, CMB-01]
---

# Plan 02-08 — Godot Push UX

## What Built

Godot client side of the Phase 2 heartbeat. Flips the push flag, wires the FCM signal pipeline, surfaces the match window on HomeScreen with division-aware copy.

### Files

**`autoloads/AppConfig.gd`**
- `PUSH_NOTIFICATIONS_ENABLED` flipped to `true`.
- The Phase-1 `assert(not PUSH_NOTIFICATIONS_ENABLED, ...)` line removed; the analytics + GPS asserts kept (those gates still apply for later phases).
- New `FCM_TOPIC_PREFIX := "club_"` — same prefix the server-side `sendTopic` validator expects.
- `_ready` print line extended with `topic_prefix=%s`.

**`autoloads/PlayerStore.gd`**
- New fields:
  - `club_division: String` (filled by `load_from_server` from `club.division`; needed for the "Coming soon" lower-division gate).
  - `subscribed_topics: Array[String]` (idempotency tracking for `subscribe_to_club_topic`).
  - `current_window: Dictionary` (latest `get_current_window` response cache).
- `clear()` resets all three plus the existing `club_*` / `pibe_*` fields.

**`autoloads/NakamaService.gd`**
- `_ready` now also calls `_wire_fcm_plugin()` (gated by `AppConfig.PUSH_NOTIFICATIONS_ENABLED`).
- `_wire_fcm_plugin`: looks up `Engine.get_singleton("FCMPlugin")`. When absent (non-Android builds, plugin missing) — emits `push_warning` and returns. When present — connects `on_token_received` once and calls `fcm.getToken()` to force the initial emission (some FCM SDKs only emit on refresh).
- `_on_fcm_token_received(token)`: ignores empty tokens, otherwise calls `register_fcm_token.call_deferred(token, "android")` so the signal handler stays sync-safe.
- Three new async wrappers:
  - `register_fcm_token(token, platform) -> Dictionary` — auth-gated; POSTs to the Phase 2 RPC; returns `{ok, data}` or `{ok:false, error}`.
  - `subscribe_to_club_topic(club_id) -> Dictionary` — guards on `PUSH_NOTIFICATIONS_ENABLED` + non-empty `club_id`; dedups via `PlayerStore.subscribed_topics`; calls `FCMPlugin.subscribeToTopic(topic)` and records the topic locally.
  - `get_current_window() -> Dictionary` — auth-gated; POSTs to the Phase 2 RPC with empty payload.

**`autoloads/FlowRouter.gd`**
- New `confirm_club_pick(club_id)` entry — does `NakamaService.subscribe_to_club_topic(club_id)` then `go_pibe_creator()`. Single centralised post-club-pick site.

**`screens/ClubPickerScreen.gd`**
- `_on_cta` updated to call `FlowRouter.confirm_club_pick(_selected_club_id)` instead of raw `go_pibe_creator()`.

**`screens/HomeScreen.gd`**
- New `@onready var window_banner` + `_LOWER_DIVISIONS` constant array (`["b_metro", "federal_a", "c_metro"]`).
- `_ready` extended: sets `window_banner.text = "Cargando..."` and calls `_refresh_window()`.
- `_notification(what)` (underscore prefix — Godot 4 virtual contract): on `NOTIFICATION_APPLICATION_RESUMED` re-subscribes the club topic (idempotent) and re-fetches the window.
- `_refresh_window()`: awaits `NakamaService.get_current_window()`, stores result in `PlayerStore.current_window`, calls `_update_window_banner()`.
- `_update_window_banner()`: branches on `state` ∈ {scheduled, open, live, closed, cancelled} or empty. Empty + lower-division → "Coming soon — sin partidos vivos esta season" (muted blue). Empty + primera/nacional → "Sin partidos próximos." (grey). Scheduled → `"Falta para que abra la ventana: HH:MM"` (gold). Open/live → "¡Ventana abierta! Tu club juega ahora." (green). Closed/cancelled → "Ventana cerrada. Próximo partido próximamente." (grey).

**`scenes/HomeScreen.tscn`**
- `WindowBanner` Label node inserted between `Content/Empty` and `Content/DeleteAccount`. `custom_minimum_size = Vector2(0, 40)`, centered both axes, font size 16, initial text `"Cargando..."`.

## Verification

| Check | Result |
|-------|--------|
| `grep "PUSH_NOTIFICATIONS_ENABLED := true" AppConfig.gd` | 1 hit |
| `grep "push must stay off in Phase 1" AppConfig.gd` | 0 hits ✓ |
| `grep FCM_TOPIC_PREFIX AppConfig.gd` | 3 hits |
| `grep subscribed_topics PlayerStore.gd` | 2 hits |
| `grep current_window PlayerStore.gd` | 2 hits |
| `grep on_token_received NakamaService.gd` | 2 hits |
| `grep subscribe_to_club_topic NakamaService.gd` | 1 hit |
| `grep subscribeToTopic NakamaService.gd` | 1 hit |
| `grep getToken NakamaService.gd` | 1 hit |
| `grep subscribe_to_club_topic FlowRouter.gd` | 2 hits (comment + call) |
| `grep WindowBanner HomeScreen.gd` | 1 hit |
| `grep "func _notification" HomeScreen.gd` | 1 hit |
| `grep "Coming soon" HomeScreen.gd` | 1 hit |
| `grep WindowBanner HomeScreen.tscn` | 1 hit |

## Must-Haves

- ✅ AppConfig push flag flipped + PRV-05 assert removed for push.
- ✅ FCM_TOPIC_PREFIX constant added.
- ✅ NakamaService: 3 new methods + FCMPlugin signal wiring + getToken().
- ✅ PlayerStore: subscribed_topics + current_window fields + clear() resets them.
- ✅ FlowRouter.confirm_club_pick wraps subscribe + navigation.
- ✅ ClubPickerScreen calls FlowRouter.confirm_club_pick.
- ✅ HomeScreen.gd: _refresh_window on _ready + on NOTIFICATION_APPLICATION_RESUMED.
- ✅ HomeScreen.gd: "Coming soon" for b_metro/federal_a/c_metro divisions.
- ✅ HomeScreen.gd: `func _notification(what: int)` (underscore prefix).
- ✅ HomeScreen.tscn: WindowBanner Label under Content.

## Threat Disposition

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-2-FCM-03 (token leak in client logs) | mitigate | Token never logged — `_on_fcm_token_received` only checks `is_empty` then forwards to register RPC; error path uses `push_warning` with RPC error message, never the token value. |
| T-2-FCM-05 (topic spoof from client) | mitigate | Topic built from `AppConfig.FCM_TOPIC_PREFIX + PlayerStore.club_id` (both server-influenced). Server `sendTopic` also runs `validateTopicName` (plan 02-03). |
| T-2-FCM-06 (repeated subscribe DoS) | mitigate | `PlayerStore.subscribed_topics.has(topic)` dedup; `clear()` resets on logout. |
| T-2-CACHE-01 (stale banner) | accept | `PlayerStore.current_window` is server-authoritative; refresh happens on _ready + app resume; ≤15min stale window is acceptable per plan. |

## Deviations

- **FlowRouter wiring**: plan said to add the subscribe call inside FlowRouter itself, but FlowRouter is a generic scene-navigation autoload with no inherent post-club hook. Added a new `confirm_club_pick(club_id)` helper instead, and updated `ClubPickerScreen._on_cta` to call it. Keeps FCM subscribe pinned to a single site.
- **`club_division` field**: plan note said "if PlayerStore does not currently have `club_division`, add it". Added — alongside other Phase 2 additions in PlayerStore.gd. `load_from_server` now reads `club.division` from the COL_CLUBS record.
- **Godot type tightening**: a few `var x = await ...` patterns rewritten as `var x := await ...` (Godot 4 strict typing — `Dictionary` return type lets the compiler infer the LHS).

## Risks Carried Forward

- **FCMPlugin singleton is plan 02-07's deliverable** — currently absent in the repo. Without it, `_wire_fcm_plugin` returns early with `push_warning` and `subscribe_to_club_topic` returns `{ok:false, error:"fcm_unavailable"}`. The Godot project still runs (no crash) on macOS/Web/editor builds; HomeScreen still renders the banner using `get_current_window` data alone. **Plan 02-07 unblocks real push delivery on device.**
- **`get_current_window` returns the cached window** but the seconds_until_open countdown is computed once at fetch time and does not tick down on the client. Acceptable for v1 (auto-refresh on app resume); a follow-up could add a 60-second timer in `HomeScreen.gd` to decrement the displayed value.

## Next

Plan 02-09: validation harness (`nakama/test/heartbeat-test.sh`) covering all Phase 2 invariants (CLB-03..05, SEA-01..02, CMB-01, DAY-03) + admin curl examples + INFRA-NOTES Phase 2 sections.
