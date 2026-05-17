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
