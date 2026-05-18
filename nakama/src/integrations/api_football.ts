// nakama/src/integrations/api_football.ts
// HTTP adapter for api-sports.io / api-football v3.
//
// Boundaries:
//   - Read API key from ctx.env['API_FOOTBALL_KEY']. If missing, log + return 0
//     (CLB-05 fallback — scheduler runs without external dependency, D-04).
//   - Two AFA leagues: Primera (Liga Profesional) + Primera Nacional. League IDs
//     are NOT hardcoded — resolved on first call via /leagues?country=Argentina
//     and persisted to COL_META[api_football_league_ids] (S-4 verification).
//   - Quota math: free tier 100 req/day. 6h cadence = 8 ticks * 2 leagues = 16
//     calls/day. 15m cadence (only when fixture in <24h) = 96 ticks * 2 leagues
//     = 192 calls — over quota, BUT the 24h-fixture window is brief (a few days
//     per season around clusters). Real burn is well under 100/day. (S-3.)
//   - 429 short-circuits: return current `total` rather than throw. Subsequent
//     ticks retry organically.
//
// Fixture upsert uses optimistic concurrency: read existing `version`, write
// with `version: <existing>`, retry once without version on version_mismatch.
// Rationale: tick_lock provides single-writer for scheduled ticks; the version
// catches the narrow window where admin_force_repoll (plan 02-05) fires while a
// tick is committed but not yet locked.
//
// club_team_map: built once per season (or when stale >7d). Fetches /teams for
// both AFA leagues, fuzzy-matches API-Football team name+city against Phase 1
// COL_CLUBS lunfardo_name. Unmatched teams written to meta:unmatched_clubs for
// manual reconciliation via admin_set_club_team_mapping (plan 02-05).

import {
  COL_FIXTURES,
  COL_META,
  SYSTEM_USER_ID,
  KEY_API_FOOTBALL_LEAGUE_IDS,
} from '../storage_keys';

const API_BASE = 'https://v3.football.api-sports.io';
const CLUB_TEAM_MAP_KEY = 'club_team_map';
const UNMATCHED_CLUBS_KEY = 'unmatched_clubs';
const CLUB_MAP_TTL_MS = 7 * 24 * 3600 * 1000;

interface CachedLeagueIds {
  primera_id: number;
  nacional_id: number;
  resolved_at: number;
}

interface NormalizedFixture {
  fixture_id: string;
  league_id: number;
  division: 'primera' | 'nacional';
  season: number;
  round: string;
  kickoff_utc: number;
  status:
    | 'NS'
    | '1H'
    | 'HT'
    | '2H'
    | 'ET'
    | 'P'
    | 'FT'
    | 'PST'
    | 'CANC'
    | 'SUSP'
    | 'AWD'
    | 'WO'
    | string;
  home: { team_id: number; name: string };
  away: { team_id: number; name: string };
  club_home_id: string | null;
  club_away_id: string | null;
  fetched_at: number;
}

interface ClubTeamMapMeta {
  map: { [clubId: string]: number };
  built_at: number;
}

