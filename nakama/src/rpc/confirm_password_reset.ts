// RPC: confirm_password_reset (Phase 1 STUB)
//
// Real password-mutation flow is DEFERRED to Phase 2 (depends on Resend stubbed in
// request_password_reset, depends on the reset HTML page in Plan 05). This stub:
//   - Validates input shape (token + new_password).
//   - Returns { ok: false, error: "feature_unavailable_phase_1" } so any UI built against this
//     endpoint surfaces an explicit error instead of silently appearing to succeed.
//   - Does NOT mutate any password.
//
// When Phase 2 wires this:
//   1. Read token from collection 'reset_tokens'.
//   2. Verify token not expired (compare expires_at vs Date.now()).
//   3. Validate new_password (length ≥ 8, etc.).
//   4. accountUpdateId(userId, { ... }) — or accountLinkEmail with new password.
//   5. storageDelete the token (one-shot — T-1-RT-07).
//   6. Return { ok: true }.

interface ConfirmResetInput {
  token?: unknown;
  new_password?: unknown;
}

export const rpcConfirmPasswordReset: nkruntime.RpcFunction = (
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  payload: string,
): string => {
  let input: ConfirmResetInput = {};
  try {
    input = (payload ? JSON.parse(payload) : {}) as ConfirmResetInput;
  } catch (e) {
    return JSON.stringify({ ok: false, error: 'invalid_json_payload' });
  }

  if (typeof input.token !== 'string' || input.token.length < 8 || input.token.length > 256) {
    return JSON.stringify({ ok: false, error: 'invalid_token' });
  }
  if (typeof input.new_password !== 'string' || input.new_password.length < 8 || input.new_password.length > 256) {
    return JSON.stringify({ ok: false, error: 'invalid_new_password' });
  }

  // TODO Phase 2: real token check + password mutation here.
  return JSON.stringify({ ok: false, error: 'feature_unavailable_phase_1' });
};
