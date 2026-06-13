import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/cacheKeys";

// On-demand cache invalidation. The data import is the only thing that changes the
// underlying numbers, so the importer (or a deploy hook) can POST here afterwards to drop
// the cached dashboard rather than waiting for the time-based windows to expire. Guarded by a
// shared secret so it can't be triggered by anyone who finds the URL.
export async function POST(request: Request) {
  const token = request.headers.get("x-revalidate-token");

  // Fails closed: if the token is missing, wrong, or REVALIDATE_TOKEN isn't configured, the
  // comparison is false and we reject.
  if (!token || token !== process.env.REVALIDATE_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Path-based invalidation: purge the server-rendered pages. The read APIs are cached at the
  // CDN via Cache-Control and age out on their own stale-while-revalidate window. This
  // endpoint targets the Next.js page cache, which is what a user actually looks at.
  revalidatePath("/");
  // Drop the independently-cached filter catalogue so a re-import's new suburbs/categories/dates
  // appear immediately rather than after its hourly TTL.
  revalidateTag(CACHE_TAGS.filters, "max");

  return Response.json({ ok: true, revalidatedAt: new Date().toISOString() });
}
