// RPC: delete_account (PRV-03)
//
// Self-service account deletion. Required by Argentine Ley 25.326 (right to erasure) and by
// Apple/Google store policies (apps that allow account creation must allow deletion in-app).
//
// Behavior:
//   1. Authenticated caller is identified via ctx.userId.
//   2. We delete the caller's known Storage Objects (pibes, players).
//   3. We call accountDeleteId(userId, true) — `true` recordsDeletion adds a deletion record
//      so the user cannot re-register a fresh account with the same auth identifier instantly.
//   4. Returns { ok: true } on success.
//
// Mitigates T-1-RT-10: action is logged BEFORE deletion (so the audit trail survives).

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
void SYSTEM_USER_ID;

export function rpcDeleteAccount(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  _payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) {
    throw new Error('not_authenticated');
  }

  logger.info('delete_account: starting for user=%s', userId);

  // Best-effort cleanup of Storage Objects owned by this user.
  // storageDelete tolerates non-existent objects (no-op).
  const knownObjects: nkruntime.StorageDeleteRequest[] = [
    { collection: 'pibes', key: 'main', userId },
    { collection: 'players', key: 'profile', userId },
  ];

  try {
    nk.storageDelete(knownObjects);
  } catch (e) {
    logger.warn('delete_account: storageDelete partial failure user=%s err=%s', userId, String(e));
  }

  // Also clean any password reset tokens issued to this user.
  try {
    const tokens = nk.storageList(userId, 'reset_tokens', 100, '');
    if (tokens.objects && tokens.objects.length > 0) {
      const dels: nkruntime.StorageDeleteRequest[] = tokens.objects.map((o) => ({
        collection: 'reset_tokens',
        key: o.key,
        userId,
      }));
      nk.storageDelete(dels);
    }
  } catch (e) {
    logger.warn('delete_account: reset_tokens cleanup failed user=%s err=%s', userId, String(e));
  }

  // Finally, delete the Nakama account itself. `true` records the deletion (anti-replay).
  try {
    nk.accountDeleteId(userId, true);
  } catch (e) {
    logger.error('delete_account: accountDeleteId failed user=%s err=%s', userId, String(e));
    throw new Error('account_delete_failed');
  }

  logger.info('delete_account: complete for user=%s', userId);
  return JSON.stringify({ ok: true });
}
