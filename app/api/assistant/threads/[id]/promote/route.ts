import { auth } from "@clerk/nextjs/server";
import { promoteDockThread } from "@/lib/assistant/sessions";

// Promote a dashboard-dock conversation to the full assistant page (flip its surface and stamp its
// origin) so the dock's contextual chat becomes a listed, resumable thread. Scoped to the caller and
// to dock-surface chats, so it can only ever move the user's own dock conversation.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const promoted = await promoteDockThread(id, userId);
  return Response.json({ promoted });
}
