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
import { COL_CLUBS, COL_META, SYSTEM_USER_ID } from './storage_keys';

const CLUBS_SEED_VERSION = 'v2';  // v1→v2: 133→153 clubs, real-name IDs (display stays lunfardo), barrio/city accent fixes

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
      { collection: COL_META, key: seedKey, userId: SYSTEM_USER_ID },
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
    collection: COL_CLUBS,
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
      collection: COL_META,
      key: seedKey,
      userId: SYSTEM_USER_ID,
      value: { seeded: true, count: clubs.length, at: Date.now() },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info('Clubs seeded: %d (version=%s)', clubs.length, CLUBS_SEED_VERSION);
}

// MUST be a function declaration (or `var InitModule = function() {}`), NOT an
// arrow function. Nakama parses the bundle AST looking for either pattern in
// findInitModuleFn (server/runtime_javascript_init_module.go) — arrow functions
// are ignored, causing `failed to find InitModule function` from registerRpc.
export function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  logger.info('BarraBrava runtime starting...');

  seedClubs(nk, logger);

  initializer.registerRpc('get_clubs', rpcGetClubs);
  initializer.registerRpc('create_pibe', rpcCreatePibe);
  initializer.registerRpc('delete_account', rpcDeleteAccount);
  initializer.registerRpc('request_password_reset', rpcRequestPasswordReset);
  initializer.registerRpc('confirm_password_reset', rpcConfirmPasswordReset);

  logger.info('BarraBrava runtime ready: 5 RPCs registered');
}
