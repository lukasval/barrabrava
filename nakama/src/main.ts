// BarraBrava Nakama runtime entrypoint.
// Compiled to a single IIFE via esbuild (see ../build.mjs).
//
// On every server boot:
//   1. Seed ~133 clubs into Storage collection 'clubs' (idempotent — guarded by seed marker).
//   2. Register 5 RPCs:
//        get_clubs, create_pibe, delete_account,
//        request_password_reset (Phase 1 stub), confirm_password_reset (Phase 1 stub).
//
// Phase 1 stubs: request/confirm_password_reset do NOT call Resend yet — see INFRA-NOTES.md.

declare const __CLUBS_JSON__: string;

import { rpcGetClubs } from './rpc/get_clubs';
import { rpcCreatePibe } from './rpc/create_pibe';
import { rpcDeleteAccount } from './rpc/delete_account';
import { rpcRequestPasswordReset } from './rpc/request_password_reset';
import { rpcConfirmPasswordReset } from './rpc/confirm_password_reset';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const CLUBS_SEED_VERSION = 'v1';

export interface Club {
  id: string;
  lunfardo_name: string;
  division: string;
  division_rank: number;
  colors: { primary: string; secondary: string };
  shield_archetype: string;
  barrio_hq: string;
  city: string;
}

function seedClubs(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  const seedKey = 'clubs_seeded_' + CLUBS_SEED_VERSION;

  // Idempotency check — if we already wrote the seed marker, skip.
  try {
    const existing = nk.storageRead([
      { collection: 'meta', key: seedKey, userId: SYSTEM_USER_ID },
    ]);
    if (existing.length > 0) {
      logger.info('Clubs already seeded (version=%s), skipping', CLUBS_SEED_VERSION);
      return;
    }
  } catch (e) {
    // First run — Storage may not yet contain the meta object. Fall through to seeding.
  }

  let clubs: Club[];
  try {
    clubs = JSON.parse(__CLUBS_JSON__) as Club[];
  } catch (e) {
    logger.error('Failed to parse __CLUBS_JSON__: %s', String(e));
    throw e;
  }

  // Write clubs as public-read, system-write-only (mitigates T-1-RT-09).
  const writes: nkruntime.StorageWriteRequest[] = clubs.map((club) => ({
    collection: 'clubs',
    key: club.id,
    userId: SYSTEM_USER_ID,
    value: club,
    permissionRead: 2, // public read
    permissionWrite: 0, // no client write
  }));
  nk.storageWrite(writes);

  // Mark as seeded.
  nk.storageWrite([
    {
      collection: 'meta',
      key: seedKey,
      userId: SYSTEM_USER_ID,
      value: { seeded: true, count: clubs.length, at: Date.now() },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info('Clubs seeded: %d (version=%s)', clubs.length, CLUBS_SEED_VERSION);
}

const InitModule: nkruntime.InitModule = (
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
) => {
  logger.info('BarraBrava runtime starting...');

  seedClubs(nk, logger);

  initializer.registerRpc('get_clubs', rpcGetClubs);
  initializer.registerRpc('create_pibe', rpcCreatePibe);
  initializer.registerRpc('delete_account', rpcDeleteAccount);
  initializer.registerRpc('request_password_reset', rpcRequestPasswordReset);
  initializer.registerRpc('confirm_password_reset', rpcConfirmPasswordReset);

  logger.info('BarraBrava runtime ready: 5 RPCs registered');
};

// Nakama's V8 runtime expects InitModule to be discoverable on the global scope.
// The trailing expression here is the canonical pattern from nakama-project-template:
// it references the symbol so esbuild does not tree-shake it. The `@ts-ignore` is needed
// because TypeScript narrows `!InitModule` to `never` (the function is always truthy).
// @ts-ignore — see comment above
!InitModule && InitModule.bind(null);
