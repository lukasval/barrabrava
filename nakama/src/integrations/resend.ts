// nakama/src/integrations/resend.ts
//
// Resend HTTP adapter for password reset emails.
// Gated by RESEND_ENABLED env var (default "false" in Phase 2).
//
// D-25: when false, caller logs the reset link instead; no HTTP call made here.
// D-26: Email template inline HTML, español, lunfardo header.
// D-27: Token GC is passive — no cleanup job here.
//
// ACTIVATE ONLY AFTER: domain purchased, DNS verified in Resend, RESEND_FROM set
// to <name>@<verified-domain>. See INFRA-NOTES.md §"Resend (Pending)" for the
// one-line flip recipe.

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

const RESEND_API_URL = 'https://api.resend.com/emails';

function buildEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Recuperá tu contraseña</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#c0392b;">Recuperá tu contraseña — Liga Aguante</h2>
  <p>Alguien (esperemos que vos) pidió restablecer la contraseña de tu cuenta.</p>
  <p>
    <a href="${resetLink}" style="background:#c0392b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
      Cambiar contraseña
    </a>
  </p>
  <p style="color:#666;font-size:12px;">Este enlace expira en 1 hora. Si no pediste esto, ignoralo.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#999;font-size:11px;">Liga Aguante — Juego de estrategia de fútbol argentino. Ficción pura.</p>
</body>
</html>`;
}

export function sendResetEmail(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  input: SendResetEmailInput,
): SendResetEmailResult {
  if (!input.apiKey) {
    logger.warn('[resend] RESEND_API_KEY missing; cannot send');
    return { sent: false, reason: 'missing_api_key' };
  }

  // S-8: guard against sending from unverified domain.
  const from = input.fromEmail || 'BarraBrava <onboarding@resend.dev>';
  if (from.indexOf('resend.dev') !== -1) {
    logger.warn(
      '[resend] fromEmail contains resend.dev — sandbox only delivers to dev email. ' +
      'Flip RESEND_FROM to <name>@<verified-domain> before enabling in prod.',
    );
  }

  const body = JSON.stringify({
    from,
    to: [input.to],
    subject: 'Recuperá tu contraseña — Liga Aguante',
    html: buildEmailHtml(input.resetLink),
  });

  try {
    const resp = nk.httpRequest(
      RESEND_API_URL,
      'post',
      { 'Authorization': 'Bearer ' + input.apiKey, 'Content-Type': 'application/json' },
      body,
      8000,
    );
    if (resp.code >= 200 && resp.code < 300) {
      logger.info('[resend] email sent to %s', input.to);
      return { sent: true };
    }
    logger.warn('[resend] send failed code=%d body=%s', resp.code, String(resp.body).substring(0, 200));
    return { sent: false, reason: 'http_error' };
  } catch (e) {
    logger.error('[resend] exception: %s', String(e));
    return { sent: false, reason: 'exception' };
  }
}
