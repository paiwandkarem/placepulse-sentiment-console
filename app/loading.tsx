import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardBodySkeleton } from "@/components/dashboard/DashboardBodySkeleton";

// Streamed instantly inside the shell while the dashboard's data resolves. The real page title and
// subtitle render here as actual text (not skeletons) so First Contentful Paint fires on the heading
// at ~TTFB instead of waiting for the data query. The data-dependent sections below are reserved by
// the shared DashboardBodySkeleton, whose heights mirror the real components so the swap-in shifts
// almost nothing (low CLS).
export default function Loading() {
  return (
    <>
      {/* Match the real filter bar's sticky offset (page.tsx): below the mobile top bar, flush on md+. */}
      <div className="sticky top-14 z-30 border-b border-gray-200 bg-white md:top-0">
        <div className="px-4 py-3 md:px-8">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div className="px-4 pb-16 pt-6 md:px-8">
        <PageHeader
          title="Sentiment"
          subtitle="How visitors rate and review each suburb, drawn from Google reviews: ratings, recurring themes, and sentiment over the past three years."
        />
        <hr className="my-8 border-gray-200" />
        <DashboardBodySkeleton />
      </div>
    </>
  );
}
