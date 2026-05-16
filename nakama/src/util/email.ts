// Resend email integration — DEFERRED to Phase 2+ per INFRA-NOTES.md.
//
// This module is a STUB for Phase 1. The Resend account + verified domain are not provisioned yet,
// so the real `nk.httpRequest("https://api.resend.com/emails", ...)` call is not wired.
//
// The function signature is kept so request_password_reset.ts can call it without conditionals.
// When Phase 2 picks up Resend setup, replace the body of sendResetEmail() with the real API call
// pattern from 01-RESEARCH.md §6 and leave the signature identical.

export interface SendResetEmailInput {
  to: string;
  resetLink: string;
  fromEmail?: string;
  apiKey?: string;
}

export interface SendResetEmailResult {
  sent: boolean;
  reason?: string; // "stubbed" | "missing_api_key" | "http_error" | etc.
}

export function sendResetEmail(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: SendResetEmailInput,
): SendResetEmailResult {
  // TODO Phase 2: replace this stub with the real Resend HTTP call.
  // Reference impl (from 01-RESEARCH.md §6):
  //
  //   const apiKey = input.apiKey ?? '';
  //   if (!apiKey) {
  //     logger.warn('[email] RESEND_API_KEY missing — cannot send reset email');
  //     return { sent: false, reason: 'missing_api_key' };
  //   }
  //   const fromEmail = input.fromEmail ?? 'noreply@barrabrava.ar';
  //   const body = JSON.stringify({
  //     from: 'BarraBrava <' + fromEmail + '>',
  //     to: [input.to],
  //     subject: 'Reseteo de contraseña — BarraBrava',
  //     html: '<p>Hacé clic acá para resetear tu contraseña: <a href="' + input.resetLink + '">' + input.resetLink + '</a></p>',
  //   });
  //   try {
  //     const res = nk.httpRequest('https://api.resend.com/emails', 'post', {
  //       'Authorization': 'Bearer ' + apiKey,
  //       'Content-Type': 'application/json',
  //     }, body);
  //     if (res.code >= 200 && res.code < 300) {
  //       return { sent: true };
  //     }
  //     logger.warn('[email] Resend non-2xx: %d %s', res.code, res.body);
  //     return { sent: false, reason: 'http_error' };
  //   } catch (e) {
  //     logger.warn('[email] Resend exception: %s', String(e));
  //     return { sent: false, reason: 'exception' };
  //   }

  // Phase 1 stub — no email sent, just log the intent (token NOT logged — T-1-RT-08).
  logger.info('[Phase 1 stub] password reset email would be sent to: %s', input.to);
  return { sent: false, reason: 'stubbed' };
}
