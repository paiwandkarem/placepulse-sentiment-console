import { Spinner } from "@/components/ui/Spinner";

// A direct load of /places/[id] renders the explorer with the place as a slide-over; while that
// boots, show the same full-surface spinner the explorer itself uses, so there is no full-page
// skeleton flash.
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full items-center justify-center bg-gray-50 md:h-[100dvh]" role="status" aria-label="Loading place details">
      <Spinner />
    </div>
  );
}
