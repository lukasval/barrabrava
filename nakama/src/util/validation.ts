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

// Deny list (substring match, case-insensitive). Keep small and obvious.
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
  'hdp',
  'mogolico',
  'mogolica',
  'orto',
];

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
  const lower = name.toLowerCase();
  for (let i = 0; i < DENY_WORDS.length; i++) {
    if (lower.indexOf(DENY_WORDS[i]) !== -1) {
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
