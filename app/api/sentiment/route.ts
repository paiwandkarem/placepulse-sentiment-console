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
    // The service throws when the selected slice has no record. That's a "not found" for the
    // caller, not a server fault, so map it to 404 with the explanatory message rather than
    // letting it surface as a 500.
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown sentiment API error" },
      { status: 404 },
    );
  }
}
