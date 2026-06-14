import "server-only";

// A tiny in-memory, per-user sliding-window rate limiter for the money-spending AI endpoints
// (assistant, brief generation). Clerk gates WHO can call them; this gates HOW OFTEN, so a single
// authenticated user cannot spam expensive model calls and run up a bill.
//
// Deliberate take-home tradeoff: the window state lives in module memory. Fluid Compute reuses an
// instance across requests so this holds within a warm instance, but it is NOT shared across
// instances or regions, so it caps abuse per instance rather than globally. The production swap is a
// shared store - Vercel KV or Upstash Ratelimit - keyed the same way. This is enough to demonstrate
// the control, return real 429s, and keep the blast radius of a runaway client small.

const buckets = new Map<string, number[]>();

export type RateLimitResult = { success: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

  if (recent.length >= opts.limit) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
    buckets.set(key, recent);
    return { success: false, remaining: 0, retryAfterSeconds };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { success: true, remaining: opts.limit - recent.length, retryAfterSeconds: 0 };
}
