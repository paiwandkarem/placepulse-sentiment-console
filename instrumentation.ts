import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// Runs once when a server instance starts (Next 16 instrumentation file convention). It wires up
// OpenTelemetry so the AI SDK calls emit traces: the assistant stream, the brief drafts and the
// thread-title model each become a span, and every tool call the assistant makes nests underneath
// its turn. We export those spans to Langfuse over OTLP, which gives us a per-conversation view down
// to each individual lookup, grouped by thread (see the sessionId metadata in lib/ai/telemetry.ts).
//
// Two deliberate performance choices, so this never costs the dashboard anything:
//   1. We register nothing at all unless Langfuse is actually configured. With no keys there is zero
//      OpenTelemetry on the hot path (the dashboard's server render and its Neon queries).
//   2. When it IS configured we pass instrumentations: [] to switch OFF @vercel/otel's default
//      auto-instrumentation, which otherwise wraps every server fetch, including each Neon query, in a
//      span. We only want the AI SDK's own spans, which it emits through the global tracer regardless,
//      so the database path is never traced and never slowed.
//
// Langfuse is only the OTLP destination: point these env vars at any OTLP backend and nothing else
// changes. AI tracing itself only runs on the Node runtime, so the edge runtime is skipped entirely.
export function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return;

  const host = (process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com").replace(/\/$/, "");
  // Langfuse authenticates its OTLP endpoint with HTTP Basic auth over the key pair.
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");

  registerOTel({
    serviceName: "placepulse",
    instrumentations: [],
    traceExporter: new OTLPTraceExporter({
      url: `${host}/api/public/otel/v1/traces`,
      headers: { Authorization: `Basic ${auth}` },
    }),
  });
}
