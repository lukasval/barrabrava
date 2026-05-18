// Centralized Nakama Storage collection + key constants (WR-08).
//
// Source of truth for the names used in:
//   - server: nk.storageRead / nk.storageWrite / nk.storageDelete / nk.storageList
//   - client: NakamaClient.read_storage_objects_async / write_storage_objects_async
//
// The client mirror lives in scripts/autoloads/StorageKeys.gd. Any change here
// MUST be reflected on the client side or storage reads silently return empty
// results (CR-01 was exactly this kind of drift bug).

export const COL_PIBES = 'pibes';
export const COL_PLAYERS = 'players';
export const COL_CLUBS = 'clubs';
export const COL_RESET_TOKENS = 'reset_tokens';
export const COL_META = 'meta';

// Per-user fixed-slot keys (Phase 1 = 1 pibe per account; profile is a singleton).
export const KEY_PIBE_MAIN = 'main';
export const KEY_PLAYER_PROFILE = 'profile';

// Postgres nil UUID — used as userId for system-owned (public-read) collections
// like 'clubs' and 'meta'. Nakama does not have a literal "system user" so we
// store under the conventional nil UUID and rely on permissionRead/Write to
// gate access.
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Phase 2: AFA scheduler + push + admin.
export const COL_FIXTURES = 'fixtures';
export const COL_MATCH_WINDOWS = 'match_windows';
export const COL_FCM_TOKENS = 'fcm_tokens';
export const COL_ADMIN_ACTIONS = 'admin_actions';

// COL_RESET_TOKENS already exists at line 14 — Phase 2 starts writing to it.
// COL_META reused for scheduler/season/oauth/league-id state under keyed entries.
export const KEY_TICK_LOCK = 'tick_lock';
export const KEY_SCHEDULER_STATE = 'scheduler_state';
export const KEY_CURRENT_SEASON = 'current_season';
export const KEY_API_FOOTBALL_LEAGUE_IDS = 'api_football_league_ids';
export const KEY_FCM_OAUTH = 'fcm_oauth_token';
