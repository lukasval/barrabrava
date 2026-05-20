extends Node

# Client-side mirror of nakama/src/storage_keys.ts (WR-08).
#
# Single source of truth for Nakama Storage collection + key names. Any change
# here MUST match the server-side constants or storage reads silently return
# empty results (CR-01 was exactly this kind of drift bug).

const COL_PIBES := "pibes"
const COL_PLAYERS := "players"
const COL_CLUBS := "clubs"
const COL_RESET_TOKENS := "reset_tokens"
const COL_META := "meta"

const KEY_PIBE_MAIN := "main"
const KEY_PLAYER_PROFILE := "profile"

# Postgres nil UUID — userId for system-owned (public-read) collections like
# 'clubs'. Matches SYSTEM_USER_ID in nakama/src/storage_keys.ts.
const SYSTEM_USER_ID := "00000000-0000-0000-0000-000000000000"

# Phase 2 additions — mirror nakama/src/storage_keys.ts.
# Only collections the CLIENT reads are mirrored (CR-01 lesson: keep mirror tight to avoid drift).
# Server-internal collections (admin_actions, fcm_oauth_token, tick_lock, etc.) are omitted.
const COL_MATCH_WINDOWS := "match_windows"
# COL_FIXTURES — client never reads directly (goes via get_current_window RPC), skip mirror.
# COL_FCM_TOKENS — client writes via register_fcm_token RPC only, skip mirror.

# Phase 3: Core Loop Laboral — client mirror.
# COL_TURNOS intentionally omitted: client never reads directly (writes via submit_turno,
# reads back via get_roster). COL_META keys also omitted (server-internal).
const COL_AGUANTADEROS := "aguantaderos"
const COL_BARRA_STATE := "barra_state"
const COL_RECRUIT_POOL := "recruit_pool"
const KEY_AGUANTADERO_MAIN := "main"
