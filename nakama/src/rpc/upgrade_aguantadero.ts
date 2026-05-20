// RPC: upgrade_aguantadero
//
// Upgrades the player's aguantadero from current level to current+1.
// Validates cost, enforces sequential upgrade (no level skipping — T-3-WS-08),
// and atomically deducts Plata + writes new level capacities.
//
// Design decisions:
//   AGT-02: Each upgrade is target_level == current+1 (strict sequential).
//   AGT-03: Level table costs are the canonical tuning source (RESEARCH A2).
//   T-3-WS-08: must_upgrade_one_level error prevents skipping.
//
// Input:  { target_level: number }
// Output: { ok: true, aguantadero: AguantaderoRecord, plata_spent: number }
//       | { ok: true, aguantadero: AguantaderoRecord, no_op: true }  (already at target)
//       | { ok: false, error: string, ... }

import {
  COL_AGUANTADEROS, COL_PLAYERS, KEY_AGUANTADERO_MAIN,
} from '../storage_keys';

// Tuning table — matches get_aguantadero.ts LEVEL_TABLE exactly (RESEARCH A2 / AGT-03).
// These are the canonical costs; kept here too so upgrade_aguantadero has no
// circular import dependency on get_aguantadero.
const LEVEL_TABLE: {
  [lvl: number]: { roster: number; almacen: number; bandera: number; defensa: number; cost: number };
} = {
  1: { roster: 5,  almacen: 1000,  bandera: 0,  defensa: 0,   cost: 0      },
  2: { roster: 8,  almacen: 2500,  bandera: 1,  defensa: 10,  cost: 5000   },
  3: { roster: 12, almacen: 6000,  bandera: 3,  defensa: 25,  cost: 15000  },
  4: { roster: 16, almacen: 12000, bandera: 6,  defensa: 50,  cost: 40000  },
  5: { roster: 20, almacen: 25000, bandera: 12, defensa: 100, cost: 100000 },
};

export function rpcUpgradeAguantadero(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  let input: { target_level?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_payload' }); }
  if (typeof input.target_level !== 'number')
    return JSON.stringify({ ok: false, error: 'target_level_required' });
  const target = Math.floor(input.target_level);
  if (target < 1 || target > 5)
    return JSON.stringify({ ok: false, error: 'level_out_of_range' });

  const aguRead = nk.storageRead([{
    collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
  }]);
  if (aguRead.length === 0) return JSON.stringify({ ok: false, error: 'no_aguantadero' });
  const agu = aguRead[0].value as { [k: string]: unknown };
  const current = Number(agu.level ?? 1);
  if (target === current) {
    return JSON.stringify({ ok: true, aguantadero: agu, no_op: true });
  }
  if (target !== current + 1) {
    return JSON.stringify({ ok: false, error: 'must_upgrade_one_level', current, target });
  }
  const tier = LEVEL_TABLE[target];
  if (!tier) return JSON.stringify({ ok: false, error: 'unknown_level' });

  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as { plata?: number; [k: string]: unknown };
  const plata = typeof profile.plata === 'number' ? profile.plata : 0;
  if (plata < tier.cost) {
    return JSON.stringify({ ok: false, error: 'plata_insufficient', need: tier.cost, have: plata });
  }

  agu.level = target;
  agu.roster_cap = tier.roster;
  agu.almacen_cap = tier.almacen;
  agu.bandera_room_slots = tier.bandera;
  agu.defensa_rating = tier.defensa;
  agu.upgraded_at = now;
  profile.plata = plata - tier.cost;

  nk.storageWrite([
    {
      collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
      value: agu, version: aguRead[0].version,
      permissionRead: 1, permissionWrite: 0,
    },
    {
      collection: COL_PLAYERS, key: 'profile', userId,
      value: profile, version: profRead[0].version,
      permissionRead: 2, permissionWrite: 0,
    },
  ]);

  logger.info('[upgrade_aguantadero] user=%s lvl=%d->%d cost=%d', userId, current, target, tier.cost);
  return JSON.stringify({ ok: true, aguantadero: agu, plata_spent: tier.cost });
}
