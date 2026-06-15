import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// Runs once when a server instance starts (Next 16 instrumentation file convention). It wires up
// OpenTelemetry so the AI SDK calls emit traces: the assistant stream, the brief drafts and the
// thread-title model each become a span, and every tool call the assistant makes nests underneath
// its turn. We export those spans to Langfuse over OTLP, which gives us a per-conversation view down
// to each individual lookup, grouped by thread (see the sessionId metadata in lib/ai/telemetry.ts).
//
// Langfuse is only the OTLP destination here. The instrumentation is vendor-neutral: point these env
// vars at any OTLP backend (or Vercel's own collector) and nothing in the app changes. With no keys
// set, telemetry is off and this just registers the no-op service, so local dev and the build are
// unaffected.
export function register() {
  // The exporter uses Node APIs (Buffer), and our AI work only ever runs on the Node runtime, so we
  // skip the export wiring under the edge runtime rather than risk loading it there.
  if (process.env.NEXT_RUNTIME === "edge") {
    registerOTel({ serviceName: "placepulse" });
    return;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = (process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com").replace(/\/$/, "");

  if (!publicKey || !secretKey) {
    // No destination configured: register the service without an exporter so the SDK's spans are a
    // cheap no-op instead of an error.
    registerOTel({ serviceName: "placepulse" });
    return;
  }

  // Langfuse authenticates its OTLP endpoint with HTTP Basic auth over the key pair.
  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");

  registerOTel({
    serviceName: "placepulse",
    traceExporter: new OTLPTraceExporter({
      url: `${host}/api/public/otel/v1/traces`,
      headers: { Authorization: `Basic ${auth}` },
    }),
  });
}
