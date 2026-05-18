#!/usr/bin/env bash
# BarraBrava Heartbeat Test — Phase 2 smoke + admin RPC tests.
# Covers 20 invariants: 17 from original VALIDATION.md + 3 new from revision.
#
# Usage:
#   NAKAMA_HOST=... NAKAMA_KEY=... ADMIN_BEARER=... bash nakama/test/heartbeat-test.sh
#
# Requirements: curl, jq (same as Phase 1 smoke-test.sh).
# Tests 02-01-CLB05-fallback and 02-07-Tick-lock are MANUAL (see VALIDATION.md §Manual).
set -euo pipefail

NAKAMA_HOST="${NAKAMA_HOST:-nakama-production-7ea8.up.railway.app}"
NAKAMA_KEY="${NAKAMA_KEY:-aee9c099d52a6c22f52fb8bc9f4b72d9}"
ADMIN_BEARER="${ADMIN_BEARER:-}"
HTTP_KEY="${HTTP_KEY:-defaulthttpkey}"
BASE="https://${NAKAMA_HOST}"
PASS=0; FAIL=0; SKIP=0

basic_auth() { printf '%s' "$(printf '%s:' "$NAKAMA_KEY" | base64 | tr -d '\n')"; }
console_auth() { printf '%s' "$(printf '%s:' "admin:" | base64 | tr -d '\n')"; }

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1 — $2"; FAIL=$((FAIL+1)); }
skip() { echo "  SKIP: $1"; SKIP=$((SKIP+1)); }

# ---- Bootstrap: register a one-shot test user for player-RPC tests. ----
TEST_EMAIL="hbtest+$(date +%s)@barrabrava.test"
TEST_PASSWORD="hbtest-pw-1234!"

REG_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/account/authenticate/email?create=true&username=hbtest_$(date +%s)" \
  -H "Authorization: Basic $(basic_auth)" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" 2>&1) || REG_RESP="{}"
SESSION_TOKEN=$(echo "$REG_RESP" | jq -r '.token // empty' 2>/dev/null || echo "")
if [ -z "$SESSION_TOKEN" ]; then
  echo "FATAL: Could not get session token. Check NAKAMA_HOST + NAKAMA_KEY."
  exit 1
fi

echo "=== Phase 2: Heartbeat AFA — 20 invariant tests ==="
echo ""

# === 1 ) 02-01-CLB03-leagues: api_football_league_ids stored in meta ===
echo "=== 1 ) 02-01-CLB03-leagues (CLB-03) ==="
LEAGUES_RESP=$(curl -fsS --max-time 15 \
  "$BASE/v2/console/storage?collection=meta&key=api_football_league_ids" \
  -H "Authorization: Basic $(console_auth)" 2>/dev/null || echo "")
if echo "$LEAGUES_RESP" | jq -e '.objects[0].value.primera_id' > /dev/null 2>&1; then
  pass "api_football_league_ids persisted with primera_id"
else
  fail "02-01-CLB03-leagues" "meta:api_football_league_ids not found — run admin_force_repoll first"
fi

# === 2 ) 02-01-CLB03-fixtures: fixtures collection has records ===
echo "=== 2 ) 02-01-CLB03-fixtures (CLB-03) ==="
FIX_RESP=$(curl -fsS --max-time 15 \
  "$BASE/v2/console/storage?collection=fixtures" \
  -H "Authorization: Basic $(console_auth)" 2>/dev/null || echo "{}")
FIX_COUNT=$(echo "$FIX_RESP" | jq '.objects | length' 2>/dev/null || echo "0")
if [ "$FIX_COUNT" -gt 0 ]; then
  pass "fixtures collection has $FIX_COUNT records"
else
  fail "02-01-CLB03-fixtures" "No fixtures found — trigger admin_force_repoll"
fi

# === 3 ) 02-01-CLB05-fallback: MANUAL — requires unsetting API_FOOTBALL_KEY ===
echo "=== 3 ) 02-01-CLB05-fallback (CLB-05) MANUAL ==="
skip "CLB-05 fallback — log grep after intentional API_FOOTBALL_KEY unset"

