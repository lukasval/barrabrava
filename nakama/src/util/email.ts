// DEPRECATED: Phase 2 moved the real Resend HTTP adapter to
// nakama/src/integrations/resend.ts. This file is kept ONLY to preserve the
// SendResetEmailInput / SendResetEmailResult type shape that any future caller
// outside the password-reset flow might import. New code should import from
// '../integrations/resend' directly.

export interface SendResetEmailInput {
  to: string;
  resetLink: string;
  fromEmail?: string;
  apiKey?: string;
}

export interface SendResetEmailResult {
  sent: boolean;
  reason?: string;
}

export function sendResetEmail(
  _nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  _input: SendResetEmailInput,
): SendResetEmailResult {
  logger.warn('[email] util/email.sendResetEmail is deprecated — use integrations/resend.sendResetEmail');
  return { sent: false, reason: 'use_integrations_resend' };
}
