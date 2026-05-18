// RPC: register_fcm_token
//
// Stores the device's FCM registration token for the authenticated user.
//
// D-10: Phase 2 persists tokens but does NOT fire per-user push sends — only
//        topic pushes (one per club). Phase 4+ (Combate) will use these tokens
//        for personal events ("te atacaron", "pibe preso", etc).
// S-14: Singleton per userId — key='token' — new registration overwrites prior.
//        Phase 4 revisits with multi-device keys ('token_android' / 'token_ios').
// S-4:  token value MUST NEVER appear in logs. Only userId + platform.
//
// Input: { token: string, platform: "android" | "ios" }
// Output: { ok: true, registered: true } | { ok: false, error: string }

import { COL_FCM_TOKENS } from '../storage_keys';

export function rpcRegisterFcmToken(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string,
): string {
  const userId = ctx.userId;
  if (!userId) throw new Error('not_authenticated');

  let input: { token?: unknown; platform?: unknown } = {};
  try { input = JSON.parse(payload || '{}'); }
  catch (e) { return JSON.stringify({ ok: false, error: 'invalid_json_payload' }); }

  if (typeof input.token !== 'string' || input.token.length === 0)
    return JSON.stringify({ ok: false, error: 'token_required' });
  if (input.platform !== 'android' && input.platform !== 'ios')
    return JSON.stringify({ ok: false, error: 'invalid_platform' });

  nk.storageWrite([{
    collection: COL_FCM_TOKENS,
    key: 'token',
    userId,
    value: {
      token: input.token,
      platform: input.platform,
      registered_at: Date.now(),
    },
    permissionRead: 0,
    permissionWrite: 0,
  }]);

  logger.info('[register_fcm] user=%s platform=%s', userId, input.platform);
  return JSON.stringify({ ok: true, registered: true });
}
