import { getCategoryRanking } from "@/lib/services/sentimentService";

// Queensland suburbs ranked by satisfaction for one category, fetched on demand so the briefs map can
// shade suburbs (the category deep-dive choropleth) without a full page round trip.
// Public read-only sentiment endpoint, like its siblings under /api/sentiment (no per-handler auth gate).
export async function GET(request: Request): Promise<Response> {
  const category = new URL(request.url).searchParams.get("category");
  if (!category) {
    return new Response("A category is required.", { status: 400 });
  }
  const { date, suburbs } = await getCategoryRanking(category);
  return Response.json({ date, suburbs });
}
