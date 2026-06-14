import { after } from "next/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { model, MAX_RETRIES } from "@/lib/ai/model";
import { rateLimit } from "@/lib/ratelimit";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistant/systemPrompt";
import { assistantTools } from "@/lib/assistant/tools";
import { saveChatSession, type ChatSurface } from "@/lib/assistant/sessions";
import { auth } from "@clerk/nextjs/server";

// The assistant endpoint. It runs the conversation through the model with the grounded read tools
// and streams the answer back in the UI-message protocol that useChat consumes. A route handler is
// the right primitive here because the response is an open token stream, not a single value: it
// exposes the Web Response directly and toUIMessageStreamResponse emits exactly that protocol.
//
// The model reaches Neon only through the typed, zod-validated tools in lib/assistant/tools.ts, so
// it can only surface figures that already exist in the database and cannot run arbitrary SQL.
// stepCountIs bounds the tool loop: the model may call a tool, read the result and call another,
// then answer, but cannot loop without end.

// Headroom for a multi-step tool loop on Sonnet. Runs on Fluid Compute (Node), which keeps the
// instance warm between turns so an interactive assistant does not pay a cold start each message.
export const maxDuration = 60;

type AssistantRequest = {
  id?: string;
  messages?: UIMessage[];
  // Which surface the turn came from: the assistant page keeps a browsable thread history, the dock
  // is contextual and never listed.
  surface?: ChatSurface;
  // The dashboard filter state, sent once the copilot is docked (A6). Stored with the session.
  filters?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  // The assistant spends model tokens, so it fails closed: a request without a signed-in user is
  // rejected before any work. proxy.ts already gates the surface; this is defence in depth at the
  // API itself, and it gives us the owner id to scope the saved conversation.
  const { userId } = await auth();
  if (!userId) {
    return new Response("Sign in to use the assistant.", { status: 401 });
  }

  // Clerk gates who can call this; the rate limiter gates how often, so a single signed-in user
  // cannot spam expensive model calls. Checked before any model work so a throttled request never
  // spends tokens.
  const limit = rateLimit(`assistant:${userId}`, { limit: 30, windowMs: 60000 });
  if (!limit.success) {
    return new Response("Too many requests. Please slow down.", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return new Response("Request body must be valid JSON.", { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Request body must include a non-empty messages array.", { status: 400 });
  }

  const sessionId = body.id ?? crypto.randomUUID();
  const surface: ChatSurface = body.surface === "dock" ? "dock" : "assistant";
  const modelMessages = await convertToModelMessages(messages);

  // When the dock sends the current dashboard selection, fold it into the system prompt so an
  // ambiguous question ("what about restaurants?") resolves to the suburb the user is looking at.
  const filters = body.filters as { areaName?: string; category?: string } | undefined;
  const contextHint = filters?.areaName
    ? `\n\nThe user is currently viewing the dashboard for ${filters.areaName}${filters.category ? `, category ${filters.category}` : " (all categories)"}. When a question does not name a suburb, assume they mean this one.`
    : "";

  const result = streamText({
    model: model("assistant"),
    system: ASSISTANT_SYSTEM_PROMPT + contextHint,
    messages: modelMessages,
    tools: assistantTools,
    stopWhen: stepCountIs(8),
    maxRetries: MAX_RETRIES,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: ({ messages: finalMessages }) => {
      // Persist after the stream is delivered, so the database write never sits on the response
      // path. after() lets the work finish on Fluid Compute once the response has been sent.
      after(async () => {
        try {
          await saveChatSession({ id: sessionId, userId, surface, messages: finalMessages, filters: body.filters });
        } catch (error) {
          console.error("Failed to persist chat session", sessionId, error);
        }
      });
    },
    onError: (error) => (error instanceof Error ? error.message : "The assistant hit an error."),
  });
}
