// RPC: admin_inject_test_fixture
//
// Injects a synthetic fixture + match window into Storage for deterministic
// state-machine testing. Gated behind ADMIN_TEST_MODE=true env var.
// MUST NOT be called in production (ADMIN_TEST_MODE should be "false" or unset on Railway prod).
//
// Input: { fixture_id: string, kickoff_utc_iso: string, home: string, away: string }
// Output: { ok: true, fixture_id } | { ok: false, error: string }

import { COL_FIXTURES, COL_MATCH_WINDOWS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminInjectTestFixture(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  // Gate: ADMIN_TEST_MODE must be explicitly "true".
  if (ctx.env['ADMIN_TEST_MODE'] !== 'true') {
    return JSON.stringify({ ok: false, error: 'test_mode_disabled' });
  }
  // Admin auth still required even in test mode.
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { fixture_id?: unknown; kickoff_utc_iso?: unknown; home?: unknown; away?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }

  if (typeof input.fixture_id !== 'string' || input.fixture_id.length === 0)
    return JSON.stringify({ ok: false, error: 'fixture_id_required' });
  if (typeof input.kickoff_utc_iso !== 'string')
    return JSON.stringify({ ok: false, error: 'kickoff_utc_iso_required' });
  if (typeof input.home !== 'string' || typeof input.away !== 'string')
    return JSON.stringify({ ok: false, error: 'home_away_required' });

  const fixtureId = input.fixture_id;
  const kickoffMs = new Date(input.kickoff_utc_iso).getTime();
  if (isNaN(kickoffMs)) return JSON.stringify({ ok: false, error: 'invalid_kickoff_utc_iso' });

  const fixture = {
    fixture_id: fixtureId,
    league_id: 0,
    division: 'primera' as const,
    season: new Date().getUTCFullYear(),
    round: 'Test',
    kickoff_utc: kickoffMs,
    status: 'NS' as const,
    home: { team_id: 0, name: input.home },
    away: { team_id: 0, name: input.away },
    club_home_id: null,
    club_away_id: null,
    fetched_at: Date.now(),
  };
  nk.storageWrite([{
    collection: COL_FIXTURES, key: fixtureId, userId: SYSTEM_USER_ID,
    value: fixture, permissionRead: 2, permissionWrite: 0,
  }]);

  // Inject a match window pre-computed (state = scheduled always on injection).
  const WINDOW_PRE_MS = 2 * 3600 * 1000;
  const WINDOW_POST_MS = 2 * 3600 * 1000;
  const window = {
    fixture_id: fixtureId,
    club_home_id: 'team_0',
    club_away_id: 'team_0',
    kickoff_utc: kickoffMs,
    state: 'scheduled',
    opens_at: kickoffMs - WINDOW_PRE_MS,
    closes_at: kickoffMs + WINDOW_POST_MS,
    source: 'admin',
    updated_at: Date.now(),
  };
  nk.storageWrite([{
    collection: COL_MATCH_WINDOWS, key: fixtureId, userId: SYSTEM_USER_ID,
    value: window, permissionRead: 2, permissionWrite: 0,
  }]);

  // Audit row (D-22).
  nk.storageWrite([{
    collection: 'admin_actions', key: nk.uuidv4(), userId: SYSTEM_USER_ID,
    value: { action: 'admin_inject_test_fixture', fixture_id: fixtureId, caller_ip: auth.callerIp, at: Date.now() },
    permissionRead: 0, permissionWrite: 0,
  }]);
  logger.info('[admin][test] injected fixture=%s kickoff=%s by ip=%s', fixtureId, input.kickoff_utc_iso, auth.callerIp);
  return JSON.stringify({ ok: true, fixture_id: fixtureId });
}
