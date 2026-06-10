import { listAvailableFilters } from "@/lib/services/sentimentService";
import { SENTIMENT_CACHE_HEADERS } from "@/lib/cache/cacheKeys";

// Filter catalogue endpoint: the distinct areas, categories, dates and aggregations that
// drive the dashboard controls. The handler itself stays dynamic (it queries Neon), but we
// return the shared Cache-Control header so Vercel's CDN serves a cached copy for ~5 minutes
// — the catalogue only changes on a new import, so there's no reason to hit a Function or
// the database on every request.
export const maxDuration = 15;

export async function GET() {
  const filters = await listAvailableFilters();
  return Response.json(filters, { headers: SENTIMENT_CACHE_HEADERS });
}
