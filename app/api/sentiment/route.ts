import { SENTIMENT_CACHE_HEADERS } from "@/lib/cache/cacheKeys";
import { getSentimentDashboardContext } from "@/lib/services/sentimentService";
import { filtersFromSearchParams } from "@/lib/validation/sentiment";

// Primary read endpoint: the full dashboard context (record + trend + catalogue) for a
// selection passed as query params. Filters are validated through the shared schema before
// they reach the service, so this handler never trusts the URL directly.
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = filtersFromSearchParams(searchParams);

  try {
    const context = await getSentimentDashboardContext(filters);
    return Response.json(context, { headers: SENTIMENT_CACHE_HEADERS });
  } catch (error) {
    // Only the "no data imported" case is a genuine not-found. A real fault (a Neon outage, a SQL
    // error) must surface as a 500 so it stays observable, rather than being masked as a missing
    // resource the way mapping every error to 404 would.
    const message = error instanceof Error ? error.message : "Unknown sentiment API error";
    const status = message.includes("No sentiment data has been imported") ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
