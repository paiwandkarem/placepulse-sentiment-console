import { auth } from "@clerk/nextjs/server";
import { getThread, deleteThread } from "@/lib/assistant/sessions";

// One thread's full message list, for hydrating the chat on resume, and a delete. Both are scoped
// to the caller, so a thread id alone never exposes or removes another user's conversation.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const thread = await getThread(id, userId);
  if (!thread) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ thread });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  await deleteThread(id, userId);
  return new Response(null, { status: 204 });
}
