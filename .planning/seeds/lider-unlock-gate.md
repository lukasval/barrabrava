---
seed: lider-unlock-gate
captured: 2026-05-20
captured_during: Phase 3 walkthrough A — user UAT feedback (post recruit-hierarchy discussion)
trigger: when planning Phase 5 (Mundo Social) AND/OR Phase 6 (Seasons + Monetization) Líder economy balance
status: parked
related_decisions: [D-13, D-14, D-15]
related_seeds: [recruit-hierarchy-rethink]
related_phases: [03, 05, 06]
---

# Seed — Gate the Líder role behind real-player critical mass

## What the user said

Right after the recruit-hierarchy discussion, the user proposed:

> "Y eso del capo de la barra se va a poder decir cuando haya un mínimo de jugadores reales / Poder para desbloquear el 'jefe'."

The intent: do not let a real player claim the "Líder de la barra" title in clubs that do not yet have enough real activity to justify a real leader. Avoid the anticlimactic case where the only real player at a tiny club becomes Líder by default and the title feels unearned.

## Current Phase 3 mechanic (indirect gate)

There IS a natural rep gate today, but it is purely an economic comparison:

1. AI baseline seeds 5 NPC Mesa + 1 NPC Líder per club.
2. NPC rep accrues as `barra_age_days * 30 * division_mult` and recomputes lazily on `get_barra_state` read.
3. Mesa = top 5 contributors per club. Líder = top 1. Recomputed by the hourly `bb_mesa_recompute_1h` cron and by the season-end Líder election in `seasons.ts`.
4. To outrank the AI Líder, a real player must accumulate more rep than the AI baseline. For an established club like "La Mitad+1" or "Los Millos", that baseline is high and a single fresh user does not catch up for months.

This works as a natural difficulty curve but does NOT enforce the user's intent because:

- A tiny / new club with few real players AND a low AI baseline rep COULD have a real player overtake on rep alone, becoming Líder despite there being only 1–2 active real players. Unearned title.
- Even when overtake is hard, the **role of Líder is always shown** — the AI just keeps the seat. The user's framing is closer to "the Líder seat should not exist as a player-claimable thing until the club is large enough."

## Proposed explicit gate

When `seasons.ts` runs the end-of-season Líder election, gate the real-player promotion path behind both:

- **Threshold A — population:** real_player_count_in_club >= MIN_PLAYERS_FOR_LIDER (suggested 10).
- **Threshold B — relative power:** sum(real_player_rep) >= LIDER_AI_REP * MIN_AGG_REP_RATIO (suggested 0.5 — real players collectively own at least half the rep of the AI Líder).

Logic:

- Both A and B true → top real player by season rep becomes Líder. Display name uses their pibe name.
- Either A or B false → Líder seat stays held by the AI baseline (canned `Capo de la Barra #1`). No real player promotes to Líder this season regardless of personal rep.
- Mesa (top 5) is NOT gated — real players can sit in Mesa from day 1 alongside AI Capos. Mesa is the "I see myself climbing" feedback loop.

## Implementation notes

- Server-side only — these are pure `seasons.ts` Líder-election preconditions, no client change needed.
- Constants live in a single file (`nakama/src/laboral/lider_gate.ts`) so playtest can tune `MIN_PLAYERS_FOR_LIDER` and `MIN_AGG_REP_RATIO` without redeploying business logic.
- Telemetry: log every season-end which clubs gated vs unlocked. Useful to see how many clubs are at "ready to crown" vs still AI-dominated.
- Anti-griefing: real players in a gated club still see the seasonal rep ladder and their position — only the title award is gated. UI should NOT hide their rank from them.

## Tuning hypotheses to validate at soft launch

- 10 real players + 50% rep ratio: probably too aggressive — most clubs in B Metro / Federal A / C Metro will never unlock at v1 scale.
- 3 real players + 25% rep ratio: too permissive — kills the user's intent.
- 5–7 real players + 35% rep ratio: likely sweet spot. Confirm with player count distribution after first season.

## Why parked, not actioned

- Phase 3 ships A (current natural rep gate). Server-side Líder election already runs.
- Explicit gate is small server change (`seasons.ts` precondition) but tunable thresholds depend on real soft-launch data. Pulling a number out of thin air now is worse than letting the soft launch tell us what feels right.
- Phase 6 plans seasons + monetization in detail. That is when the Líder seat becomes economically valuable (cosmetic perks, custom cántico unlock, etc. — TBD) and is the right phase to add the explicit gate.

## What to do in Phase 5 / 6 planning

When `/gsd-plan-phase 6` runs (or earlier if Phase 5 surfaces social mechanics that depend on Líder existence):

1. Re-read this seed plus `recruit-hierarchy-rethink.md`.
2. Decide threshold values (A and B) based on actual player count distributions from beta / soft-launch telemetry.
3. Implement `seasons.ts` precondition. Update `complete_tutorial` / onboarding copy so new users in tiny clubs understand "the Líder seat is currently held by [AI name] until the barra grows."
4. Add an INFRA-NOTES sub-section documenting the gate so future-me does not undo it during a refactor.
5. Consider showing a small "Líder seat: 6 / 10 players needed" widget on HomeScreen for clubs still under the gate — converts the constraint into an aspirational social mechanic.
