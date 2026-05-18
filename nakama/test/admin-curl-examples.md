# Admin RPC Curl Examples — Phase 2

Reference for BarraBrava Phase 2 admin operations. Replace `$NAKAMA_HOST` and
`$ADMIN_BEARER` with your Railway values. See
`.planning/phases/01-foundation/INFRA-NOTES.md §"Admin RPCs"` for setup.

## Variables

```bash
export NAKAMA_HOST="nakama-production-7ea8.up.railway.app"
export ADMIN_BEARER="your-uuid-v4-here"
export HTTP_KEY="defaulthttpkey"   # change before public launch
BASE="https://$NAKAMA_HOST"
```

## Auth Tests

### No bearer (expect `unauthorized`)
```bash
curl -X POST "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Content-Type: application/json" -d '{}'
```

### Wrong bearer (expect `unauthorized`)
```bash
curl -X POST "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer wrong-token-1234567890ab" \
  -H "Content-Type: application/json" -d '{}'
```

### Correct bearer (expect `ok:true`)
```bash
curl -X POST "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" -d '{}'
```

## Admin RPCs

### admin_force_repoll — trigger immediate tick
```bash
curl -X POST "$BASE/v2/rpc/admin_force_repoll?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" -d '{}'
```

### admin_list_windows — list all windows
```bash
curl -X POST "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" -d '{}'
```

### admin_list_windows — filter by state
```bash
curl -X POST "$BASE/v2/rpc/admin_list_windows?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"state":"open"}'
```

### admin_close_window — force-close a window
```bash
curl -X POST "$BASE/v2/rpc/admin_close_window?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"fixture_id":"123456"}'
```

### admin_postpone_fixture — shift kickoff
```bash
curl -X POST "$BASE/v2/rpc/admin_postpone_fixture?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"fixture_id":"123456","new_kickoff_utc":1750000000000}'
```

### admin_postpone_fixture — cancel fixture (required if window is open/live)
```bash
curl -X POST "$BASE/v2/rpc/admin_postpone_fixture?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"fixture_id":"123456","cancel":true}'
```

### admin_set_season_window — override season state
```bash
curl -X POST "$BASE/v2/rpc/admin_set_season_window?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"division":"primera","season_id":2026,"status":"active"}'
```

### admin_set_club_team_mapping — manually map club_id → API-Football team_id

Use when a club appears in `meta:unmatched_clubs` (the auto-matcher in
`buildClubTeamMap` could not resolve it).

```bash
# First inspect unmatched clubs:
curl "$BASE/v2/console/storage?collection=meta&key=unmatched_clubs" \
  --user "admin:" | jq '.objects[0].value'

# Then set a mapping (replace CLUB_SLUG and TEAM_ID with actual values):
curl -X POST "$BASE/v2/rpc/admin_set_club_team_mapping?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"club_id":"CLUB_SLUG","team_id":12345}'
```

### admin_inject_test_fixture — inject synthetic fixture (requires `ADMIN_TEST_MODE=true`)
```bash
KICKOFF=$(date -u -d "+4 hours" '+%Y-%m-%dT%H:%M:%SZ')
curl -X POST "$BASE/v2/rpc/admin_inject_test_fixture?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d "{\"fixture_id\":\"test-001\",\"kickoff_utc_iso\":\"$KICKOFF\",\"home\":\"Barra A\",\"away\":\"Barra B\"}"
```

### admin_test_validate_topic — validate FCM topic name (requires `ADMIN_TEST_MODE=true`)
```bash
# Valid (expect ok:true):
curl -X POST "$BASE/v2/rpc/admin_test_validate_topic?http_key=$HTTP_KEY" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  --data-binary '"{\"topic_in\":\"club_xeneizes\"}"'

# Invalid — space not allowed (expect ok:false, error:invalid_topic_chars):
curl -X POST "$BASE/v2/rpc/admin_test_validate_topic?http_key=$HTTP_KEY" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  --data-binary '"{\"topic_in\":\"club boca\"}"'
```

## PowerShell notes (Windows)

PowerShell mangles single + double quotes inside `--data-raw`. Use a
here-string + `--data-binary "@-"` to preserve literal escapes:

```powershell
$body = @'
"{\"topic_in\":\"club_xeneizes\"}"
'@
$body | curl.exe -X POST "https://$env:NAKAMA_HOST/v2/rpc/admin_test_validate_topic?http_key=$env:HTTP_KEY" `
  -H "Authorization: Bearer $env:ADMIN_BEARER" `
  -H "Content-Type: application/json" `
  --data-binary "@-"
```
