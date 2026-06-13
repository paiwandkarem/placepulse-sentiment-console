import { Skeleton } from "@/components/ui/Skeleton";

// Streamed while the directory query runs (the count over the place dataset can take a moment), so
// the page paints structure immediately rather than blocking on data.
export default function Loading() {
  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-96 max-w-full" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
