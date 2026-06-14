import { auth } from "@clerk/nextjs/server";
import { getCategoryRanking } from "@/lib/services/sentimentService";

// Queensland suburbs ranked by satisfaction for one category, fetched on demand so the briefs map can
// shade suburbs (the category deep-dive choropleth) without a full page round trip.
export async function GET(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const category = new URL(request.url).searchParams.get("category");
  if (!category) {
    return new Response("A category is required.", { status: 400 });
  }
  const { date, suburbs } = await getCategoryRanking(category);
  return Response.json({ date, suburbs });
}
