import { Skeleton } from "@/components/ui/Skeleton";

// Shown inside the slide-over while a place profile streams in. Reserves the rough shape of the real
// content (hero, title, summary, theme cards, reviews) so the panel fills smoothly instead of
// flashing a centred spinner.
export function PlaceProfileSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading place details">
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
