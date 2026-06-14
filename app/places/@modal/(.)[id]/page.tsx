import { Suspense } from "react";
import { Modal } from "@/components/places/Modal";
import { PlaceProfile } from "@/components/places/PlaceProfile";
import { PlaceProfileSkeleton } from "@/components/places/PlaceProfileSkeleton";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Intercepts /places/[id] when navigated to from the explorer: the profile opens as a slide-over
// over the map. The Modal chrome renders instantly; the profile streams in behind a Suspense
// fallback. A direct visit or refresh of /places/[id] renders the full page instead (no intercept).
export default async function InterceptedPlace({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const reviewPage = Math.max(1, Number(first(sp.rpage) ?? "1") || 1);

  return (
    <Modal>
      <Suspense fallback={<PlaceProfileSkeleton />}>
        <PlaceProfile placeId={decodeURIComponent(id)} reviewPage={reviewPage} />
      </Suspense>
    </Modal>
  );
}
