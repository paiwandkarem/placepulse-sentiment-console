import { Skeleton } from "@/components/ui/Skeleton";

// Streamed while a place profile loads (detail, themes, reviews and terms in parallel).
export default function Loading() {
  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-2 h-9 w-72 max-w-full" />
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-xl lg:col-span-1" />
        <Skeleton className="h-96 w-full rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}
