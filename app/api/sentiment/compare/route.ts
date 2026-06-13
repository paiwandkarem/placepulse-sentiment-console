import { z } from "zod";
import { SENTIMENT_CACHE_HEADERS } from "@/lib/cache/cacheKeys";
import { getAreaComparison } from "@/lib/services/sentimentService";
import { comparisonSchema } from "@/lib/validation/sentiment";

// Compares two areas for the same category and date. Unlike the other read routes, every
// parameter is required, so this is the one endpoint where the request itself can be
// malformed, hence the explicit 400 vs 404 split below.
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = comparisonSchema.safeParse({
    aggType: searchParams.get("aggType"),
    baseAreaName: searchParams.get("baseAreaName"),
    comparisonAreaName: searchParams.get("comparisonAreaName"),
    category: searchParams.get("category"),
    date: searchParams.get("date"),
  });

  // A partial or invalid request is a client error, not a server fault, so report 400 with the
  // specific fields that failed rather than letting Zod throw into a 500.
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid comparison request", issues: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await getAreaComparison(parsed.data);
    return Response.json(result, { headers: SENTIMENT_CACHE_HEADERS });
  } catch (error) {
    // The request was well-formed but one or both areas had no record for that category/date.
    return Response.json(
      { error: error instanceof Error ? error.message : "Comparison unavailable" },
      { status: 404 },
    );
  }
}