function getLeagueIds(
  ctx: nkruntime.Context,
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
): CachedLeagueIds {
  const read = nk.storageRead([
    {
      collection: COL_META,
      key: KEY_API_FOOTBALL_LEAGUE_IDS,
      userId: SYSTEM_USER_ID,
    },
  ]);
  if (read.length > 0) return read[0].value as CachedLeagueIds;

  // Resolve from API — costs 1 of 100 daily calls.
  const apiKey = ctx.env['API_FOOTBALL_KEY'];
  if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured');
  const resp = nk.httpRequest(
    API_BASE + '/leagues?country=Argentina&current=true',
    'get',
    { 'x-apisports-key': apiKey },
    undefined,
    8000,
  );
  if (resp.code !== 200) throw new Error('leagues lookup failed: ' + resp.code);
  const body = JSON.parse(resp.body) as {
    response: Array<{ league: { id: number; name: string } }>;
  };
  let primera_id = 0;
  let nacional_id = 0;
  for (const item of body.response) {
    const name = String(item.league.name).toLowerCase();
    if (name.indexOf('liga profesional') !== -1) primera_id = item.league.id;
    if (name.indexOf('primera nacional') !== -1) nacional_id = item.league.id;
  }
  if (!primera_id || !nacional_id) {
    throw new Error(
      'Could not resolve Argentine leagues: ' + resp.body.substring(0, 200),
    );
  }
  const cached: CachedLeagueIds = {
    primera_id,
    nacional_id,
    resolved_at: Date.now(),
  };
  nk.storageWrite([
    {
      collection: COL_META,
      key: KEY_API_FOOTBALL_LEAGUE_IDS,
      userId: SYSTEM_USER_ID,
      value: cached as unknown as { [key: string]: unknown },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info(
    'Resolved API-Football league IDs: primera=%d nacional=%d',
    primera_id,
    nacional_id,
  );
  return cached;
}

export function pollFixtures(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  windowDays: number,
): number {
  const apiKey = ctx.env['API_FOOTBALL_KEY'];
  if (!apiKey) {
    // CLB-05 fallback: scheduler runs without external dependency (D-04).
    logger.warn('API_FOOTBALL_KEY missing; skipping poll');
    return 0;
  }

  const leagueIds = getLeagueIds(ctx, nk, logger);
  const now = new Date();
  const from = isoDate(new Date(now.getTime() - 86400000)); // now - 1d
  const to = isoDate(new Date(now.getTime() + windowDays * 86400000));
  const season = now.getUTCFullYear();

  // Load club_team_map ONCE per pollFixtures invocation so each fixture
  // upsert doesn't re-read it (S-3 quota math, minimize storage reads).
  const reverseMap = loadReverseClubTeamMap(nk);

  let total = 0;
  const leaguePairs: Array<['primera' | 'nacional', number]> = [
    ['primera', leagueIds.primera_id],
    ['nacional', leagueIds.nacional_id],
  ];
  for (const pair of leaguePairs) {
    const div = pair[0];
    const leagueId = pair[1];
    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt < 3) {
      try {
        const url =
          API_BASE +
          '/fixtures?league=' +
          String(leagueId) +
          '&season=' +
          String(season) +
          '&from=' +
          from +
          '&to=' +
          to +
          '&timezone=America/Argentina/Buenos_Aires';
        const resp = nk.httpRequest(
          url,
          'get',
          { 'x-apisports-key': apiKey },
          undefined,
          8000,
        );
        if (resp.code === 429) {
          // Headers shape varies; cast defensively (typedef declares string[]
          // but Goja in practice returns an object on api-sports responses).
          const headers = resp.headers as unknown as {
            [k: string]: string | string[];
          };
          const remaining =
            (headers && headers['x-ratelimit-requests-remaining']) || 'unknown';
          logger.warn(
            '[api-football] 429 rate-limited; remaining=%s; aborting',
            String(remaining),
          );
          return total;
        }
        if (resp.code !== 200) {
          throw new Error(
            'status=' + String(resp.code) + ' body=' + resp.body.substring(0, 200),
          );
        }
        const body = JSON.parse(resp.body) as { response: unknown[] };
        for (const item of body.response) {
          const norm = normalizeFixture(item, div, reverseMap);
          upsertFixture(nk, logger, norm);
          total++;
        }
        break; // success — exit retry loop
      } catch (e) {
        lastErr = e;
        attempt++;
        if (attempt < 3) {
          // Goja has no setTimeout; "backoff" = no-op. Just retry immediately.
          // (Next tick will retry organically if all 3 fail.)
        }
      }
    }
    if (attempt >= 3) {
      logger.warn(
        '[api-football] %s polling failed after 3 attempts: %s',
        div,
        String(lastErr),
      );
    }
  }

  // On first successful poll of a season — or when the existing map is stale —
  // rebuild club_team_map (S-3 quota math: 2 /teams calls per season, well
  // under quota; T-2-MAP-02 mitigation).
  maybeBuildClubTeamMap(ctx, logger, nk);

  return total;
}

function normalizeFixture(
  item: unknown,
  div: 'primera' | 'nacional',
  reverseMap: { [teamId: number]: string },
): NormalizedFixture {
  const it = item as {
    fixture: { id: number; timestamp: number; status: { short: string } };
    league: { id: number; season: number; round: string };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
  };
  const homeTeamId = it.teams.home.id;
  const awayTeamId = it.teams.away.id;
  return {
    fixture_id: String(it.fixture.id),
    league_id: it.league.id,
    division: div,
    season: it.league.season,
    round: it.league.round,
    kickoff_utc: it.fixture.timestamp * 1000,
    status: it.fixture.status.short,
    home: { team_id: homeTeamId, name: it.teams.home.name },
    away: { team_id: awayTeamId, name: it.teams.away.name },
    club_home_id: reverseMap[homeTeamId] != null ? reverseMap[homeTeamId] : null,
    club_away_id: reverseMap[awayTeamId] != null ? reverseMap[awayTeamId] : null,
    fetched_at: Date.now(),
  };
}

// Optimistic concurrency: read version first to protect against
// admin_force_repoll <-> tick race. Tick_lock provides single-writer for
// scheduled ticks; `version` catches the narrow race window where
// admin_force_repoll fires while a tick is committed but not yet locked.
function upsertFixture(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  f: NormalizedFixture,
): void {
  const existing = nk.storageRead([
    { collection: COL_FIXTURES, key: f.fixture_id, userId: SYSTEM_USER_ID },
  ]);
  const version = existing.length > 0 ? existing[0].version : undefined;
  try {
    const req: nkruntime.StorageWriteRequest = {
      collection: COL_FIXTURES,
      key: f.fixture_id,
      userId: SYSTEM_USER_ID,
      value: f as unknown as { [key: string]: unknown },
      permissionRead: 2,
      permissionWrite: 0,
    };
    if (version !== undefined) req.version = version;
    nk.storageWrite([req]);
  } catch (e) {
    const msg = String(e);
    if (
      msg.indexOf('version_mismatch') !== -1 ||
      msg.indexOf('version conflict') !== -1
    ) {
      logger.warn(
        '[api_football] version_mismatch on fixture=%s — retrying without version',
        f.fixture_id,
      );
      try {
        nk.storageWrite([
          {
            collection: COL_FIXTURES,
            key: f.fixture_id,
            userId: SYSTEM_USER_ID,
            value: f as unknown as { [key: string]: unknown },
            permissionRead: 2,
            permissionWrite: 0,
          },
        ]);
      } catch (e2) {
        logger.error(
          '[api_football] retry also failed for fixture=%s: %s',
          f.fixture_id,
          String(e2),
        );
        // Skip — next tick will try again.
      }
    } else {
      throw e; // Unexpected error — propagate.
    }
  }
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in UTC
  return (
    String(d.getUTCFullYear()) +
    '-' +
    pad2(d.getUTCMonth() + 1) +
    '-' +
    pad2(d.getUTCDate())
  );
}

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

// Loads the existing club_team_map (Phase1 slug -> API team id) and inverts
// it (API team id -> Phase 1 slug) for O(1) lookup during fixture normalize.
function loadReverseClubTeamMap(nk: nkruntime.Nakama): {
  [teamId: number]: string;
} {
  const r = nk.storageRead([
    { collection: COL_META, key: CLUB_TEAM_MAP_KEY, userId: SYSTEM_USER_ID },
  ]);
  if (r.length === 0) return {};
  const stored = r[0].value as ClubTeamMapMeta | { [k: string]: number };
  // Tolerate both shapes: raw map or { map, built_at }. Treat any object whose
  // first value is a number as a raw map.
  let rawMap: { [k: string]: number };
  if (
    (stored as ClubTeamMapMeta).map &&
    typeof (stored as ClubTeamMapMeta).map === 'object'
  ) {
    rawMap = (stored as ClubTeamMapMeta).map;
  } else {
    rawMap = stored as { [k: string]: number };
  }
  const reverse: { [teamId: number]: string } = {};
  for (const clubId in rawMap) {
    if (Object.prototype.hasOwnProperty.call(rawMap, clubId)) {
      const teamId = rawMap[clubId];
      if (typeof teamId === 'number') reverse[teamId] = clubId;
    }
  }
  return reverse;
}

// Builds the map only when missing OR older than CLUB_MAP_TTL_MS (T-2-MAP-02
// mitigation). Two /teams calls (Primera + Nacional) — well within quota even
// on free tier when ticks gate via TTL.
function maybeBuildClubTeamMap(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
): void {
  const r = nk.storageRead([
    { collection: COL_META, key: CLUB_TEAM_MAP_KEY, userId: SYSTEM_USER_ID },
  ]);
  if (r.length > 0) {
    const stored = r[0].value as ClubTeamMapMeta;
    if (
      stored &&
      typeof stored.built_at === 'number' &&
      Date.now() - stored.built_at < CLUB_MAP_TTL_MS
    ) {
      return; // fresh enough
    }
  }
  try {
    buildClubTeamMap(ctx, logger, nk);
  } catch (e) {
    logger.warn(
      '[club_map] buildClubTeamMap failed: %s (will retry next tick)',
      String(e),
    );
  }
}

// buildClubTeamMap: Fetches all teams for both AFA leagues and builds a
// mapping from Phase 1 club_id (lunfardo slug) to API-Football team_id.
//
// Writes to meta:club_team_map  ({ map: {...}, built_at })
// and    meta:unmatched_clubs   ({ [team_name]: { league_id, team_id, city } }).
//
// Fuzzy match: normalize team name + city to lowercase, strip accents, match
// against club lunfardo_name (Phase 1 COL_CLUBS). Manual override available
// via admin_set_club_team_mapping RPC (plan 02-05).
export function buildClubTeamMap(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
): void {
  const leagueIdsRead = nk.storageRead([
    {
      collection: COL_META,
      key: KEY_API_FOOTBALL_LEAGUE_IDS,
      userId: SYSTEM_USER_ID,
    },
  ]);
  if (leagueIdsRead.length === 0) {
    logger.warn('[club_map] no league IDs stored yet — run pollFixtures first');
    return;
  }
  const leagueIds = leagueIdsRead[0].value as {
    primera_id?: number;
    nacional_id?: number;
  };
  const year = new Date().getUTCFullYear();
  const apiKey = ctx.env['API_FOOTBALL_KEY'];
  if (!apiKey) {
    logger.warn('[club_map] API_FOOTBALL_KEY missing — skipping club_team_map build');
    return;
  }

  // Read Phase 1 clubs (COL_CLUBS lives under SYSTEM_USER_ID).
  const clubs: Array<{ id: string; lunfardo_name: string; barrio_hq?: string }> =
    [];
  let cursor = '';
  for (let i = 0; i < 20; i++) {
    const page = nk.storageList(SYSTEM_USER_ID, 'clubs', 100, cursor);
    for (const obj of page.objects || []) {
      const c = obj.value as {
        id?: string;
        lunfardo_name?: string;
        barrio_hq?: string;
      };
      if (c.id && c.lunfardo_name) {
        clubs.push({
          id: c.id,
          lunfardo_name: c.lunfardo_name,
          barrio_hq: c.barrio_hq,
        });
      }
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }

  const normalize = function (s: string): string {
    // toLowerCase + ASCII-fold via NFD strip + collapse to alphanumeric+space.
    // ES2017 has String.prototype.normalize.
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .trim();
  };

  const clubTeamMap: { [k: string]: number } = {};
  const unmatchedClubs: {
    [k: string]: { league_id: number; team_id: number; city: string };
  } = {};

  const allLeagueIds: number[] = [];
  if (leagueIds.primera_id) allLeagueIds.push(leagueIds.primera_id);
  if (leagueIds.nacional_id) allLeagueIds.push(leagueIds.nacional_id);

  for (const leagueId of allLeagueIds) {
    let teamsResp: { response?: Array<{ team: unknown }> } | undefined;
    try {
      const r = nk.httpRequest(
        API_BASE +
          '/teams?league=' +
          String(leagueId) +
          '&season=' +
          String(year),
        'get',
        { 'x-apisports-key': apiKey },
        undefined,
        8000,
      );
      if (r.code !== 200) {
        logger.warn(
          '[club_map] /teams returned %d for league=%d',
          r.code,
          leagueId,
        );
        continue;
      }
      teamsResp = JSON.parse(r.body);
    } catch (e) {
      logger.error(
        '[club_map] /teams fetch failed for league=%d: %s',
        leagueId,
        String(e),
      );
      continue;
    }

    const entries = (teamsResp && teamsResp.response) || [];
    for (const entry of entries) {
      const apiTeam = (entry as { team: { id?: number; name?: string; city?: string } })
        .team;
      if (!apiTeam.id || !apiTeam.name) continue;
      const apiNameNorm = normalize(apiTeam.name);
      const apiWords: { [w: string]: boolean } = {};
      for (const w of apiNameNorm.split(' ')) {
        if (w.length > 2) apiWords[w] = true;
      }

      // Try to match against Phase 1 clubs.
      let bestMatch: string | null = null;
      let bestScore = 0;
      for (const club of clubs) {
        const clubNorm = normalize(club.lunfardo_name);
        let overlap = 0;
        for (const w of clubNorm.split(' ')) {
          if (w.length > 2 && apiWords[w]) overlap++;
        }
        if (overlap > bestScore) {
          bestScore = overlap;
          bestMatch = club.id;
        }
      }

      if (bestMatch && bestScore >= 1) {
        clubTeamMap[bestMatch] = apiTeam.id;
        logger.info(
          '[club_map] matched club_id=%s -> team_id=%d (%s)',
          bestMatch,
          apiTeam.id,
          apiTeam.name,
        );
      } else {
        unmatchedClubs[apiTeam.name] = {
          league_id: leagueId,
          team_id: apiTeam.id,
          city: apiTeam.city || '',
        };
        logger.warn(
          '[club_map] unmatched api_team=%s (id=%d, league=%d) — add via admin_set_club_team_mapping',
          apiTeam.name,
          apiTeam.id,
          leagueId,
        );
      }
    }
  }

  const wrapped: ClubTeamMapMeta = { map: clubTeamMap, built_at: Date.now() };
  nk.storageWrite([
    {
      collection: COL_META,
      key: CLUB_TEAM_MAP_KEY,
      userId: SYSTEM_USER_ID,
      value: wrapped as unknown as { [key: string]: unknown },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  nk.storageWrite([
    {
      collection: COL_META,
      key: UNMATCHED_CLUBS_KEY,
      userId: SYSTEM_USER_ID,
      value: unmatchedClubs as unknown as { [key: string]: unknown },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info(
    '[club_map] built: %d matched, %d unmatched',
    Object.keys(clubTeamMap).length,
    Object.keys(unmatchedClubs).length,
  );
}
