import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { withModelFallback, MAX_RETRIES } from "@/lib/ai/model";
import { rateLimit } from "@/lib/ratelimit";
import { setThreadTitle } from "@/lib/assistant/sessions";

export const maxDuration = 15;

// Generate a short, human title for a new conversation from its first question and answer, and
// persist it. Called by the assistant page once the first turn settles, so the thread list can swap
// the provisional first-question title for something readable. Cheap (Haiku) and best-effort: if it
// fails, the provisional title simply stays.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const limit = rateLimit(`title:${userId}`, { limit: 30, windowMs: 60000 });
  if (!limit.success) {
    return new Response("Too many requests.", { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  let body: { question?: string; answer?: string };
  try {
    body = (await request.json()) as { question?: string; answer?: string };
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }
  const question = (body.question ?? "").slice(0, 600);
  const answer = (body.answer ?? "").slice(0, 1200);
  if (!question) {
    return new Response("Missing question.", { status: 400 });
  }

  try {
    const result = await withModelFallback("title", (m) =>
      generateText({
        model: m,
        maxRetries: MAX_RETRIES,
        prompt:
          "Write a title of 3 to 6 words for this conversation about Queensland customer-review " +
          "sentiment. Title Case, no quotes, no trailing punctuation, no emoji. Reply with only the title.\n\n" +
          `Question: ${question}\n\nAnswer: ${answer}`,
      }),
    );
    const title = result.text
      .trim()
      .replace(/^["'\s]+|["'\s.]+$/g, "")
      .slice(0, 80);
    if (!title) {
      return new Response("Empty title.", { status: 422 });
    }
    await setThreadTitle(id, userId, title);
    return Response.json({ title });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Title generation failed.", { status: 500 });
  }
}
