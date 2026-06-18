import { Skeleton } from "@/components/ui/Skeleton";

// The dashboard's data-dependent sections (KPI row, trend chart, category breakdown, drivers, word
// cloud, distributions) as a skeleton. Shared by the route-level loading fallback and the in-page
// <Suspense> boundary that streams these sections, so the reserved heights — which mirror the real
// components exactly — stay in one place and the swap-in shifts almost nothing (low CLS).
export function DashboardBodySkeleton() {
  return (
    <>
      {/* KPI row */}
      <Skeleton className="mb-2 h-5 w-80 max-w-full" />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>

      {/* Over-time chart: match the card's real height (p-5 padding + the chart's responsive height,
          h-72/sm:h-80/md:h-[340px]) so the swap-in does not nudge the page. */}
      <Skeleton className="mb-2 h-5 w-80 max-w-full" />
      <Skeleton className="mb-8 h-[328px] w-full sm:h-[360px] md:h-[380px]" />

      {/* Category breakdown — a fixed-height card, so the skeleton can reserve its exact footprint. */}
      <Skeleton className="mb-2 h-5 w-80 max-w-full" />
      <Skeleton className="mb-8 h-[392px] w-full" />

      {/* Drivers */}
      <Skeleton className="mb-2 h-5 w-80 max-w-full" />
      <Skeleton className="mb-8 h-[560px] w-full" />

      {/* Word cloud */}
      <Skeleton className="mb-2 h-5 w-80 max-w-full" />
      <Skeleton className="mb-8 h-[500px] w-full" />

      {/* Distributions — match the components' responsive height exactly (h-80 on phones, 340 up) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full md:h-[340px]" />
        <Skeleton className="h-80 w-full md:h-[340px]" />
      </div>
    </>
  );
}
