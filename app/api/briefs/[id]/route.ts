import { del } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { deleteBriefJob } from "@/lib/briefs/repository";

// Delete a brief: remove its row, then remove the rendered PDF from Blob. The Blob delete is best
// effort, the row is the source of truth for what the briefs page shows.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Sign in to delete a brief.", { status: 401 });
  }
  const { id } = await params;
  const blobUrl = await deleteBriefJob(id, userId);
  if (blobUrl) {
    try {
      await del(blobUrl);
    } catch (error) {
      console.error("Failed to delete brief blob", blobUrl, error);
    }
  }
  return new Response(null, { status: 204 });
}
