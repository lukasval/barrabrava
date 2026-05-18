// nakama/src/integrations/fcm.ts
// FCM v1 send-to-topic with OAuth2 service-account flow.
//
// Loads the GCP service account JSON from FCM_SERVICE_ACCOUNT_B64 (base64-encoded
// at deploy time so we don't have to commit JSON or fight Railway multi-line escaping).
// Signs an RS256 JWT (nk.jwtGenerate), exchanges it for an OAuth2 access_token at
// oauth2.googleapis.com/token, caches it in COL_META[KEY_FCM_OAUTH] until ~60s
// before expiry, then POSTs to fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send.
//
// CRITICAL — v1 API specifics (RESEARCH.md §Q3):
//   - Topic is BARE name in `message.topic`. NEVER /topics/ prefix (that's legacy API).
//   - Auth header is `Bearer <access_token>` not `key=<server_key>`.
//   - data values MUST be strings.

import { COL_META, SYSTEM_USER_ID, KEY_FCM_OAUTH } from '../storage_keys';
import { validateTopicName } from '../util/topic_name';

const OAUTH2_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

interface CachedOAuthToken {
  access_token: string;
  expires_at: number;
}

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

// Goja base64Decode returns ArrayBuffer; iterate bytes to UTF-8 string.
// Service account JSON is pure ASCII so byte-per-char is correct.
function base64ToUtf8(b64: string, nk: nkruntime.Nakama): string {
  const ab = nk.base64Decode(b64);
  const bytes = new Uint8Array(ab as any);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function loadServiceAccount(ctx: nkruntime.Context, nk: nkruntime.Nakama): ServiceAccount {
  const b64 = ctx.env['FCM_SERVICE_ACCOUNT_B64'];
  if (!b64) throw new Error('FCM_SERVICE_ACCOUNT_B64 not configured');
  const json = base64ToUtf8(b64, nk);
  return JSON.parse(json) as ServiceAccount;
}

function getAccessToken(
  ctx: nkruntime.Context,
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
): string {
  const now = Date.now();
  const cached = nk.storageRead([{
    collection: COL_META, key: KEY_FCM_OAUTH, userId: SYSTEM_USER_ID,
  }]);
  if (cached.length > 0) {
    const c = cached[0].value as CachedOAuthToken;
    if (c.expires_at > now + 60_000) return c.access_token;
  }

  const sa = loadServiceAccount(ctx, nk);
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const jwt = nk.jwtGenerate('RS256', sa.private_key, {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: sa.token_uri,
    iat: iat,
    exp: exp,
  });

  const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
  const resp = nk.httpRequest(
    OAUTH2_TOKEN_URL,
    'post',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    8000,
  );
  if (resp.code !== 200) {
    logger.error('[fcm] oauth2 refresh failed code=%d body=%s', resp.code, String(resp.body).substring(0, 300));
    throw new Error('oauth2_refresh_failed');
  }
  const parsed = JSON.parse(resp.body) as { access_token: string; expires_in: number };
  const newCache: CachedOAuthToken = {
    access_token: parsed.access_token,
    expires_at: now + (parsed.expires_in - 60) * 1000,
  };
  nk.storageWrite([{
    collection: COL_META, key: KEY_FCM_OAUTH, userId: SYSTEM_USER_ID,
    value: newCache, permissionRead: 0, permissionWrite: 0,
  }]);
  return newCache.access_token;
}

export interface FcmTopicPayload {
  topic: string;
  title: string;
  body: string;
  data: { [k: string]: string };
}

export function sendTopic(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  p: FcmTopicPayload,
): boolean {
  const topicCheck = validateTopicName(p.topic);
  if (!topicCheck.ok) {
    logger.warn('[fcm] invalid topic name=%s error=%s; skipping', p.topic, topicCheck.error);
    return false;
  }

  const projectId = ctx.env['FCM_PROJECT_ID'];
  if (!projectId) {
    logger.warn('[fcm] FCM_PROJECT_ID missing; skip send');
    return false;
  }

  let token: string;
  try {
    token = getAccessToken(ctx, nk, logger);
  } catch (e) {
    logger.warn('[fcm] could not obtain access token: %s; skipping send', String(e));
    return false;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message = {
    message: {
      topic: topicCheck.sanitized!,
      notification: { title: p.title, body: p.body },
      data: p.data,
      android: { priority: 'high', ttl: '7200s' },
      apns: { headers: { 'apns-priority': '10' } },
    },
  };
  const resp = nk.httpRequest(
    url,
    'post',
    { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    JSON.stringify(message),
    8000,
  );
  if (resp.code >= 200 && resp.code < 300) {
    logger.info('[fcm] sent to topic=%s', topicCheck.sanitized);
    return true;
  }
  logger.warn('[fcm] send failed topic=%s code=%d body=%s',
    topicCheck.sanitized, resp.code, String(resp.body).substring(0, 300));
  return false;
}
