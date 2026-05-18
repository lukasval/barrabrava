// RPC: admin_list_windows
//
// Read-only debug dump of COL_MATCH_WINDOWS. Optional state filter
// ('scheduled' | 'open' | 'live' | 'closed' | 'cancelled'). Paginates server-side
// (50 × 100 rows max) — adequate for Phase 2 scale (~hundreds of windows).
//
// Input: { state?: string }
// Output: { ok: true, windows: [...], count: number } | { ok: false, error: string }

import { COL_MATCH_WINDOWS, SYSTEM_USER_ID } from '../storage_keys';
import { requireAdmin } from '../util/admin_auth';

export function rpcAdminListWindows(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const auth = requireAdmin(ctx, logger);
  if (!auth.ok) return JSON.stringify({ ok: false, error: auth.error });

  let input: { state?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { /* state filter is optional — ignore parse errors */ }

  const filterState = typeof input.state === 'string' ? input.state : null;

  const results: Array<Record<string, unknown>> = [];
  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const page = nk.storageList(SYSTEM_USER_ID, COL_MATCH_WINDOWS, 100, cursor);
    for (const obj of (page.objects || [])) {
      const w = obj.value as Record<string, unknown>;
      if (!filterState || w.state === filterState) results.push(w);
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  logger.info('[admin] list_windows filter=%s count=%d by ip=%s',
    filterState || 'all', results.length, auth.callerIp);
  return JSON.stringify({ ok: true, windows: results, count: results.length });
}
