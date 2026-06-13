import type { Metadata } from "next";
import { Suspense } from "react";
import { getPlaceCategories } from "@/lib/services/placesService";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import { Spinner } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "Places | PlacePulse",
  description: "Explore Queensland businesses on the map: search, filter, and open a place for its themes, reviews and word cloud.",
};

// The explorer reads its filters from the URL on the client, so the page renders fresh per request.
export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const categories = await getPlaceCategories();

  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-gray-50">
          <Spinner />
        </div>
      }
    >
      <PlacesExplorer categories={categories} />
    </Suspense>
  );
}
