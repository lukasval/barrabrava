// RPC: admin_test_validate_topic
//
// Test-harness RPC that exposes validateTopicName for deterministic test assertions
// (VALIDATION.md 02-04-DAY03-topic). Gated by ADMIN_TEST_MODE=true — NOT available
// in production. Bearer-token required via requireAdmin (same as admin_inject_test_fixture).
//
// Input:  { topic_in: string }
// Output: { ok: true, normalized: string } | { ok: false, error: string }

import { validateTopicName } from '../util/topic_name';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminTestValidateTopic(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  payload: string,
): string {
  if (ctx.env['ADMIN_TEST_MODE'] !== 'true') {
    return JSON.stringify({ ok: false, error: 'test_mode_disabled' });
  }
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { topic_in?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  const result = validateTopicName(input.topic_in);
  logger.info('[admin][test] validate_topic topic_in=%s ok=%s',
    String(input.topic_in), result.ok ? 'true' : 'false');
  return JSON.stringify(
    result.ok
      ? { ok: true, normalized: result.sanitized }
      : { ok: false, error: result.error },
  );
}
