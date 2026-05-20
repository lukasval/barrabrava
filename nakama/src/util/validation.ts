// Pibe name validation — server-side only.
// Mitigates: T-1-RT-03 (Spoofing — admin/mod impersonation), T-1-RT-04 (Tampering — XSS/SQL injection).
//
// Rules:
//   - Length 3..20 chars
//   - Allowed: letters (incl. Spanish), digits, single spaces, underscore, hyphen
//   - No leading/trailing whitespace, no double spaces
//   - Deny list: profanity + reserved system words
//
// We keep the list short and stable. Profanity moderation will be expanded in Phase 5 (Mundo Social)
// when free-form interaction emerges. For Phase 1 the goal is to keep obviously abusive / impersonating
// names out of the database before downstream code starts trusting them.

const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

// Allowed glyph class — letters incl. Spanish (á-ÿ, ñ, ü), digits, space, _ -
const ALLOWED_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 _-]+$/;

// Deny list (word-boundary match, case-insensitive). Keep small and obvious.
//
// WR-03 fix: substring match generaba falsos positivos (e.g. 'orto' rechazaba
// 'Ortodoxo', 'Aporto', 'Norto'; 'root' rechazaba 'Rootkit'). Cambiamos a
// word-boundary regex (\b). 'orto' y 'hdp' se sacaron porque los falsos
// positivos superan el valor — para Phase 5 (Mundo Social) hay que reemplazar
// todo esto por una solución más robusta (Levenshtein + servicio externo).
const DENY_WORDS: string[] = [
  // System / impersonation
  'admin',
  'administrator',
  'moderador',
  'moderator',
  'staff',
  'support',
  'soporte',
  'nakama',
  'barrabrava',
  'oficial',
  'official',
  'sistema',
  'system',
  'root',
  'null',
  'undefined',
  // Argentine profanity (minimum set — Phase 1 baseline)
  'puta',
  'puto',
  'pelotudo',
  'pelotuda',
  'boludo',
  'boluda',
  'concha',
  'forro',
  'forra',
  'trolo',
  'trola',
  'mogolico',
  'mogolica',
];

// Pre-compile regex with word boundaries. Escape any regex metacharacters
// in deny words (currently none, but defensive).
const DENY_REGEXES: RegExp[] = DENY_WORDS.map(
  (w) => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'),
);

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validatePibeName(raw: unknown): ValidationResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'name_must_be_string' };
  }
  const name = raw.trim();
  if (name.length < MIN_LENGTH) {
    return { ok: false, error: 'name_too_short' };
  }
  if (name.length > MAX_LENGTH) {
    return { ok: false, error: 'name_too_long' };
  }
  if (name !== raw) {
    return { ok: false, error: 'name_has_leading_or_trailing_whitespace' };
  }
  if (name.indexOf('  ') !== -1) {
    return { ok: false, error: 'name_has_double_space' };
  }
  if (!ALLOWED_RE.test(name)) {
    return { ok: false, error: 'name_has_invalid_chars' };
  }
  for (let i = 0; i < DENY_REGEXES.length; i++) {
    if (DENY_REGEXES[i].test(name)) {
      return { ok: false, error: 'name_contains_forbidden_word' };
    }
  }
  return { ok: true };
}

// Basic RFC 5322-ish email shape check. We do NOT try to fully validate emails —
// the goal is to reject obviously malformed input before passing through to RPCs.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailShape(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const email = raw.trim();
  if (email.length < 5 || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

// ─── Phase 3: Core Loop Laboral ───────────────────────────────────────────────

const VALID_PROFESSIONS = ['trapito', 'vendedor', 'patovica', 'remisero', 'hablar_cana'] as const;
const VALID_RANKS = ['pibe', 'soldado', 'capo', 'mesa', 'lider'] as const;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// null means "rest" (unassign profession). Other values must be in the valid list.
// Used by assign_pibe_profession (plan 03.03).
export function validateProfession(raw: unknown): ValidationResult {
  if (raw === null) return { ok: true };  // null = unassign
  if (typeof raw !== 'string') return { ok: false, error: 'invalid_profession' };
  if (!(VALID_PROFESSIONS as readonly string[]).includes(raw)) {
    return { ok: false, error: 'unknown_profession' };
  }
  return { ok: true };
}

// Used by admin_grant_rep + rank transition guards.
export function validateRank(raw: unknown): ValidationResult {
  if (typeof raw !== 'string') return { ok: false, error: 'invalid_rank' };
  if (!(VALID_RANKS as readonly string[]).includes(raw)) {
    return { ok: false, error: 'unknown_rank' };
  }
  return { ok: true };
}

// Lightweight UUID v4 shape guard (not cryptographic — just prevents junk pibe_ids/pick_ids).
// T-3-RS-09 mitigation: club_id and pibe_id inputs are validated before storage access.
export function isUuid(raw: unknown): boolean {
  return typeof raw === 'string' && UUID_RE.test(raw);
}
