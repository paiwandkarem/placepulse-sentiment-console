import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

// AI tracing to Langfuse via OpenTelemetry. The AI SDK calls (the assistant stream, the brief drafts,
// the thread-title model) emit spans when telemetry is enabled (see lib/ai/telemetry.ts), with each
// tool call nested under its turn; this exports them to Langfuse, grouped by conversation thread.
//
// Two deliberate choices, so it is reliable and never costs the app anything:
//   1. The processor is created only when Langfuse is configured. With no keys it is undefined, so
//      tracing is a complete no-op and the app behaves identically (the structural reason this cannot
//      break anything).
//   2. It uses Langfuse's own span processor on a NodeTracerProvider, not @vercel/otel, because the
//      AI SDK v6 telemetry needs the OpenTelemetry JS SDK v2 that @vercel/otel does not yet support.
//      The processor is exported so the AI routes can forceFlush() it inside after(), which guarantees
//      the spans are sent before a serverless function suspends.
const enabled =
  process.env.NEXT_RUNTIME !== "edge" &&
  Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

export const langfuseSpanProcessor = enabled
  ? new LangfuseSpanProcessor({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    })
  : undefined;

export function register() {
  if (!langfuseSpanProcessor) return;
  new NodeTracerProvider({ spanProcessors: [langfuseSpanProcessor] }).register();
}
