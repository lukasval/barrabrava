// nakama/src/laboral/idle_accrual.ts
//
// Pure-function idle accrual helpers.
// NO writes, NO nk/logger access. Callers decide what to persist.
//
// Key design decisions (from 03-CONTEXT.md):
//   D-01: Idle generation is lazy on read — accrueIdleForPibe is PROJECTION ONLY.
//         Only collect_idle (plan 03.03) stamps last_collected_at / skills.*_hours.
//   D-02: 12h cap per pibe — elapsed clamped to IDLE_CAP_MS before multiplying.
//   D-04: Energia regen +5/h offline (lazy), max 100. regenEnergia returns projected value;
//         get_roster persists it (not collect_idle — energy is not a currency).
//   D-05: Profession rates (Plata/h, VBC/h) + skill multiplier clamp [1, 6].
//   D-07: hablar_cana VBC zero-out when caller is not 'lider' (RESEARCH §Security #3).

// ─── Constants ────────────────────────────────────────────────────────────────

// D-02: 12h offline cap per pibe.
export const IDLE_CAP_MS = 12 * 3600 * 1000;

// D-04
export const ENERGIA_REGEN_PER_HOUR = 5;
export const ENERGIA_MAX = 100;

// D-05: Base rates per profession (Plata/h, VBC/h).
export const PROFESSION_RATES_PER_HOUR: {
  [k: string]: { plata: number; vbc: number };
} = {
  trapito:     { plata: 10, vbc: 0 },
  vendedor:    { plata: 15, vbc: 0 },
  patovica:    { plata: 20, vbc: 0 },
  remisero:    { plata: 25, vbc: 0 },
  hablar_cana: { plata: 0,  vbc: 1 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PibeRecord {
  id: string;
  name: string;
  club_id: string;
  rol: string;
  trait_1: string;
  trait_2: string;
  avatar: { pelo: string; remera: string; accesorio: string };
  stats: { aguante: number; velocidad: number; astucia: number; carisma: number };
  energia: number;
  energia_last_tick_at: number;
  profession: string | null;
  profession_started_at: number | null;
  last_collected_at: number | null;
  skills: { [k: string]: number };
  en_turno_until: number | null;
  created_at: number;
}

export interface AccrualResult {
  plata_delta: number;
  vbc_delta: number;
  hours_worked: number;  // post-cap hours (used for skill grind on commit)
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// PROJECTION ONLY — NEVER writes. Caller (collect_idle) decides to commit.
//
// D-05: skill multiplier = clamp(1 + skill_hours / 100, 1, 6).
// D-02: elapsed capped at IDLE_CAP_MS before multiplying.
// D-07: hablar_cana + non-lider → zero-out (defensive, anti-cheat: player losing
//       Líder rank mid-cycle must not continue accruing VBC).
export function accrueIdleForPibe(
  pibe: PibeRecord, now: number, ownerRank?: string,
): AccrualResult {
  if (!pibe.profession) return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  if (pibe.profession === 'hablar_cana' && ownerRank !== 'lider') {
    // D-07: VBC accrual is exclusively for the club Líder (RESEARCH §Security #3).
    return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  }
  const last = pibe.last_collected_at ?? pibe.profession_started_at ?? now;
  const elapsedRaw = now - last;
  if (elapsedRaw <= 0) return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  // D-02: cap before multiplying.
  const elapsed = Math.min(elapsedRaw, IDLE_CAP_MS);
  const hours = elapsed / 3600000;
  const rates = PROFESSION_RATES_PER_HOUR[pibe.profession];
  if (!rates) return { plata_delta: 0, vbc_delta: 0, hours_worked: 0 };
  const skillKey = pibe.profession + '_hours';
  const skillHours = (pibe.skills && typeof pibe.skills[skillKey] === 'number')
    ? pibe.skills[skillKey] : 0;
  // D-05: skill multiplier clamp [1, 6].
  const mult = Math.min(6, 1 + skillHours / 100);
  return {
    plata_delta:  Math.floor(rates.plata * hours * mult),
    vbc_delta:    Math.floor(rates.vbc   * hours * mult),
    hours_worked: hours,
  };
}

// PURE projection — returns the new energia value (caller persists if changed).
// D-04: +5/h offline, max 100. Server clock only (T-3-RS-01 mitigation).
export function regenEnergia(pibe: PibeRecord, now: number): number {
  const last = pibe.energia_last_tick_at ?? now;
  const elapsed_h = (now - last) / 3600000;
  if (elapsed_h <= 0) return pibe.energia;
  return Math.min(ENERGIA_MAX, pibe.energia + Math.floor(elapsed_h * ENERGIA_REGEN_PER_HOUR));
}
