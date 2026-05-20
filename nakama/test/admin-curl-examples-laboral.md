# Admin RPC Curl Examples — Phase 3 (Core Loop Laboral)

Reference for BarraBrava Phase 3 admin operations. Replace `$NAKAMA_HOST` and
`$ADMIN_BEARER` with your Railway values. See `.planning/phases/01-foundation/INFRA-NOTES.md`
and `INFRA-NOTES.md` §"Phase 2 — Admin RPCs" for general setup.

## Variables

```bash
export NAKAMA_HOST="nakama-production-7ea8.up.railway.app"
export ADMIN_BEARER="your-uuid-v4-here"   # rotate before use — was exposed in chat Phase 2
export HTTP_KEY="defaulthttpkey"
BASE="https://$NAKAMA_HOST"
```

> **Security reminder:** `ADMIN_BEARER` rotation is outstanding from Phase 2 debugging.
> Generate a new UUID before running any production admin operation:
>   `python3 -c "import uuid; print(uuid.uuid4())"`
> Then update Railway Variables → `ADMIN_BEARER` → Redeploy.

---

## admin_force_recruit_refresh

Triggers an immediate recruit pool refresh for all clubs (or a specific club).
Normal cadence: cron fires at 08:00 UTC (05:00 ART) via `bb_recruit_05_art` leaderboard.

### Refresh all clubs

```bash
curl -X POST "$BASE/v2/rpc/admin_force_recruit_refresh?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response:**
```json
{"ok": true, "regenerated": 153, "generated_date": "2026-05-20"}
```
- `regenerated`: count of clubs whose pool was refreshed.
- `generated_date`: UTC date used as the pool key (`recruit_pool/{club_id}/{date}`).

### Refresh a specific club

```bash
curl -X POST "$BASE/v2/rpc/admin_force_recruit_refresh?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"club_id": "xeneizes"}'
```

**Expected response:**
```json
{"ok": true, "regenerated": 1, "generated_date": "2026-05-20"}
```

### Same-day idempotency test (LAB-RECRUIT-DAILY)

```bash
# First call
curl -X POST "$BASE/v2/rpc/admin_force_recruit_refresh?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{}'

# Second call (same UTC day) -- expect regenerated:0 or same generated_date
curl -X POST "$BASE/v2/rpc/admin_force_recruit_refresh?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verify pool via Nakama Console

```bash
# Check pool for a specific club (replace 'xeneizes' with actual club_id from clubs.json)
TODAY=$(date -u +"%Y-%m-%d")
curl "$BASE/v2/console/storage?collection=recruit_pool&key=xeneizes/$TODAY" \
  --user "admin:" | jq '.objects[0].value'
```

---

## admin_grant_rep

Grants (or deducts) Reputación to a player. Used in tests to force rank threshold promotions
and to set up test scenarios. Also recalculates rank after the write.

### Grant +500 Rep to a player (Pibe → Soldado promotion test)

```bash
USER_ID="<target-user-uuid>"

curl -X POST "$BASE/v2/rpc/admin_grant_rep?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"rep_delta\": 500, \"reason\": \"LAB-RANK test\"}"
```

**Expected response:**
```json
{"ok": true, "new_reputacion": 500, "new_rank": "soldado", "audit_id": "<uuid>"}
```
- `new_rank`: recalculated rank after Rep change. `soldado` at 500 Rep, `capo` at 2500 Rep.
- `audit_id`: written to `admin_actions` collection for traceability.

### Grant +2500 Rep (Soldado → Capo promotion test)

```bash
curl -X POST "$BASE/v2/rpc/admin_grant_rep?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"rep_delta\": 2500, \"reason\": \"LAB-RANK capo test\"}"
```

### Deduct Rep (test demotion)

```bash
curl -X POST "$BASE/v2/rpc/admin_grant_rep?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"rep_delta\": -100, \"reason\": \"test demotion\"}"
```

### Look up a user's current profile (to get user_id)

```bash
# Search by email — Nakama Console API
curl "$BASE/v2/console/account?email=test%2Bp3-1234@barrabrava.test" \
  --user "admin:" | jq '.account.user.id'
```

### Check rank after grant

```bash
# Call as the player to see updated roster
curl -X POST "$BASE/v2/rpc/get_roster?unwrap" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.rank'
```

---

## admin_seed_ai_baseline

Seeds or re-seeds AI barra_state for all clubs. Creates 5 Mesa AI slots + 1 AI Líder per club
with synthetic Rep (`barra_age_days * division_mult * slot_factor`) so the Mesa Chica is
populated on Day 1 before any human players reach the top.

### Normal seed (idempotent — skips if already seeded)

```bash
curl -X POST "$BASE/v2/rpc/admin_seed_ai_baseline?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response (first run):**
```json
{"ok": true, "seeded": 153, "skipped": 0, "version": "v1"}
```

**Expected response (subsequent runs — idempotent):**
```json
{"ok": true, "seeded": 0, "skipped": 153, "version": "v1"}
```
- Uses `COL_META[KEY_AI_SEED_VERSION]` version marker to prevent duplicate writes on redeploy.

### Force re-seed (overwrites existing AI baseline)

Use this to reset AI Rep to initial values (e.g., after a balance adjustment to `ai_baseline.ts`).

```bash
curl -X POST "$BASE/v2/rpc/admin_seed_ai_baseline?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Expected response:**
```json
{"ok": true, "seeded": 153, "skipped": 0, "version": "v1", "force": true}
```
- Clears `KEY_AI_SEED_VERSION` marker first, then re-seeds all 153 clubs.
- **Caution:** This resets all AI Rep to formula values. Human players' Rep is unchanged.

### Verify AI seed for a specific club

```bash
curl "$BASE/v2/console/storage?collection=barra_state&key=xeneizes" \
  --user "admin:" | jq '.objects[0].value.mesa_chica'
```

**Expected structure:**
```json
[
  {"player_id": "ai_xeneizes_0", "rank": "mesa", "reputacion": 1500},
  {"player_id": "ai_xeneizes_1", "rank": "mesa", "reputacion": 1200},
  {"player_id": "ai_xeneizes_2", "rank": "mesa", "reputacion": 900},
  {"player_id": "ai_xeneizes_3", "rank": "mesa", "reputacion": 600},
  {"player_id": "ai_xeneizes_4", "rank": "mesa", "reputacion": 300}
]
```
AI ids follow pattern `ai_{club_id}_{slot}`. Display name rendered as "Capo de la Barra #N" at UI layer only — stored as `null` on server (D-14, T-3-AS-04 mitigation).

---

## PowerShell Notes (Windows)

Same caveat as Phase 2 — PowerShell mangles quotes. Use `--data-binary "@-"` with a here-string:

```powershell
$body = '{"force": true}'
$body | curl.exe -X POST "https://$env:NAKAMA_HOST/v2/rpc/admin_seed_ai_baseline?http_key=$env:HTTP_KEY&unwrap" `
  -H "Authorization: Bearer $env:ADMIN_BEARER" `
  -H "Content-Type: application/json" `
  --data-binary "@-"
```

---

## Audit Log Verification

Every admin mutation writes to `admin_actions` collection (permissionRead:0, permissionWrite:0 — server-only).

```bash
# List recent admin actions (server-owner read via Nakama Console)
curl "$BASE/v2/console/storage?collection=admin_actions&limit=10" \
  --user "admin:" | jq '[.objects[].value | {rpc, reason, ts: .created_at}]'
```

---

*Phase: 03-core-loop-laboral*
*See also: nakama/test/admin-curl-examples.md (Phase 2 admin recipes)*
*Created: 2026-05-20*
