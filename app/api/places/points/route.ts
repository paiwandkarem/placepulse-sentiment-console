import { getPlacePoints } from "@/lib/services/placesService";

// Map points for the Places directory, fetched on demand when the user opens the map (so the points
// query and the Mapbox bundle never touch the directory's first load). Mirrors the page's filters.
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const points = await getPlacePoints({
    query: searchParams.get("q") ?? undefined,
    suburb: searchParams.get("suburb") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });
  return Response.json({ points });
}
