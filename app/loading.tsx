import { Skeleton } from "@/components/ui/Skeleton";

// Streamed instantly inside the shell while the dashboard's data resolves, so the layout paints
// immediately (good LCP). The reserved heights mirror the real sections (KPI row, charts, drivers,
// word cloud, distributions) so almost nothing shifts when the content swaps in (low CLS).
export default function Loading() {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="px-4 py-3 md:px-8">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div className="px-4 pb-16 pt-6 md:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <hr className="my-8 border-gray-200" />

        {/* KPI row */}
        <Skeleton className="mb-2 h-5 w-80 max-w-full" />
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>

        {/* Over-time chart */}
        <Skeleton className="mb-2 h-5 w-80 max-w-full" />
        <Skeleton className="mb-8 h-[360px] w-full" />

        {/* Category breakdown */}
        <Skeleton className="mb-2 h-5 w-80 max-w-full" />
        <Skeleton className="mb-8 h-80 w-full" />

        {/* Drivers */}
        <Skeleton className="mb-2 h-5 w-80 max-w-full" />
        <Skeleton className="mb-8 h-[560px] w-full" />

        {/* Word cloud */}
        <Skeleton className="mb-2 h-5 w-80 max-w-full" />
        <Skeleton className="mb-8 h-[500px] w-full" />

        {/* Distributions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[340px] w-full" />
        </div>
      </div>
    </>
  );
}
