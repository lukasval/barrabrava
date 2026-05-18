// util/topic_name.ts
// Validates FCM topic names per FCM v1 API spec (RESEARCH.md §S-5, §Q3).
// Topic names must match [a-zA-Z0-9_.~%-]+ — letters, digits, underscore, dot, tilde, percent.
// Phase 1 clubs use lowercase + underscores exclusively — all valid.
// Length cap: 900 chars (conservative; FCM has no official max but widely tested at 100).

export interface TopicNameResult {
  ok: boolean;
  sanitized?: string;
  error?: string;
}

const TOPIC_MAX_LENGTH = 900;
const TOPIC_ALLOWED_RE = /^[a-zA-Z0-9_.~%-]+$/;

export function validateTopicName(raw: unknown): TopicNameResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'topic_must_be_string' };
  }
  const topic = raw.trim();
  if (topic.length === 0) {
    return { ok: false, error: 'topic_empty' };
  }
  if (topic.length > TOPIC_MAX_LENGTH) {
    return { ok: false, error: 'topic_too_long' };
  }
  if (!TOPIC_ALLOWED_RE.test(topic)) {
    return { ok: false, error: 'invalid_topic_chars' };
  }
  return { ok: true, sanitized: topic };
}
