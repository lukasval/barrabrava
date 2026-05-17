// RPC: create_pibe
//
// Server-authoritative pibe creation.
// - Validates the user is authenticated.
// - Validates `name` (length, charset, deny list) and `club_id` (must exist in seeded clubs).
// - Assigns FIXED stats (50 aguante / 50 velocidad / 50 astucia / 50 carisma) — never trusts client.
// - Persists ONE pibe per user under Storage collection 'pibes', key 'main'.
// - Persists basic player profile under Storage collection 'players', key 'profile'.
//
// Mitigates: T-1-RT-01 (client stat tampering), T-1-RT-03 / T-1-RT-04 (name spoofing/injection).
// Decision D-10: NO faction selection at creation.
// Decision D-11: stats fixed at 50/50/50/50.

import { validatePibeName } from '../util/validation';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface CreatePibeInput {
  name?: unknown;
  club_id?: unknown;
}

interface PibeRecord {
  id: string;
  name: string;
  club_id: string;
  stats: {
    aguante: number;
    velocidad: number;
    astucia: number;
    carisma: number;
  };
  created_at: number;
}

export function rpcCreatePibe(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('not_authenticated');
  }

  let input: CreatePibeInput;
  try {
    input = (payload ? JSON.parse(payload) : {}) as CreatePibeInput;
  } catch (e) {
    throw new Error('invalid_json_payload');
  }

  // Name validation (server-side — T-1-RT-03, T-1-RT-04).
  const nameCheck = validatePibeName(input.name);
  if (!nameCheck.ok) {
    return JSON.stringify({ ok: false, error: nameCheck.error });
  }
  const name = (input.name as string).trim();

  // club_id validation — must exist in the seeded 'clubs' collection.
  if (typeof input.club_id !== 'string' || input.club_id.length === 0 || input.club_id.length > 64) {
    return JSON.stringify({ ok: false, error: 'invalid_club_id' });
  }
  const clubId = input.club_id;
  const clubLookup = nk.storageRead([
    { collection: 'clubs', key: clubId, userId: SYSTEM_USER_ID },
  ]);
  if (clubLookup.length === 0) {
    return JSON.stringify({ ok: false, error: 'club_not_found' });
  }

  // One pibe per account in Phase 1.
  const existing = nk.storageRead([{ collection: 'pibes', key: 'main', userId }]);
  if (existing.length > 0) {
    return JSON.stringify({ ok: false, error: 'pibe_already_exists' });
  }

  const pibeId = nk.uuidv4();
  const now = Date.now();
  const pibe: PibeRecord = {
    id: pibeId,
    name,
    club_id: clubId,
    stats: {
      aguante: 50,
      velocidad: 50,
      astucia: 50,
      carisma: 50,
    },
    created_at: now,
  };

  nk.storageWrite([
    {
      collection: 'pibes',
      key: 'main',
      userId,
      value: pibe,
      permissionRead: 1, // owner read
      permissionWrite: 0, // never client-write — server only via RPC
    },
    {
      collection: 'players',
      key: 'profile',
      userId,
      value: {
        display_name: name,
        club_id: clubId,
        pibe_id: pibeId,
        created_at: now,
      },
      permissionRead: 2, // public — used by club roster screens in later phases
      permissionWrite: 0,
    },
  ]);

  logger.info('create_pibe: user=%s pibe=%s club=%s', userId, pibeId, clubId);

  return JSON.stringify({ ok: true, pibe });
}
