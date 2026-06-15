import "server-only";

// Builds the experimental_telemetry option for an AI SDK call (streamText / generateText /
// generateObject). When Langfuse is configured (see instrumentation.ts), enabling this makes the
// call emit an OpenTelemetry span, and every tool call the model makes nests under it. Two metadata
// keys do the grouping in Langfuse: sessionId ties a trace to its conversation thread, and userId to
// the user, so the trace view reads thread by thread rather than as a flat list of model calls.
//
// When no Langfuse keys are present the flag is off, so the SDK does no tracing work and there is no
// behaviour change. Keeping the decision in one place means a call site never has to know whether
// observability is wired up.

type TelemetryMetadata = Record<string, string | number | boolean>;

const TELEMETRY_ENABLED = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
);

export function aiTelemetry(functionId: string, metadata?: TelemetryMetadata) {
  return {
    isEnabled: TELEMETRY_ENABLED,
    functionId,
    metadata,
  };
}
