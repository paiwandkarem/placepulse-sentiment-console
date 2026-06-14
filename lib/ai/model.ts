import "server-only";
import { gateway } from "ai";

// One place to resolve every model the AI features use. Models are addressed as
// "provider/model" slugs routed through the Vercel AI Gateway rather than wiring a provider
// SDK directly. That buys provider-swapping from a single line, plus the gateway's
// observability and fallbacks. On Vercel the gateway authenticates with the project's OIDC
// token automatically; locally it reads AI_GATEWAY_API_KEY from .env.local.
//
// The assistant runs on Sonnet 4.6: strong tool use at a latency and cost that suit an
// interactive chat. Brief drafting runs on Opus 4.8 — it is long-form and quality-sensitive,
// and not on the interactive path, so the extra headroom is worth the latency. Selection is
// per role here, never at the call site.

export const MODELS = {
  // The conversational analytics assistant. Tool-calling heavy, must feel responsive.
  assistant: "anthropic/claude-sonnet-4-6",
  // Brief drafting. Long-form structured output where quality outweighs latency, so this role
  // gets more headroom than the interactive assistant.
  brief: "anthropic/claude-opus-4-8",
  // The eval faithfulness judge. Deliberately a different, stronger model than the assistant it
  // grades (Opus vs Sonnet) so a model is never the sole judge of its own output. Off the user
  // path, so latency is irrelevant.
  judge: "anthropic/claude-opus-4-8",
} as const;

export type ModelRole = keyof typeof MODELS;

// Resolve a role to a Gateway-backed language model for streamText / generateObject.
export function model(role: ModelRole = "assistant") {
  return gateway(MODELS[role]);
}
