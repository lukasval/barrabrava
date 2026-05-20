---
seed: recruit-hierarchy-rethink
captured: 2026-05-20
captured_during: Phase 3 walkthrough A — user UAT feedback
trigger: when planning Phase 5 (Mundo Social) — social mechanics phase
status: parked
related_decisions: [D-09, D-12]
related_phases: [03, 05]
---

# Seed — Rethink recruit hierarchy when Mundo Social lands

## What the user observed

While doing Phase 3 walkthrough A, the user (also the eventual real player) pushed back on the current recruit design. Direct quote:

> "Igual hay cosas de la 'lógica' del juego que no entiendo... yo que voy a ser un random más de la barra voy a poder reclutar.. y así todos hacen lo mismo? raro la verdad.. Eso no se que sentido tiene.. a lo sumo, que quede solo designado para el capo de la barra, cuando se lo designe.. pero no le veo sentido la verdad."

The intuition: in a real barra, lower-ranked members don't recruit. The capo or líder controls membership. Every-player-recruits-their-own-pibe breaks the narrative authenticity.

## Why current design (A — every-player-recruits) won for v1

Locked decisions D-09 (recruit pool refresh daily) + D-12 (lifetime cap per rank) treat recruit as a personal, every-rank action because:

1. **Bootstrap solo-play.** Phase 3 ships before Mundo Social. At soft launch, most clubs may have 1–5 players. If only líderes can recruit, a player joining a club with no líder cannot progress — the entire loop dies.
2. **Agency from minute 0.** A fresh user does not wait for a stranger to apadrinarlos.
3. **The Mesa/Líder is a meta-rank, not a gate.** Rank rises by Rep + Aguante contribution, not by appointment. Mesa = top 5 contributors per club. Líder = top 1 per season per club.
4. **Mundo Social (Phase 5) is when player-to-player interaction lands.** No social plumbing exists pre-Phase-5, so a recruit-by-líder gate would have nothing to interact with.
5. **Anti-friction.** A capo "forgetting" to recruit you → you bounce → uninstall. Kills retention.

Narrative reframe that lets A coexist with the barra fantasy: each player runs a **crew/célula** inside the club, not the whole barra. Multiple crews coexist under one club banner (Sopranos analogy: Tony's crew + Junior's crew, both Italian Mafia, distinct units). The Mesa/Líder is the club-wide meta-leader of all crews.

## Alternative B — Líder controls recruit (user's intuition)

Single barra per club. Líder + Mesa decide who joins. Lower ranks contribute aguante + rep but cannot recruit independently. Most realistic. Inviable for v1: bootstrap problem + every-Pibe-user blocked until a líder exists.

## Alternative C — Hybrid (compromise to revisit in Phase 5)

A tiered model that preserves the solo loop while making rank-up feel more political:

| Rank | Recruit access |
|------|---------------|
| Pibe | Personal pool only (3 random/day, current behavior). Reflects "any neighborhood kid can join the crew." |
| Soldado | Personal pool + 1 scouting use/week (pick a trait you want to see in tomorrow's pool). |
| Capo | Full scouting (target trait + range), club-wide visibility into who recently joined. |
| Mesa | Can issue **invites** to other real players (Phase 5 social — pulls a user from one crew into yours). |
| Líder | Can issue **bans** — veto a pibe from appearing in *any* crew's pool club-wide for a week. Political control over membership at the club level. |

C preserves solo-play because the personal pool stays available at every rank, but adds genuinely new capability per rank-up. Líder feels meaningful (controls who can NOT enter the club at large) without bottlenecking the recruit loop.

## Why this is parked, not actioned

- Phase 3 ships A. Re-implementing as B/C now is large server + client rework with no playable benefit because Mundo Social doesn't exist yet.
- The narrative fix for v1 is **copy**, not mechanics — RecruitScreen and tutorial step 2 can be reworded to reflect the crew framing ("Te enteraste de Tito por la cuadra. Lo metiste en tu crew.") rather than implying you're the club líder doing the recruit.
- Real-player feedback at v1 soft launch will tell us whether the crew framing reads or whether players also feel "weird" about it. If yes → C in Phase 5 is the upgrade path.

## What to do in Phase 5 planning

When `/gsd-plan-phase 5` runs (Mundo Social):

1. Re-read this seed.
2. Compare actual soft-launch feedback against this prediction.
3. Decide: keep A with better copy / move to C (tiered recruit access) / move to B (líder-only recruit).
4. If C, the new RPC surface is roughly: `scout_pibe(trait_filter)` (Soldado+), `invite_player(crew_user_id)` (Mesa+), `ban_pibe_clubwide(pibe_template_id)` (Líder).
5. Pibe lifetime cap (D-12) probably also needs revisiting — under B/C, lower ranks may not need a cap at all because they can't recruit unilaterally.

## Copy / narrative tweak that can ship in v1 without code change

In `scripts/screens/RecruitScreen.gd` and `TutorialScreen.gd` step 2, replace the "Reclutaste a {nombre}" framing with crew-leader phrasing:

- Before: "Reclutá a tu primer pibe."
- After: "Sumá un pibe a tu crew."

- Before: "Te cuesta 500 Plata."
- After: "Te cuesta 500 Plata convencerlo de quedar leal a vos."

Confirm strings have no political / banned vocabulary then ship as a copy-only fix.
