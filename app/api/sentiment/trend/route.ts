import { SENTIMENT_CACHE_HEADERS } from "@/lib/cache/cacheKeys";
import { getSentimentTrend } from "@/lib/services/sentimentService";
import { filtersFromSearchParams } from "@/lib/validation/sentiment";

// Trend series for the selected area/category. Uses the dedicated trend service path rather
// than the full dashboard context: the chart only needs the time line, so there's no reason
// to also fetch the single-date record and the filter catalogue on every call.
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = filtersFromSearchParams(searchParams);
  const trend = await getSentimentTrend(filters);

  return Response.json(trend, { headers: SENTIMENT_CACHE_HEADERS });
}
