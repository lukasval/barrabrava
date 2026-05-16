// RPC: get_clubs
//
// Returns the catalog of seeded clubs. Supports optional filtering by `division`
// and basic offset/limit pagination so the client can render large lists
// without pulling all ~133 entries at once.
//
// Input  (JSON): { division?: string, search?: string, page?: number, page_size?: number }
// Output (JSON): { clubs: Club[], total: number, page: number, page_size: number }

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface GetClubsInput {
  division?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export const rpcGetClubs: nkruntime.RpcFunction = (
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string => {
  let input: GetClubsInput = {};
  if (payload && payload.length > 0) {
    try {
      input = JSON.parse(payload) as GetClubsInput;
    } catch (e) {
      throw new Error('invalid_json_payload');
    }
  }

  const page = typeof input.page === 'number' && input.page > 0 ? Math.floor(input.page) : 1;
  let pageSize =
    typeof input.page_size === 'number' && input.page_size > 0
      ? Math.floor(input.page_size)
      : DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  // Read full collection. With ~133 small objects this is cheap and avoids a
  // dependency on a per-division index. Listing is paginated via Nakama's cursor
  // API and aggregated in-memory.
  let cursor = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  // Cap iterations to avoid runaway loops if Storage misbehaves.
  for (let i = 0; i < 50; i++) {
    const result = nk.storageList(SYSTEM_USER_ID, 'clubs', 100, cursor);
    if (result.objects && result.objects.length > 0) {
      for (let j = 0; j < result.objects.length; j++) {
        all.push(result.objects[j].value);
      }
    }
    if (!result.cursor) break;
    cursor = result.cursor;
  }

  // Apply filters.
  let filtered = all;
  if (input.division && typeof input.division === 'string') {
    const div = input.division.trim().toLowerCase();
    filtered = filtered.filter((c) => typeof c.division === 'string' && c.division.toLowerCase() === div);
  }
  if (input.search && typeof input.search === 'string') {
    const q = input.search.trim().toLowerCase();
    if (q.length > 0) {
      filtered = filtered.filter(
        (c) =>
          (typeof c.lunfardo_name === 'string' && c.lunfardo_name.toLowerCase().indexOf(q) !== -1) ||
          (typeof c.barrio_hq === 'string' && c.barrio_hq.toLowerCase().indexOf(q) !== -1) ||
          (typeof c.city === 'string' && c.city.toLowerCase().indexOf(q) !== -1),
      );
    }
  }

  // Stable sort: division, then division_rank, then lunfardo_name.
  filtered.sort((a, b) => {
    const da = String(a.division || '');
    const db = String(b.division || '');
    if (da !== db) return da < db ? -1 : 1;
    const ra = typeof a.division_rank === 'number' ? a.division_rank : 9999;
    const rb = typeof b.division_rank === 'number' ? b.division_rank : 9999;
    if (ra !== rb) return ra - rb;
    return String(a.lunfardo_name || '').localeCompare(String(b.lunfardo_name || ''));
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  logger.debug('get_clubs: division=%s search=%s page=%d returned=%d total=%d', String(input.division || ''), String(input.search || ''), page, slice.length, total);

  return JSON.stringify({ clubs: slice, total, page, page_size: pageSize });
};
