// RPC: request_password_reset (Phase 2 REAL)
//
// Flow:
//   1. Parse + shape-validate email. Anti-enumeration: any failure path still returns {ok:true}.
//   2. Look up userId by email via raw SQL (Nakama has no usersGetEmail).
//   3. Generate uuidv4 token, persist singleton per user in COL_RESET_TOKENS.
//   4. If RESEND_ENABLED=true → sendResetEmail (HTTP to Resend).
//      If RESEND_ENABLED!=true → log the FULL reset link to Railway stdout for dev use
//      (D-25 + S-7 — token NEVER logged on its own; the link IS logged here, dev-only).
//   5. Always return {ok:true}.

import { COL_RESET_TOKENS } from '../storage_keys';
import { isValidEmailShape } from '../util/validation';
import { sendResetEmail } from '../integrations/resend';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export function rpcRequestPasswordReset(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  let email = '';
  try {
    const input = JSON.parse(payload || '{}') as { email?: unknown };
    if (isValidEmailShape(input.email)) {
      email = (input.email as string).trim().toLowerCase();
    }
  } catch (e) { /* fall through */ }

  // ALWAYS return ok: true (anti-enumeration) even when email missing or unknown.
  if (!email) return JSON.stringify({ ok: true });

  // Look up userId by email — Nakama has no usersGetEmail; use raw SQL.
  let userId: string | null = null;
  try {
    const res = nk.sqlQuery('SELECT id::text FROM users WHERE email = $1 LIMIT 1', [email]);
    if (res.length > 0) userId = res[0]['id'] as string;
  } catch (e) {
    logger.error('[reset] SQL lookup failed: %s', String(e));
    return JSON.stringify({ ok: true });
  }
  if (!userId) {
    logger.info('[reset] unknown email (returning ok: true): %s', maskEmail(email));
    return JSON.stringify({ ok: true });
  }

  // Generate token, persist (singleton per user — overwrites prior).
  const token = nk.uuidv4();
  const expires_at = Date.now() + TOKEN_TTL_MS;
  nk.storageWrite([{
    collection: COL_RESET_TOKENS, key: 'reset', userId: userId,
    value: { token, expires_at, requested_at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);

  const resetBase = ctx.env['PASSWORD_RESET_BASE_URL'] || 'https://lukasval.github.io/barrabrava/reset-password/';
  const resetLink = resetBase + '?token=' + token;

  if (ctx.env['RESEND_ENABLED'] !== 'true') {
    // S-7: redacted-token line for normal log scanning, then full link on a dev-only line.
    logger.info('[reset][dev] link for %s (token redacted): %s?token=<redacted>',
      maskEmail(email), resetBase);
    logger.info('[reset][dev] FULL link (DEV ONLY — flip RESEND_ENABLED for prod): %s', resetLink);
  } else {
    const result = sendResetEmail(nk, logger, {
      to: email,
      resetLink,
      fromEmail: ctx.env['RESEND_FROM'] || 'BarraBrava <onboarding@resend.dev>',
      apiKey: ctx.env['RESEND_API_KEY'],
    });
    if (!result.sent) {
      logger.warn('[reset] Resend send failed: %s', result.reason || 'unknown');
      // Still return ok: true — anti-enumeration is paramount.
    }
  }

  return JSON.stringify({ ok: true });
}

function maskEmail(e: string): string {
  const at = e.indexOf('@');
  if (at <= 1) return '***';
  return e[0] + '***' + e.substring(at);
}
