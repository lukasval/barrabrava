// util/admin_auth.ts
// Admin bearer token middleware.
// D-20: ADMIN_BEARER env var gates all admin RPCs. Constant-time compare prevents timing oracle.
// Security tag: constant-time string comparison mitigates T-2-ADM-01 timing oracle.
// Used by: all admin_*.ts RPCs (plan 02-05) AND admin_inject_test_fixture.ts (this plan).

const HEADER_KEY = 'authorization'; // Nakama lower-cases header names in ctx

export function requireAdmin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
): { ok: true; callerIp: string } | { ok: false; error: string } {
  const expected = ctx.env['ADMIN_BEARER'];
  if (!expected || expected.length < 16) {
    logger.error('[admin] ADMIN_BEARER not configured');
    return { ok: false, error: 'admin_disabled' };
  }
  const auth = ctx.headers && (ctx.headers[HEADER_KEY] || ctx.headers['Authorization']);
  const header: string | undefined = Array.isArray(auth) ? auth[0] : (auth as any);
  if (!header || !header.startsWith('Bearer ')) return { ok: false, error: 'unauthorized' };
  const presented = header.substring(7).trim();
  // Constant-time compare (timing oracle mitigation — T-2-ADM-01).
  if (presented.length !== expected.length) return { ok: false, error: 'unauthorized' };
  let diff = 0;
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { ok: false, error: 'unauthorized' };
  const callerIp = (ctx.clientIp as string) || 'unknown';
  return { ok: true, callerIp };
}
