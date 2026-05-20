# BarraBrava Laboral Test — Manual Verification Checklist

Phase 3 Core Loop Laboral — companion to `laboral-test.sh`.
Use this file for checks that require human judgment, UI interaction, or time-elapsed scenarios.

**Automated counterpart:** `bash nakama/test/laboral-test.sh` (19 invariants + vocabulary gate)

---

## 1. Godot UI Walkthroughs (Pending — Phase 03.04b)

Full walkthroughs A–E are documented in `.planning/phases/03-core-loop-laboral/03.04b-godot-screens-HUMAN-UAT.md`.
Status: **pending user playthrough via `/gsd-verify-work`**.

| Walkthrough | Screen | What to verify |
|-------------|--------|----------------|
| A | TutorialScreen | 6-step state machine completes, elapsed_ms captured, reward (trapo + cántico) displayed |
| B | RosterScreen | Pibes listed, EnergiaBar correct, profession icons visible |
| C | RecruitScreen | 3 pick cards per day, trait_2 hidden with "?" placeholder, cost visible before confirm |
| D | AguantaderoScreen | Level displayed, upgrade cost + countdown shown, bandera room empty (Phase 4 populates) |
| E | ProfessionAssignScreen | Profession options listed, VBC rate tooltip on "hablar cana", rank-gate message for non-líder |

---

## 2. Tutorial Timing (ONB-05 — 10 min ceiling)

**LAB-TUTORIAL-DURATION manual verification:**

1. Create a fresh account on the test build.
2. Start the tutorial at TutorialScreen step 1 — note real clock time.
3. Complete all 6 steps without rushing (normal user pace).
4. Confirm total elapsed < 10 minutes.
5. Cross-check: Railway Logs → filter `[complete_tutorial]` → confirm log line contains `tutorial_duration_ms=<M>` with `M < 600000`.

**Expected log format (from plan 03.03):**
```
[complete_tutorial] user=<id> tutorial_done=true tutorial_duration_ms=<M>
```

---

## 3. 12h Idle Cap (LAB-IDLE-CAP — D-02)

**Why manual:** Requires waiting 12h or admin storage edit to backdate `last_collected_at`.

**Manual steps:**
1. Assign a pibe to a profession (trapito, vendedor, etc.).
2. Do not open the app for 13+ hours.
3. Open app → call `collect_idle` via HomeScreen.
4. Confirm `plata_credited` equals exactly `rate * 12h * skill_multiplier` (capped, not 13h).
5. Alternatively: use Nakama Console → Storage → `aguantaderos/{user_id}/main` → edit `last_collected_at` to `now - 25*3600*1000` ms. Then call `collect_idle` and verify cap.

**Expected:** credits at most 12h worth of Plata per pibe, regardless of actual elapsed time.

---

## 4. Season Transition — Líder Election (LAB-LIDER-ELECTION — D-15)

**Why manual:** No admin endpoint to flip season-end state in Phase 3 scope.

**Manual steps via Phase 2 admin RPC:**
```bash
BASE="https://nakama-production-7ea8.up.railway.app"
HTTP_KEY="defaulthttpkey"

# Force season to ended state
curl -X POST "$BASE/v2/rpc/admin_set_season_window?http_key=$HTTP_KEY&unwrap" \
  -H "Authorization: Bearer $ADMIN_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"division":"primera","season_id":2026,"status":"ended","started_at":1700000000000,"ends_at":1700001000000}'

# Then read barra_state for any club and verify lider.season_id == 2026
curl -X POST "$BASE/v2/rpc/get_barra_state?unwrap" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** `barra_state.lider.season_id == 2026` after season ends, elected from highest Rep player (human or AI).

---

## 5. Mesa Chica Hourly Recompute (D-14)

**Why manual:** Requires waiting for the `bb_mesa_recompute_1h` cron to fire (every hour at :00) OR Nakama Console trigger.

**Manual steps:**
1. Nakama Console → Leaderboards → `bb_mesa_recompute_1h` → "Submit score" (force trigger).
2. Immediately after: call `get_barra_state` → check `mesa_chica` array.
3. Verify top 5 by Rep, mix of AI + human (AI ids have prefix `ai_{club_id}_{slot}`).
4. Grant a user Rep above lowest AI mesa member via `admin_grant_rep`, then re-trigger cron.
5. Confirm displaced AI member replaced by human in `mesa_chica`.

---

## 6. D-08 No-Daily-Caps Audit (D-08)

**Why manual:** Source-code scan for unintended daily caps.

**Check:**
```bash
# Should return 0 matches (no daily_cap or per_day_limit guard in idle/turno RPCs)
grep -rn "daily_cap\|per_day_limit\|daily_limit" nakama/src/laboral/ nakama/src/rpc/ 2>/dev/null
```

**Expected:** 0 results. D-08 decision: throttle is natural via Energía + 12h idle cap + skill grind — no artificial daily caps on Plata/Rep/Aguante accumulation.

---

## 7. Vocabulary Audit — UI Copy (UI-SPEC §8.5)

**Blacklisted terms in Phase 3 UI copy:**
`raid`, `ataque`, `atacar`, `pelea`, `pelear`, `violencia`, `matar`, `muerte`, `sangre`, `herido`, `robar` (when not referring to trapo folklore in Phase 4 context)

**Manual check — all Phase 3 screens:**
- [ ] HomeScreen: no banned terms in button labels, notices, or tooltips
- [ ] TutorialScreen: no banned terms in step copy
- [ ] RosterScreen: no banned terms in pibe stats labels
- [ ] RecruitScreen: no banned terms in pick card copy
- [ ] ProfessionAssignScreen: no banned terms in profession descriptions
- [ ] AguantaderoScreen: no banned terms in upgrade descriptions
- [ ] PibeDetailScreen: no banned terms in trait descriptions
- [ ] TurnoModal: "Hacer turno" CTA confirmed (not "atacar", "raid", etc.)

**Automated gate:** `bash nakama/test/laboral-test.sh` includes LAB-COPY-VOCABULARY which greps `.ts` + `.gd` files for banned terms.

---

## 8. Android Device Build (Deferred to Phase 7)

Android device verification deferred — same as plan 02-07.
See `.planning/phases/01-foundation/DEFERRED-CI.md`.

When Phase 7 lands:
- Build signed APK
- Install on Android device
- Verify all Phase 3 screens render correctly on small viewport (360px wide)
- Confirm FCM push delivery for turno notifications

---

## Env Setup for Manual Tests

```bash
export NAKAMA_HOST="nakama-production-7ea8.up.railway.app"
export NAKAMA_KEY="aee9c099d52a6c22f52fb8bc9f4b72d9"
export HTTP_KEY="defaulthttpkey"
export ADMIN_BEARER="<rotate before use — see INFRA-NOTES.md>"
BASE="https://$NAKAMA_HOST"
```

---

*Phase: 03-core-loop-laboral*
*Companion to: nakama/test/laboral-test.sh*
*Created: 2026-05-20*
