import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import dayjs from "dayjs";
import { Database } from "lucide-react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { SentimentKpiCards } from "@/components/dashboard/SentimentKpiCards";
import { SentimentOverTimeChart } from "@/components/dashboard/SentimentOverTimeChart";
import { CategorySentimentBreakdown } from "@/components/dashboard/CategorySentimentBreakdown";
import { SentimentDriversSection } from "@/components/dashboard/SentimentDriversSection";
import { WordCloudPanel } from "@/components/dashboard/WordCloudPanel";
import { StarRatingDistribution } from "@/components/dashboard/StarRatingDistribution";
import { SentimentLabelDistribution } from "@/components/dashboard/SentimentLabelDistribution";
import { MapEdgeTab } from "@/components/dashboard/MapEdgeTab";
import { MapDrawer } from "@/components/dashboard/MapDrawer";
import { MapDrawerProvider } from "@/components/dashboard/MapDrawerContext";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getSentimentDashboardContext,
  listAvailableFilters,
  normaliseFilters,
} from "@/lib/services/sentimentService";
import { sentimentFilterSchema } from "@/lib/validation/sentiment";

export const revalidate = 300;

// The docked copilot is code-split so the AI SDK and chat UI stay out of the dashboard's first load.
const AssistantDock = dynamic(() => import("@/components/ai/AssistantDock").then((m) => m.AssistantDock));

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Reflect the selected suburb in the document title so shared links and tabs are meaningful.
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const area = first(params.areaName);
  return { title: area ? `${area} sentiment | PlacePulse` : "Sentiment | PlacePulse" };
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = sentimentFilterSchema.parse({
    aggType: first(params.aggType),
    areaName: first(params.areaName),
    category: first(params.category),
    date: first(params.date),
  });

  // getSentimentDashboardContext returns null when the slice is simply empty, and throws on a real
  // fault. The one expected throw is an entirely un-imported table; treat that as empty, log it,
  // and let every other fault reach the error boundary rather than masking an outage as "no data".
  let context: Awaited<ReturnType<typeof getSentimentDashboardContext>> = null;
  try {
    context = await getSentimentDashboardContext(filters);
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("No sentiment data has been imported"))) {
      throw error;
    }
    console.error(error);
  }
  const recovery = context ? null : await buildRecovery(filters);
  const catalogue = context?.availableFilters ?? recovery?.availableFilters ?? null;
  const selected = context?.filters ?? recovery?.selected ?? null;
  const latestMonth = context ? dayjs(context.filters.date).format("MMMM YYYY") : "";

  return (
    <MapDrawerProvider>
      {catalogue && selected && (
        <div className="sticky top-14 z-30 border-b border-gray-200 bg-white shadow-sm md:top-0">
          <div className="px-4 py-3 md:px-8">
            <Suspense fallback={<Skeleton className="h-12 w-full" />}>
              <FilterBar catalogue={catalogue} selected={selected} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="px-4 pb-16 pt-6 md:px-8">
        <div className="mb-4">
          <PageHeader
            title="Sentiment"
            subtitle="How visitors rate and review each suburb, drawn from Google reviews: ratings, recurring themes, and sentiment over the past three years."
            aside={
              catalogue?.minDate && catalogue?.maxDate ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
                  Data available <span className="font-semibold text-gray-900">{catalogue.minDate}</span> to{" "}
                  <span className="font-semibold text-gray-900">{catalogue.maxDate}</span>
                </div>
              ) : undefined
            }
          />
        </div>
        <hr className="mb-8 border-gray-200" />

        {context ? (
          (() => {
            // Overall mode rolls every category together (no category filter); specific-category
            // mode drills into one. The page swaps a full category breakdown for a slim rank bar.
            const isOverall = !context.filters.category;
            const sorted = [...context.categoryBreakdown].sort(
              (a, b) => b.overallSatisfaction100 - a.overallSatisfaction100,
            );
            const rank = sorted.findIndex((c) => c.category === context.filters.category) + 1;
            const total = sorted.length;
            const score = context.record.overallSatisfaction100;
            return (
              <>
                {!isOverall && (
                  <div className="mb-8 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
                    <span className="text-lg font-semibold text-gray-900">
                      {context.filters.category}
                      {rank > 0 && (
                        <span className="text-sm font-normal text-gray-600">
                          {" "}
                          &middot; #{rank} of {total} categories in {context.filters.areaName}
                        </span>
                      )}{" "}
                      <span className="text-sm font-normal text-gray-600">&middot; {score.toFixed(1)}/100</span>
                    </span>
                    <Link
                      href={`/?aggType=mthly_suburb&areaName=${encodeURIComponent(context.filters.areaName)}`}
                      className="shrink-0 font-semibold text-emerald-700 hover:underline"
                    >
                      View all categories
                    </Link>
                  </div>
                )}

                <section id="overview" className="mb-8 scroll-mt-24">
              <SectionHeader
                title="How satisfied are visitors with this suburb?"
                subtitle={`Headline sentiment for ${latestMonth}, compared with the same month a year earlier.`}
              />
              <SentimentKpiCards record={context.record} trend={context.trend} />
            </section>

            <section id="trend" className="mb-8 scroll-mt-24">
              <SectionHeader
                title="How has sentiment moved over the past three years?"
                subtitle="Monthly overall sentiment, with each calendar month aligned across the last three years for seasonal comparison."
              />
              <SentimentOverTimeChart trend={context.trend} />
            </section>

            {isOverall && (
              <section id="categories" className="mb-8 scroll-mt-24">
                <SectionHeader
                  title="Which categories shape sentiment in this suburb?"
                  subtitle={`Overall sentiment by business category for ${context.filters.areaName} in ${latestMonth}. Select a category to view it in detail.`}
                />
                <CategorySentimentBreakdown
                  categories={context.categoryBreakdown}
                  areaLabel={context.filters.areaName}
                />
              </section>
            )}

            <section id="drivers" className="mb-8 scroll-mt-24">
              <SectionHeader
                title="What is driving positive and negative reviews?"
                subtitle="Recurring themes grouped into what is working, what is not, and mixed reception. Hover a theme for its full sentiment split and year-on-year change, or open representative reviews."
              />
              <SentimentDriversSection
                drivers={context.drivers}
                reviews={context.record.topReviews}
                areaLabel={context.filters.areaName}
              />
            </section>

            <section id="words" className="mb-8 scroll-mt-24">
              <SectionHeader
                title="Which words appear most across reviews?"
                subtitle={`The most frequent words in positive, negative, and neutral reviews for ${latestMonth}. A word can appear in more than one tone where reviewers use it differently.`}
              />
              <WordCloudPanel wordCloud={context.record.wordCloud} />
            </section>

            <section id="distributions" className="mb-8 scroll-mt-24">
              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                <div className="flex flex-col">
                  <SectionHeader
                    title="How are star ratings distributed?"
                    subtitle={`Share of reviews by star rating in ${latestMonth}.`}
                  />
                  <StarRatingDistribution record={context.record} />
                </div>
                <div className="flex flex-col">
                  <SectionHeader
                    title="How does review sentiment break down by tone?"
                    subtitle={`Share of reviews that are positive, neutral, or negative in ${latestMonth}.`}
                  />
                  <SentimentLabelDistribution record={context.record} />
                </div>
              </div>
            </section>
              </>
            );
          })()
        ) : (
          <Card>
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                <Database className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-gray-900">No Sentiment Data For This Selection</h2>
              <p className="max-w-md text-sm text-gray-600">
                {recovery
                  ? "Try a different area, category, period or granularity above."
                  : "No sentiment data has been imported yet. Run the importer to load data."}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Right-edge tab to open the map (in addition to the filter-bar toggle) */}
      <MapEdgeTab />

      {/* Map slide-over drawer: opens instantly on client state, map loads inside it */}
      <MapDrawer suburbs={catalogue?.areaNames ?? []} selected={selected?.areaName ?? null} />

      {/* Docked copilot: the assistant, seeded with the current selection so it answers in context */}
      <AssistantDock areaName={selected?.areaName} category={selected?.category} />
    </MapDrawerProvider>
  );
}

// When the slice has no record, offer the filter catalogue so the user can pick another suburb or
// category. An empty catalogue means nothing has been imported (the no-data card). Real faults are
// left to propagate to the error boundary.
async function buildRecovery(filters: Parameters<typeof normaliseFilters>[0]) {
  const availableFilters = await listAvailableFilters();
  if (availableFilters.areaNames.length === 0) return null;
  return { availableFilters, selected: await normaliseFilters(filters) };
}
