import { aggTypeForCategory } from "@/lib/filters";
import { getSentimentDashboardContext } from "@/lib/services/sentimentService";
import { SENTIMENT_CACHE_HEADERS } from "@/lib/cache/cacheKeys";

// A compact suburb sentiment overview for the explorer's suburb panel. It reuses the dashboard's
// service (the sentiment_suburbs aggregate) but returns only the trimmed fields the panel shows, so
// the payload stays small. The same CDN cache policy as the other read routes applies: suburb
// sentiment is monthly and rarely changes, so the edge serves most hits without touching Neon.
export const maxDuration = 30;

function round(value: number): number {
  return Math.round(value);
}

export async function GET(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get("name");
  if (!name) return Response.json({ overview: null });

  const context = await getSentimentDashboardContext({ areaName: name, aggType: aggTypeForCategory(undefined) });
  if (!context) return Response.json({ overview: null }, { headers: SENTIMENT_CACHE_HEADERS });

  const record = context.record;
  const overview = {
    areaName: record.areaName,
    satisfaction100: round(record.overallSatisfaction100),
    avgRating: record.avgRating,
    totalReviews: record.totalReviews,
    positivePct: round(record.positivePct),
    negativePct: round(record.negativePct),
    neutralPct: round(record.neutralPct),
    working: context.drivers
      .filter((driver) => driver.uiBucket === "working")
      .slice(0, 4)
      .map((driver) => ({ label: driver.label, positivePct: round(driver.positivePct) })),
    notWorking: context.drivers
      .filter((driver) => driver.uiBucket === "not_working")
      .slice(0, 4)
      .map((driver) => ({ label: driver.label, negativePct: round(driver.negativePct) })),
  };

  return Response.json({ overview }, { headers: SENTIMENT_CACHE_HEADERS });
}
