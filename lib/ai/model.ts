import "server-only";
import { gateway, type LanguageModel } from "ai";

// One place to resolve every model the AI features use, now with explicit fallbacks. Models are
// addressed as "provider/model" slugs routed through the Vercel AI Gateway rather than wiring a
// provider SDK directly: that buys provider-swapping from a single line plus the gateway's
// observability. On Vercel the gateway authenticates with the project OIDC token automatically;
// locally it reads AI_GATEWAY_API_KEY from .env.local.
//
// Each role has a primary and a fallback model. The assistant runs on Sonnet 4.6 (strong tool use
// at interactive latency) and falls back to Haiku 4.5 (cheaper, faster) so a Sonnet outage degrades
// gracefully rather than failing. Briefs and the eval judge run on Opus 4.8 (long-form quality, off
// the interactive path) and fall back to Sonnet 4.6. Selection is per role here, never at the call site.

export const MODELS = {
  assistant: { primary: "anthropic/claude-sonnet-4-6", fallback: "anthropic/claude-haiku-4-5" },
  brief: { primary: "anthropic/claude-opus-4-8", fallback: "anthropic/claude-sonnet-4-6" },
  judge: { primary: "anthropic/claude-opus-4-8", fallback: "anthropic/claude-sonnet-4-6" },
} as const;

export type ModelRole = keyof typeof MODELS;

// Transient-error retries the AI SDK performs against a single model before the call is considered
// failed. Provider rate limits and 5xx are retried here; a hard failure then trips the fallback.
export const MAX_RETRIES = 2;

// Resolve a role to its primary Gateway-backed model for streamText / generateObject.
export function model(role: ModelRole = "assistant"): LanguageModel {
  return gateway(MODELS[role].primary);
}

// The role fallback model, used when the primary fails with a retryable upstream error.
export function fallbackModel(role: ModelRole = "assistant"): LanguageModel {
  return gateway(MODELS[role].fallback);
}

// Retryable = the kind of upstream failure where trying the fallback model is worth it: rate
// limiting, overload, timeouts, or 5xx. A 4xx that is not 429 (e.g. a bad request) is not retried.
function isRetryable(error: unknown): boolean {
  const e = error as { statusCode?: number; status?: number };
  const status = e?.statusCode ?? e?.status;
  if (typeof status === "number") return status === 429 || status >= 500;
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return ["rate limit", "ratelimit", "overload", "timeout", "unavailable", "temporarily", "429", "503", "502", "500"].some(
    (token) => message.includes(token),
  );
}

// Run a non-streaming model call (generateObject / generateText) with automatic fallback: try the
// role primary model, and on a retryable upstream error try the fallback model once. Streaming
// callers (the assistant) instead rely on MAX_RETRIES plus the Gateway provider routing, since a
// stream may have already begun emitting by the time an error surfaces.
export async function withModelFallback<T>(
  role: ModelRole,
  run: (model: LanguageModel) => Promise<T>,
): Promise<T> {
  try {
    return await run(model(role));
  } catch (error) {
    if (!isRetryable(error)) throw error;
    return await run(fallbackModel(role));
  }
}
