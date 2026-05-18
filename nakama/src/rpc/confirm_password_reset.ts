// RPC: confirm_password_reset (Phase 2 REAL)
//
// Flow:
//   1. Validate input shape (token 8-256 chars, new_password 8-256 chars).
//   2. Scan COL_RESET_TOKENS across all users (storageList with empty userId, S-16).
//   3. Reject if token already consumed, expired, or not found.
//   4. Look up account's email via raw SQL by userId (NEVER trust client input — S-9).
//   5. Mutate password via nk.linkEmail (Heroic Labs issue #275: overwrites email creds).
//   6. Consume token atomically: rewrite with consumed_at + expires_at=0, prevents replay.

import { COL_RESET_TOKENS } from '../storage_keys';

export function rpcConfirmPasswordReset(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  let input: { token?: unknown; new_password?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_json_payload' }); }

  if (typeof input.token !== 'string' || input.token.length < 8 || input.token.length > 256) {
    return JSON.stringify({ ok: false, error: 'invalid_token' });
  }
  if (typeof input.new_password !== 'string'
      || input.new_password.length < 8 || input.new_password.length > 256) {
    return JSON.stringify({ ok: false, error: 'invalid_new_password' });
  }

  const token = input.token;
  const newPassword = input.new_password;

  // No index on value field — must scan COL_RESET_TOKENS. At Phase 2 scale
  // (~tens of pending tokens) this is fine. Add a secondary token→userId
  // index collection at Phase 6+ scale.
  let foundUserId: string | null = null;
  let foundVersion: string | null = null;
  let cursor = '';
  scan: for (let pg = 0; pg < 50; pg++) {
    const page = nk.storageList('', COL_RESET_TOKENS, 100, cursor);
    for (const obj of (page.objects || [])) {
      const v = obj.value as { token: string; expires_at: number; consumed_at?: number };
      if (v.token === token) {
        if (v.consumed_at) return JSON.stringify({ ok: false, error: 'token_already_used' });
        if (v.expires_at < Date.now()) return JSON.stringify({ ok: false, error: 'token_expired' });
        foundUserId = obj.userId;
        foundVersion = obj.version;
        break scan;
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  if (!foundUserId) return JSON.stringify({ ok: false, error: 'token_invalid' });

  // S-9: look up email by userId (never trust input). linkEmail overwrites
  // the email/password credential pair for this account (issue #275).
  const sql = nk.sqlQuery('SELECT email FROM users WHERE id = $1 LIMIT 1', [foundUserId]);
  if (sql.length === 0) return JSON.stringify({ ok: false, error: 'user_not_found' });
  const email = sql[0]['email'] as string;

  try {
    nk.linkEmail(foundUserId, email, newPassword);
  } catch (e) {
    logger.error('[reset] linkEmail failed for %s: %s', foundUserId, String(e));
    return JSON.stringify({ ok: false, error: 'internal_error' });
  }

  // Atomic consume: expires_at=0 + consumed_at marker, guarded by version.
  nk.storageWrite([{
    collection: COL_RESET_TOKENS, key: 'reset', userId: foundUserId,
    value: { token, expires_at: 0, consumed_at: Date.now() },
    version: foundVersion !== null ? foundVersion : undefined,
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[reset] password mutated for userId=%s', foundUserId);
  return JSON.stringify({ ok: true });
}
