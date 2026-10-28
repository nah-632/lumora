/**
 * In-memory rate limiting for the AI tools.
 *
 * Two limits, because they defend against different things:
 *
 *   - A burst limit (requests per minute) stops a stuck client, a double-click
 *     loop, or someone holding down a button. It is about the shape of the
 *     traffic.
 *   - A daily cap stops slow, deliberate consumption of a metered provider
 *     quota. It is about the total spend.
 *
 * SCOPE AND HONESTY: this is per-process memory. On a single Node instance it is
 * exact. On a serverless platform each instance keeps its own counters, so the
 * effective limit is (limit x live instances), and a cold start resets them. That
 * is a real limitation, not a rounding error — it is documented here rather than
 * implied away, and the upgrade path is a shared store keyed by user id (Redis or
 * a Postgres table with an atomic upsert). Nothing in this file's interface
 * changes when that happens.
 *
 * The map is swept so a long-lived process cannot grow without bound.
 */

import type { RateLimiter, RateLimitDecision } from "./generate";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RateLimitConfig {
  /** Requests allowed per rolling minute. */
  perMinute: number;
  /** Requests allowed per rolling day. */
  perDay: number;
}

export const DEFAULT_LIMITS: RateLimitConfig = {
  perMinute: 5,
  perDay: 60,
};

interface Bucket {
  minuteStamps: number[];
  dayStamps: number[];
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly config: RateLimitConfig;
  private readonly now: () => number;
  private lastSweep = 0;

  constructor(config: Partial<RateLimitConfig> = {}, now: () => number = () => Date.now()) {
    this.config = { ...DEFAULT_LIMITS, ...config };
    this.now = now;
  }

  check(userId: string): RateLimitDecision {
    const t = this.now();
    this.maybeSweep(t);

    const bucket = this.buckets.get(userId) ?? { minuteStamps: [], dayStamps: [] };
    bucket.minuteStamps = bucket.minuteStamps.filter((s) => t - s < MINUTE_MS);
    bucket.dayStamps = bucket.dayStamps.filter((s) => t - s < DAY_MS);
    this.buckets.set(userId, bucket);

    if (bucket.dayStamps.length >= this.config.perDay) {
      const oldest = bucket.dayStamps[0];
      return {
        allowed: false,
        reason: "quota_exceeded",
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + DAY_MS - t) / 1000)),
      };
    }

    if (bucket.minuteStamps.length >= this.config.perMinute) {
      const oldest = bucket.minuteStamps[0];
      return {
        allowed: false,
        reason: "rate_limited",
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + MINUTE_MS - t) / 1000)),
      };
    }

    // Recorded only on a request that passed, so a refused request cannot
    // extend its own lockout by repeatedly pushing the window forward.
    bucket.minuteStamps.push(t);
    bucket.dayStamps.push(t);
    return { allowed: true };
  }

  /** Drops users with no activity, so the map cannot grow unbounded. */
  private maybeSweep(t: number): void {
    if (t - this.lastSweep < MINUTE_MS) return;
    this.lastSweep = t;

    for (const [userId, bucket] of this.buckets) {
      const hasMinute = bucket.minuteStamps.some((s) => t - s < MINUTE_MS);
      const hasDay = bucket.dayStamps.some((s) => t - s < DAY_MS);
      if (!hasMinute && !hasDay) this.buckets.delete(userId);
    }
  }

  /** Test seam. Never called from application code. */
  reset(): void {
    this.buckets.clear();
  }
}

/**
 * The process-wide limiter.
 *
 * Held on `globalThis` so a hot reload in development does not hand out a fresh
 * set of counters on every edit, which would make the limit untestable by hand.
 */
const globalForLimiter = globalThis as unknown as { __lumoraAiLimiter?: InMemoryRateLimiter };

export function getRateLimiter(): InMemoryRateLimiter {
  if (!globalForLimiter.__lumoraAiLimiter) {
    globalForLimiter.__lumoraAiLimiter = new InMemoryRateLimiter();
  }
  return globalForLimiter.__lumoraAiLimiter;
}

/**
 * The production logger.
 *
 * The signature accepts only scalars, which is the enforcement mechanism: there
 * is no field a prompt, an option or a generated body could be passed through.
 * `Error` objects are not accepted either, because a provider error can embed the
 * request body in its message.
 */
export function serverLogger(): { warn(fields: Record<string, string | number | boolean | null>): void } {
  return {
    warn(fields) {
      // One line, structured, scalars only.
      console.warn(JSON.stringify({ scope: "ai.generate", ...fields }));
    },
  };
}
