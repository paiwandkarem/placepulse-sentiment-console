import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { listAvailableFilters } from "@/lib/services/sentimentService";
import { listBriefJobs } from "@/lib/briefs/repository";
import { BriefsView } from "@/components/briefs/BriefsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "Briefs | PlacePulse",
  description: "Generate and view executive sentiment briefs for Queensland suburbs.",
};

// The list reflects jobs that change in the background, so this page is always rendered fresh rather
// than cached. The client view then polls while any brief is still generating.
export const dynamic = "force-dynamic";

const SUBTITLE =
  "Generate an executive PDF brief for a suburb. The figures are drawn from the data; the summary, findings and recommendations are written from those figures.";

export default function BriefsPage() {
  // The header is rendered with no data dependency, so it paints at ~TTFB (good FCP/LCP); the view —
  // which waits on the signed-in user's brief list (uncached, per-user) — streams in behind Suspense
  // rather than gating the whole page on that query.
  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <div className="mb-6">
        <PageHeader title="Briefs" subtitle={SUBTITLE} />
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-[60vh] w-full items-center justify-center" role="status" aria-label="Loading briefs">
            <Spinner />
          </div>
        }
      >
        <BriefsLoader />
      </Suspense>
    </div>
  );
}

async function BriefsLoader() {
  // Middleware guarantees a signed-in user here; we still read the id so the list only ever shows
  // this user's briefs.
  const { userId } = await auth();
  const [catalogue, briefs] = await Promise.all([
    listAvailableFilters(),
    userId ? listBriefJobs(userId) : Promise.resolve([]),
  ]);

  return (
    <BriefsView areaNames={catalogue.areaNames} categories={catalogue.categories} initialBriefs={briefs} />
  );
}
