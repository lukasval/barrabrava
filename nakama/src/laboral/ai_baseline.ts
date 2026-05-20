// nakama/src/laboral/ai_baseline.ts
//
// Tunable AI baseline Rep curve constants.
// Kept as a separate module so a post-launch balance pass = one-line PR (RESEARCH A1).
// DO NOT inline into ai_seed.ts — keeps Phase 6 balance changes isolated.
//
// aiBaselineRep(slot, ageDays, divisionRank):
//   slot        — 1-indexed Mesa slot (1=top, 5=bottom) or any > 5 clamped
//   ageDays     — club's barra_age_days (starts 0 at seed, grows over time)
//   divisionRank — 1 (Primera División) .. 5 (5a división / lower regional)

// Tunable dials — kept here so post-launch balance pass = one-line PR.
export const AI_SLOT_BASE: readonly number[] = [3000, 2500, 2000, 1500, 1000];
export const AI_AGE_GROWTH_PER_DAY = 30;
export const AI_DIVISION_MULTIPLIER: { [k: number]: number } = {
  1: 1.0, 2: 0.8, 3: 0.6, 4: 0.5, 5: 0.4,
};

export function aiBaselineRep(slot: number, ageDays: number, divisionRank: number): number {
  const div = AI_DIVISION_MULTIPLIER[divisionRank] ?? 0.6;
  const slotBase = AI_SLOT_BASE[Math.max(0, Math.min(4, slot - 1))];
  const ageGrowth = ageDays * AI_AGE_GROWTH_PER_DAY * div;
  return Math.floor((slotBase + ageGrowth) * div);
}