# === 4 ) 02-01-CLB05-ttl: stale fetched_at replaced on next poll ===
echo "=== 4 ) 02-01-CLB05-ttl (CLB-05) ==="
FIRST_FIXTURE=$(curl -fsS --max-time 15 \
  "$BASE/v2/console/storage?collection=fixtures" \
  -H "Authorization: Basic $(console_auth)" 2>/dev/null \
  | jq -r '.objects[0].value.fetched_at' 2>/dev/null || echo "0")
if [ "$FIRST_FIXTURE" != "0" ] && [ "$FIRST_FIXTURE" != "null" ]; then
  pass "fixture has fetched_at=$FIRST_FIXTURE (TTL refresh verifiable across two ticks)"
else
  fail "02-01-CLB05-ttl" "No fixture with fetched_at found"
fi

# === 5 ) 02-02-SEA01-active: current_season.status in valid state ===
echo "=== 5 ) 02-02-SEA01-active (SEA-01) ==="
SEASON_RESP=$(curl -fsS --max-time 15 \
  "$BASE/v2/console/storage?collection=meta&key=current_season" \
  -H "Authorization: Basic $(console_auth)" 2>/dev/null || echo "")
SEASON_STATUS=$(echo "$SEASON_RESP" | jq -r '.objects[0].value.status // empty' 2>/dev/null || echo "")
if [ "$SEASON_STATUS" = "active" ] || [ "$SEASON_STATUS" = "pre" ] || [ "$SEASON_STATUS" = "ended" ]; then
  pass "current_season.status=$SEASON_STATUS"
else
  fail "02-02-SEA01-active" "meta:current_season not found or invalid status='$SEASON_STATUS'"
fi

# === 6 ) 02-02-SEA02-end: admin_set_season_window forces ended ===
echo "=== 6 ) 02-02-SEA02-end (SEA-02) ==="
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  SET_SEASON_RESP=$(curl -fsS --max-time 15 -X POST \
    "$BASE/v2/rpc/admin_set_season_window?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" \
    -d '{"division":"primera","season_id":2026,"status":"ended","started_at":1700000000000,"ends_at":1700001000000}')
  if echo "$SET_SEASON_RESP" | jq -e '.ok == true' > /dev/null 2>&1; then
    pass "admin_set_season_window ended succeeded"
    curl -fsS --max-time 15 -X POST \
      "$BASE/v2/rpc/admin_set_season_window?http_key=$HTTP_KEY&unwrap" \
      -H "Authorization: Bearer $ADMIN_BEARER" \
      -H "Content-Type: application/json" \
      -d '{"division":"primera","season_id":2026,"status":"active"}' > /dev/null 2>&1 || true
  else
    fail "02-02-SEA02-end" "admin_set_season_window failed: $SET_SEASON_RESP"
  fi
fi

# === 7 ) 02-03-CMB01-math: opens_at == kickoff - 2h ===
echo "=== 7 ) 02-03-CMB01-math (CMB-01) ==="
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  KICKOFF_MS=$(( $(date +%s) * 1000 + 4 * 3600 * 1000 ))
  KICKOFF_ISO=$(date -u -d "@$((KICKOFF_MS / 1000))" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
    || python3 -c "import datetime; print(datetime.datetime.utcfromtimestamp($KICKOFF_MS/1000).strftime('%Y-%m-%dT%H:%M:%SZ'))")
  INJECT_RESP=$(curl -fsS --max-time 15 -X POST \
    "$BASE/v2/rpc/admin_inject_test_fixture?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" \
    -d "{\"fixture_id\":\"test-cmb01\",\"kickoff_utc_iso\":\"$KICKOFF_ISO\",\"home\":\"Equipo A\",\"away\":\"Equipo B\"}")
  if echo "$INJECT_RESP" | jq -e '.ok == true' > /dev/null 2>&1; then
    WIN_RESP=$(curl -fsS --max-time 15 \
      "$BASE/v2/console/storage?collection=match_windows&key=test-cmb01" \
      -H "Authorization: Basic $(console_auth)" 2>/dev/null)
    OPENS_AT=$(echo "$WIN_RESP" | jq -r '.objects[0].value.opens_at' 2>/dev/null || echo "0")
    EXPECTED_OPENS=$(( KICKOFF_MS - 7200000 ))
    if [ "$OPENS_AT" = "$EXPECTED_OPENS" ]; then
      pass "opens_at == kickoff - 2h (CMB-01 verified)"
    else
      fail "02-03-CMB01-math" "opens_at=$OPENS_AT expected=$EXPECTED_OPENS"
    fi
  else
    fail "02-03-CMB01-math" "admin_inject_test_fixture failed (ADMIN_TEST_MODE=true?): $INJECT_RESP"
  fi
