type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Minimal in-memory guard. It is deliberately conservative but is per-process only:
 * serverless instances and cold starts do not share counters. Add a shared limiter
 * before treating it as a distributed abuse-control boundary.
 */
export function rateLimit(scope: string, key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function requestClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function resetRateLimitsForTests() { buckets.clear(); }
