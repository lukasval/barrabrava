// RPC: request_password_reset (Phase 1 STUB)
//
// Real Resend integration is DEFERRED to Phase 2 (see INFRA-NOTES.md — Resend account + verified
// domain not provisioned yet). This stub:
//   - Validates input shape (must be an email-looking string).
//   - Returns the uniform anti-enumeration response { ok: true } regardless of whether the email
//     exists (T-1-RT-02 — Information Disclosure).
//   - Logs the INTENT to send an email (token NOT logged — T-1-RT-08).
//   - Does NOT call Resend / nk.httpRequest.
//   - Does NOT write a reset token to Storage (no point — confirm_password_reset is also stubbed).
//
// When Phase 2 wires Resend, replace the stub block below with the real flow:
//   1. Look up account by email (accountsGetIds → email field, or custom email→userId index).
//   2. Generate a random token (nk.uuidv4()) + reset link (PASSWORD_RESET_BASE_URL + token).
//   3. storageWrite token into collection 'reset_tokens' under userId with TTL semantics
//      (store expires_at, ignore tokens whose expires_at has passed at confirm time).
//   4. sendResetEmail(nk, logger, { to, resetLink, fromEmail, apiKey }).
//   5. Always return { ok: true }.

import { isValidEmailShape } from '../util/validation';

interface RequestResetInput {
  email?: unknown;
}

export const rpcRequestPasswordReset: nkruntime.RpcFunction = (
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  payload: string,
): string => {
  let input: RequestResetInput = {};
  try {
    input = (payload ? JSON.parse(payload) : {}) as RequestResetInput;
  } catch (e) {
    // Anti-enumeration: even on malformed payload we don't reveal anything specific.
    return JSON.stringify({ ok: true });
  }

  if (!isValidEmailShape(input.email)) {
    // Same uniform response — we don't tell the client whether the address shape was wrong.
    return JSON.stringify({ ok: true });
  }

  const email = (input.email as string).trim();
  logger.info('[Phase 1 stub] password reset email would be sent to: %s', email);

  // TODO Phase 2: real Resend + token persistence here.
  return JSON.stringify({ ok: true });
};
