import { Suspense } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SentimentKpiCards } from "@/components/dashboard/SentimentKpiCards";
import { SentimentTrendChart } from "@/components/dashboard/SentimentTrendChart";
import { ThemeRankingPanel } from "@/components/dashboard/ThemeRankingPanel";
import { WordCloudPanel } from "@/components/dashboard/WordCloudPanel";
import { EvidenceReviewsPanel } from "@/components/dashboard/EvidenceReviewsPanel";
import { CoverageConfidencePanel } from "@/components/dashboard/CoverageConfidencePanel";
import { DeploymentStatusCard } from "@/components/platform/DeploymentStatusCard";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getSentimentDashboardContext,
  listAvailableFilters,
  normaliseFilters,
} from "@/lib/services/sentimentService";
import { sentimentFilterSchema } from "@/lib/validation/sentiment";

// Server-rendered dashboard. All data is fetched on the server in one service call and the
// page is statically revalidated every 5 minutes, matching the read-API cache window.
export const revalidate = 300;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// A query param can arrive as a string or string[]; the dashboard only cares about a single
// value per filter.
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = sentimentFilterSchema.parse({
    aggType: first(params.aggType),
    areaName: first(params.areaName),
    category: first(params.category),
    date: first(params.date),
  });

  // The service throws when the resolved selection has no record (an unusual filter
  // combination, or no data imported at all). Catch it here so the route degrades to a
  // recoverable empty state instead of a 500 / blank screen.
  let context = null;
  try {
    context = await getSentimentDashboardContext(filters);
  } catch {
    context = null;
  }

  // When there's no record for the selection but data does exist, still render the filter bar
  // so the user can pick a valid combination without editing the URL by hand.
  const recovery = context ? null : await buildRecovery(filters);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-medium text-zinc-500">Vercel Solutions Architect Take-Home</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
            PlacePulse Sentiment Intelligence Console
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-600">
            Explore sentiment across Australian places, categories and time periods, then
            generate AI-assisted evidence-backed briefings.
          </p>
        </header>

        {context ? (
          <>
            {/* FilterBar reads useSearchParams, so it sits behind a Suspense boundary — that
                lets the static parts of the page prerender while the URL-dependent control
                hydrates on the client. */}
            <Suspense fallback={<Skeleton className="h-24 w-full" />}>
              <FilterBar catalogue={context.availableFilters} selected={context.filters} />
            </Suspense>

            <SentimentKpiCards record={context.record} />

            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <SentimentTrendChart trend={context.trend} />
              <CoverageConfidencePanel record={context.record} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <ThemeRankingPanel themes={context.record.themes} />
              <WordCloudPanel wordCloud={context.record.wordCloud} />
              <EvidenceReviewsPanel reviews={context.record.topReviews} />
            </div>

            <DeploymentStatusCard />

            {/* SentimentAssistantDrawer is mounted here in commit 30, once the AI chat route
                and the drawer component exist. */}
          </>
        ) : (
          <>
            {recovery ? (
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <FilterBar catalogue={recovery.availableFilters} selected={recovery.selected} />
              </Suspense>
            ) : null}
            <Card>
              <h2 className="text-lg font-semibold">No sentiment data for this selection</h2>
              <p className="mt-2 text-sm text-zinc-600">
                {recovery
                  ? "Try a different area, category, date or aggregation above."
                  : "No sentiment data has been imported yet — run the importer to load data."}
              </p>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

// Best-effort data for the empty state. Returns the catalogue plus a resolved selection when
// any data exists, or null when the dataset is empty / unavailable.
async function buildRecovery(filters: Parameters<typeof normaliseFilters>[0]) {
  try {
    const availableFilters = await listAvailableFilters();
    if (availableFilters.areaNames.length === 0) return null;
    return { availableFilters, selected: await normaliseFilters(filters) };
  } catch {
    return null;
  }
}
