import { Spinner } from "@/components/ui/Spinner";

// Streamed while the explorer shell (the category list) loads; the map then hydrates client-side.
export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full items-center justify-center bg-gray-50 md:h-[100dvh]" role="status" aria-label="Loading places">
      <Spinner />
    </div>
  );
}
