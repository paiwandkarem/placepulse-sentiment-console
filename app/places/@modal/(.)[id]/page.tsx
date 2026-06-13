import { Suspense } from "react";
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

// Intercepts /places/[id] when navigated to from the explorer: the profile opens as a slide-over
// over the map. The Modal chrome renders instantly; the profile streams in behind a Suspense
// fallback. A direct visit or refresh of /places/[id] renders the full page instead (no intercept).
export default async function InterceptedPlace({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const reviewPage = Math.max(1, Number(first(sp.rpage) ?? "1") || 1);

  return (
    <Modal>
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
  );
}