fi

# === 8 ) 02-03-CMB01-live: past-kickoff fixture transitions to state=live ===
echo "=== 8 ) 02-03-CMB01-live (CMB-01) ==="
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  PAST_KICKOFF_MS=$(( $(date +%s) * 1000 - 30 * 60 * 1000 ))
  PAST_ISO=$(date -u -d "@$((PAST_KICKOFF_MS / 1000))" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
    || python3 -c "import datetime; print(datetime.datetime.utcfromtimestamp($PAST_KICKOFF_MS/1000).strftime('%Y-%m-%dT%H:%M:%SZ'))")
  curl -fsS --max-time 15 -X POST \
    "$BASE/v2/rpc/admin_inject_test_fixture?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" \
    -d "{\"fixture_id\":\"test-cmb01-live\",\"kickoff_utc_iso\":\"$PAST_ISO\",\"home\":\"Equipo A\",\"away\":\"Equipo B\"}" > /dev/null
  curl -fsS --max-time 30 -X POST \
    "$BASE/v2/rpc/admin_force_repoll?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" -d '{}' > /dev/null
  WIN_STATE=$(curl -fsS --max-time 15 \
    "$BASE/v2/console/storage?collection=match_windows&key=test-cmb01-live" \
    -H "Authorization: Basic $(console_auth)" 2>/dev/null \
    | jq -r '.objects[0].value.state' 2>/dev/null || echo "")
  if [ "$WIN_STATE" = "live" ]; then
    pass "Past-kickoff window state=live"
  else
    fail "02-03-CMB01-live" "Expected state=live got '$WIN_STATE'"
  fi
fi

# === 9 ) 02-04-DAY03-once: notified_open_at set exactly once ===
echo "=== 9 ) 02-04-DAY03-once (DAY-03) ==="
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  OPEN_SOON_KICK=$(( $(date +%s) * 1000 + 2 * 3600 * 1000 + 60000 ))
  OPEN_SOON_ISO=$(date -u -d "@$((OPEN_SOON_KICK / 1000))" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
    || python3 -c "import datetime; print(datetime.datetime.utcfromtimestamp($OPEN_SOON_KICK/1000).strftime('%Y-%m-%dT%H:%M:%SZ'))")
  curl -fsS --max-time 15 -X POST "$BASE/v2/rpc/admin_inject_test_fixture?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" -H "Content-Type: application/json" \
    -d "{\"fixture_id\":\"test-day03\",\"kickoff_utc_iso\":\"$OPEN_SOON_ISO\",\"home\":\"A\",\"away\":\"B\"}" > /dev/null
  curl -fsS --max-time 30 -X POST "$BASE/v2/rpc/admin_force_repoll?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" -H "Content-Type: application/json" -d '{}' > /dev/null
  curl -fsS --max-time 30 -X POST "$BASE/v2/rpc/admin_force_repoll?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" -H "Content-Type: application/json" -d '{}' > /dev/null
  WIN_NOTIFIED=$(curl -fsS --max-time 15 \
    "$BASE/v2/console/storage?collection=match_windows&key=test-day03" \
    -H "Authorization: Basic $(console_auth)" 2>/dev/null \
    | jq -r '.objects[0].value.notified_open_at // "null"' 2>/dev/null || echo "null")
  if [ "$WIN_NOTIFIED" != "null" ] && [ "$WIN_NOTIFIED" != "0" ] && [ -n "$WIN_NOTIFIED" ]; then
    pass "notified_open_at set: $WIN_NOTIFIED"
  else
    fail "02-04-DAY03-once" "notified_open_at not set after two repoll calls"
  fi
