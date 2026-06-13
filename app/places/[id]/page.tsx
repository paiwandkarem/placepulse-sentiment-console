import type { Metadata } from "next";
import { Suspense } from "react";
import { getPlaceCategories, getPlaceProfile } from "@/lib/services/placesService";
import { listAvailableFilters } from "@/lib/services/sentimentService";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import { Modal } from "@/components/places/Modal";
import { PlaceProfile } from "@/components/places/PlaceProfile";
import { Spinner } from "@/components/ui/Spinner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPlaceProfile(decodeURIComponent(id));
  return { title: profile ? `${profile.detail.name} | PlacePulse` : "Place | PlacePulse" };
}

// A place is only ever a slide-over over the map, never a standalone page. Navigating from the
// explorer intercepts this route (see app/places/@modal/(.)[id]); a direct visit, refresh or
// deep-link lands here, where we render the same explorer behind the same slide-over so the
// experience is identical. The modal closes back to the explorer (preserving any active filters)
// rather than popping history, since on a direct load there is nothing to pop.
export default async function PlacePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const reviewPage = Math.max(1, Number(first(sp.rpage) ?? "1") || 1);

  const [categories, filters] = await Promise.all([getPlaceCategories(), listAvailableFilters()]);

  const closeParams = new URLSearchParams();
  for (const key of ["q", "suburb", "category"] as const) {
    const value = first(sp[key]);
    if (value) closeParams.set(key, value);
  }
  const closeHref = closeParams.toString() ? `/places?${closeParams.toString()}` : "/places";

  return (
    <>
      <PlacesExplorer categories={categories} areaNames={filters.areaNames} />
      <Modal closeHref={closeHref}>
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <PlaceProfile placeId={decodeURIComponent(id)} reviewPage={reviewPage} />
        </Suspense>
      </Modal>
    </>
  );
}
