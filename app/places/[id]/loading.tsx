import { Spinner } from "@/components/ui/Spinner";

// A direct load of /places/[id] renders the explorer with the place as a slide-over; while that
// boots, show the same full-surface spinner the explorer itself uses, so there is no full-page
// skeleton flash.
export default function Loading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-gray-50">
      <Spinner />
    </div>
  );
}
