import "server-only";
import { gateway } from "ai";

// One place to resolve every model the AI features use. Models are addressed as
// "provider/model" slugs routed through the Vercel AI Gateway rather than wiring a provider
// SDK directly. That buys provider-swapping from a single line, plus the gateway's
// observability and fallbacks. On Vercel the gateway authenticates with the project's OIDC
// token automatically; locally it reads AI_GATEWAY_API_KEY from .env.local.
//
// Default is Sonnet 4.6: strong tool use at a latency and cost that suit an interactive
// assistant. Bump a role to "anthropic/claude-opus-4-8" here if a task wants more headroom.

export const MODELS = {
  // The conversational analytics assistant. Tool-calling heavy, must feel responsive.
  assistant: "anthropic/claude-sonnet-4-6",
  // Brief drafting. Long-form structured output; quality matters more than latency.
  brief: "anthropic/claude-sonnet-4-6",
} as const;

export type ModelRole = keyof typeof MODELS;

// Resolve a role to a Gateway-backed language model for streamText / generateObject.
export function model(role: ModelRole = "assistant") {
  return gateway(MODELS[role]);
}