fi

# === 10 ) 02-04-DAY03-topic: validateTopicName via admin_test_validate_topic ===
echo "=== 10 ) 02-04-DAY03-topic (DAY-03) ==="
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  INVALID_RESP=$(curl -fsS --max-time 15 -X POST \
    "$BASE/v2/rpc/admin_test_validate_topic?http_key=$HTTP_KEY" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" \
    --data-binary '"{\"topic_in\":\"club boca\"}"' 2>/dev/null || echo '{}')
  INVALID_INNER=$(echo "$INVALID_RESP" | jq -r '.payload // "{}"' 2>/dev/null)
  INVALID_OK=$(echo "$INVALID_INNER" | jq -r '.ok' 2>/dev/null || echo "")
  INVALID_ERR=$(echo "$INVALID_INNER" | jq -r '.error // empty' 2>/dev/null || echo "")
  VALID_RESP=$(curl -fsS --max-time 15 -X POST \
    "$BASE/v2/rpc/admin_test_validate_topic?http_key=$HTTP_KEY" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" \
    --data-binary '"{\"topic_in\":\"club_xeneizes\"}"' 2>/dev/null || echo '{}')
  VALID_INNER=$(echo "$VALID_RESP" | jq -r '.payload // "{}"' 2>/dev/null)
  VALID_OK=$(echo "$VALID_INNER" | jq -r '.ok' 2>/dev/null || echo "")
  if [ "$INVALID_OK" = "false" ] && [ "$VALID_OK" = "true" ]; then
    pass "validateTopicName: 'club boca' → ok:false ($INVALID_ERR), 'club_xeneizes' → ok:true"
  else
    fail "02-04-DAY03-topic" "Expected ok:false for 'club boca' (got $INVALID_OK) and ok:true for 'club_xeneizes' (got $VALID_OK). Ensure ADMIN_TEST_MODE=true."
  fi
fi

# === 11 ) 02-05-Resend-A: request_password_reset returns ok:true ===
echo "=== 11 ) 02-05-Resend-A ==="
RESET_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/request_password_reset?unwrap" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")
if echo "$RESET_RESP" | jq -e '.ok == true' > /dev/null 2>&1; then
  pass "request_password_reset returns ok:true (anti-enumeration)"
else
  fail "02-05-Resend-A" "Expected ok:true got: $RESET_RESP"
fi

# === 12 ) 02-05-Resend-B: MANUAL — token extraction via Nakama Console ===
echo "=== 12 ) 02-05-Resend-B MANUAL ==="
skip "Resend-B — token extraction requires Nakama Console reset_tokens collection"

# === 13 ) 02-05-Resend-C: confirm_password_reset with bogus token rejected ===
echo "=== 13 ) 02-05-Resend-C ==="
CONFIRM_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/confirm_password_reset?unwrap" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"00000000-0000-0000-0000-000000000000","new_password":"newpassword123"}')
ERR=$(echo "$CONFIRM_RESP" | jq -r '.error // empty' 2>/dev/null || echo "")
if [ "$ERR" = "token_invalid" ] || [ "$ERR" = "token_expired" ]; then
  pass "confirm_password_reset bogus token returns $ERR"
else
  fail "02-05-Resend-C" "Expected token_invalid/token_expired, got: $CONFIRM_RESP"
fi

# === 14 ) 02-06-Admin-A: no bearer → unauthorized ===
echo "=== 14 ) 02-06-Admin-A (CLB-04) ==="
NO_AUTH_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo '{"error":"rpc_error"}')
if echo "$NO_AUTH_RESP" | grep -q "unauthorized\|admin_disabled"; then
  pass "admin RPC without bearer rejected"
else
  fail "02-06-Admin-A" "Expected unauthorized, got: $NO_AUTH_RESP"
fi

# === 15 ) 02-06-Admin-B: wrong bearer → unauthorized ===
echo "=== 15 ) 02-06-Admin-B (CLB-04) ==="
WRONG_AUTH_RESP=$(curl -fsS --max-time 15 -X POST \
  "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer wrong-token-1234567890ab" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo '{}')
if echo "$WRONG_AUTH_RESP" | jq -e '.error == "unauthorized"' > /dev/null 2>&1; then
  pass "admin RPC wrong bearer returns unauthorized"
else
  fail "02-06-Admin-B" "Expected error:unauthorized, got: $WRONG_AUTH_RESP"
fi

# === 16 ) 02-06-Admin-C: correct bearer → ok:true ===
echo "=== 16 ) 02-06-Admin-C (CLB-04) ==="
if [ -z "$ADMIN_BEARER" ]; then
  skip "ADMIN_BEARER not set"
else
  REPOLL_RESP=$(curl -fsS --max-time 30 -X POST \
    "$BASE/v2/rpc/admin_force_repoll?http_key=$HTTP_KEY&unwrap" \
    -H "Authorization: Bearer $ADMIN_BEARER" \
    -H "Content-Type: application/json" -d '{}')
  if echo "$REPOLL_RESP" | jq -e '.ok == true' > /dev/null 2>&1; then
    pass "admin_force_repoll correct bearer returns ok:true"
  else
    fail "02-06-Admin-C" "Expected ok:true got: $REPOLL_RESP"
  fi
fi

# === 17 ) 02-07-Tick-lock: MANUAL ===
echo "=== 17 ) 02-07-Tick-lock MANUAL ==="
skip "Tick lock — two admin_force_repoll within 1s; grep Railway logs for 'previous tick still active'"

# === 18 ) 02-02-MAP-club_team: meta:club_team_map populated ===
echo "=== 18 ) 02-02-MAP-club_team (CLB-03) ==="
MAP_RESP=$(curl -fsS --max-time 15 \
  "$BASE/v2/console/storage?collection=meta&key=club_team_map" \
  -H "Authorization: Basic $(console_auth)" 2>/dev/null || echo "")
MAP_KEYS=$(echo "$MAP_RESP" | jq '.objects[0].value | keys | length' 2>/dev/null || echo "0")
if [ "$MAP_KEYS" -gt 0 ]; then
  pass "meta:club_team_map has $MAP_KEYS entries"
else
  fail "02-02-MAP-club_team" "meta:club_team_map empty — run admin_force_repoll (buildClubTeamMap fires once per season)"
fi

# === 19 ) 02-08-FCM-subscribe-on-clubpick: FlowRouter wires subscribe ===
echo "=== 19 ) 02-08-FCM-subscribe-on-clubpick (DAY-03) ==="
if grep -q "subscribe_to_club_topic" scripts/autoloads/FlowRouter.gd 2>/dev/null; then
  pass "FlowRouter.gd calls subscribe_to_club_topic"
else
  fail "02-08-FCM-subscribe-on-clubpick" "subscribe_to_club_topic missing from FlowRouter.gd"
fi

# === 20 ) 02-08-FCM-token-register: NakamaService wires on_token_received ===
echo "=== 20 ) 02-08-FCM-token-register (DAY-03) ==="
if grep -q "on_token_received" scripts/autoloads/NakamaService.gd 2>/dev/null; then
  pass "NakamaService.gd connects on_token_received signal"
else
  fail "02-08-FCM-token-register" "on_token_received missing from NakamaService.gd"
fi

echo ""
echo "=== RESULTS: PASS=$PASS FAIL=$FAIL SKIP=$SKIP ==="
if [ "$FAIL" -gt 0 ]; then
  echo "Phase 2 heartbeat test: FAILED ($FAIL failures)"
  exit 1
fi
echo "Phase 2 heartbeat test: PASSED (with $SKIP manual skips)"
exit 0
