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
