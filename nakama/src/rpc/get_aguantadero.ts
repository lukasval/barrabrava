// nakama/src/rpc/get_aguantadero.ts
//
// Player RPC: reads (or auto-bootstraps) the caller's aguantadero singleton.
//
// Design decisions:
//   AGT-01: Auto-bootstrap on first read — reads clubs/{club_id}.barrio_hq from
//           server-owned COL_CLUBS and denormalizes into the record. Client cannot
//           inject a foreign club_id (read from profile, not from payload — T-3-RS-09).
//   T-3-RS-09: barrio_hq lookup uses server-side profile.club_id, not any client input.

import {
  COL_AGUANTADEROS, COL_CLUBS, COL_PLAYERS,
  KEY_AGUANTADERO_MAIN, SYSTEM_USER_ID,
} from '../storage_keys';

// Tuning table for Phase 6 balance pass (RESEARCH A2 — keep here, not inlined).
const LEVEL_TABLE: {
  [lvl: number]: {
    roster:  number;
    almacen: number;
    bandera: number;
    defensa: number;
    cost:    number;
  };
} = {
  1: { roster: 5,  almacen: 1000,  bandera: 0,  defensa: 0,   cost: 0      },
  2: { roster: 8,  almacen: 2500,  bandera: 1,  defensa: 10,  cost: 5000   },
  3: { roster: 12, almacen: 6000,  bandera: 3,  defensa: 25,  cost: 15000  },
  4: { roster: 16, almacen: 12000, bandera: 6,  defensa: 50,  cost: 40000  },
  5: { roster: 20, almacen: 25000, bandera: 12, defensa: 100, cost: 100000 },
};

export function rpcGetAguantadero(
  ctx: nkruntime.Context, logger: nkruntime.Logger,
  nk: nkruntime.Nakama, _payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');
  const now = Date.now();

  // Read profile to get club_id (never trust client-supplied club_id — T-3-RS-09).
  const profRead = nk.storageRead([{ collection: COL_PLAYERS, key: 'profile', userId }]);
  if (profRead.length === 0) return JSON.stringify({ ok: false, error: 'no_profile' });
  const profile = profRead[0].value as { club_id?: string };
  const clubId = String(profile.club_id ?? '');
  if (!clubId) return JSON.stringify({ ok: false, error: 'no_club' });

  let aguRead = nk.storageRead([{
    collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
  }]);

  // ── Auto-bootstrap on first read (AGT-01) ────────────────────────────────
  if (aguRead.length === 0) {
    // Denormalize barrio_hq from the server-owned clubs record.
    const clubRead = nk.storageRead([{
      collection: COL_CLUBS, key: clubId, userId: SYSTEM_USER_ID,
    }]);
    const barrioHq = clubRead.length > 0
      ? String((clubRead[0].value as { barrio_hq?: string }).barrio_hq ?? 'Centro')
      : 'Centro';

    const aguantadero = {
      user_id:           userId,
      club_id:           clubId,
      barrio_hq:         barrioHq,
      level:             1,
      roster_cap:        LEVEL_TABLE[1].roster,
      almacen_cap:       LEVEL_TABLE[1].almacen,
      bandera_room_slots: LEVEL_TABLE[1].bandera,
      defensa_rating:    LEVEL_TABLE[1].defensa,
      upgraded_at:       null,
      created_at:        now,
      trapos_robados:    [] as unknown[],
    };
    nk.storageWrite([{
      collection: COL_AGUANTADEROS, key: KEY_AGUANTADERO_MAIN, userId,
      value: aguantadero as unknown as { [k: string]: unknown },
      permissionRead: 1, permissionWrite: 0,
    }]);
    logger.info('[get_aguantadero] bootstrapped user=%s club=%s barrio=%s',
      userId, clubId, barrioHq);
    // Synthesize the read result so the rest of the function can proceed uniformly.
    aguRead = [{
      value:   aguantadero,
      version: '',
      key:     KEY_AGUANTADERO_MAIN,
      userId,
    }] as any;
  }

  const agu = aguRead[0].value as any;
  const lvl = Number(agu.level ?? 1);
  const nextLevelCost    = lvl < 5 ? LEVEL_TABLE[lvl + 1].cost    : null;
  const nextLevelPreview = lvl < 5 ? LEVEL_TABLE[lvl + 1]         : null;

  return JSON.stringify({
    ok:                 true,
    aguantadero:        agu,
    next_level_cost:    nextLevelCost,
    next_level_preview: nextLevelPreview,
  });
}
