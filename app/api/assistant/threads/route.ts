import { auth } from "@clerk/nextjs/server";
import { listThreads } from "@/lib/assistant/sessions";

// The signed-in user's resumable assistant threads (most recent first). The dashboard dock's
// contextual chats are excluded at the query level, so only deliberate, page-level conversations
// surface here.
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const threads = await listThreads(userId);
  return Response.json({ threads });
}
