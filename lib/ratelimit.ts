// Rate limiting is deferred (about 40 members). Call sites use this so a real limiter can be
// plugged in later (Upstash Ratelimit, or a Postgres counter table) without touching them.
// Do NOT use in-memory counters: serverless instances do not share memory.
export async function checkRateLimit(_key: string): Promise<{ ok: boolean }> {
  return { ok: true };
}
