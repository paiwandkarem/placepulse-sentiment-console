import "server-only";
import dayjs from "dayjs";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/cacheKeys";
import {
  compareAreas,
  getCategoryBreakdown,
  getDefaultSlice,
  getRecord,
  getThemes,
  getTrend,
  listFilters,
} from "@/lib/repositories/sentimentRepository";
import { enrichThemes } from "@/lib/sentiment/themeBuckets";
import { MONTHLY_OVERALL_AGG } from "@/lib/filters";
import type {
  FilterCatalogue,
  SentimentComparison,
  SentimentDashboardContext,
  SentimentFilters,
  SentimentTrendPoint,
} from "@/lib/types";
import type { ComparisonInput, RequiredSentimentFilters } from "@/lib/validation/sentiment";

// The service holds the business rules: turning a partial, user-supplied selection into a
// concrete one, and composing the pieces the dashboard needs. It depends on the repository
// for data but knows nothing about SQL, HTTP or React, which keeps it reusable by the API
// routes, the server-rendered page and the AI tools alike.

// The filter catalogue (distinct suburbs, categories, dates) is the most expensive read and only
// changes on a new import, yet every dashboard render needs it. Cache it independently with a long
// TTL and a tag, so it is computed roughly once per hour rather than per request; the revalidate
// route busts CACHE_TAGS.filters after an import.
const cachedListFilters = unstable_cache(listFilters, ["sentiment-filter-catalogue"], {
  tags: [CACHE_TAGS.filters],
  revalidate: 3600,
});

export async function listAvailableFilters(): Promise<FilterCatalogue> {
  try {
    return await cachedListFilters();
  } catch (error) {
    // unstable_cache needs Next's request-scoped incremental cache. Outside a request (a CLI eval or
    // a script) that is absent, so fall back to the uncached query rather than failing.
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return listFilters();
    }
    throw error;
  }
}

// The dashboard's opening state when the URL carries no filters. We open on a real,
// data-rich slice (see getDefaultSlice) so the first view shows populated data. Only if the
// table is empty do we fall back to the independent first-of-each / latest-date guess, which
// then surfaces the "no data" path.
export async function getDefaultFilters(): Promise<RequiredSentimentFilters> {
  const slice = await getDefaultSlice();
  if (slice) return slice;

  const catalogue = await listAvailableFilters();

  if (!catalogue.areaNames[0] || !catalogue.dates[0]) {
    throw new Error("No sentiment data has been imported yet.");
  }

  // Fallback when no rows match the preferred slice: open on the overall monthly aggregate.
  return {
    aggType: MONTHLY_OVERALL_AGG,
    areaName: catalogue.areaNames[0],
    category: undefined,
    date: catalogue.dates.at(-1) ?? catalogue.dates[0],
  };
}

// Fill any missing filter with its default so downstream code always has a complete
// selection. When the caller already supplied all four we skip the default lookup entirely:
// no need to query for a default slice on a fully-specified request.
export async function normaliseFilters(input: SentimentFilters): Promise<RequiredSentimentFilters> {
  // A fully-specified selection needs aggType, area and date. Category is optional: its absence
  // means the overall aggregate, and the caller's aggType already encodes which family to read.
  if (input.aggType && input.areaName && input.date) {
    return {
      aggType: input.aggType,
      areaName: input.areaName,
      category: input.category,
      date: input.date,
    };
  }

  const defaults = await getDefaultFilters();

  // When the caller pinned an aggType, trust their category (which may be absent for overall);
  // otherwise fall back to the default slice wholesale.
  return {
    aggType: input.aggType || defaults.aggType,
    areaName: input.areaName || defaults.areaName,
    category: input.aggType ? input.category : defaults.category,
    date: input.date || defaults.date,
  };
}

// Everything the dashboard renders in one call: the resolved filters, the selected record,
// its trend series, and the catalogue that powers the filter controls. Fetched in parallel
// since none depends on another.
// Returns null when the resolved slice simply has no row (an expected empty state the page shows
// a recovery card for). Genuine faults (a Neon outage, a SQL error) throw and propagate to the
// route error boundary, so an outage is never silently rendered as "no data".
export async function getSentimentDashboardContext(input: SentimentFilters): Promise<SentimentDashboardContext | null> {
  const resolved = await normaliseFilters(input);

  // The user no longer picks a period. We fetch the whole trend for the area/category and pin the
  // snapshot (KPIs, drivers, words, distributions) to the most recent month; the chart carries
  // the history. The trend is ordered ascending, so the last point is the latest month.
  const trend = await getTrend({
    aggType: resolved.aggType,
    areaName: resolved.areaName,
    category: resolved.category,
  });
  const latestDate = trend.length ? trend[trend.length - 1].date : resolved.date;
  const filters = { ...resolved, date: latestDate };

  // The slice exactly one year earlier, used only to derive the drivers' year-on-year deltas.
  // It may not exist (the series might not reach back a year), in which case getThemes returns an
  // empty list and the deltas are simply omitted.
  const lastYearDate = dayjs(latestDate).subtract(1, "year").format("YYYY-MM-DD");

  const [record, availableFilters, lastYearThemes, categoryBreakdown] = await Promise.all([
    getRecord(filters),
    listAvailableFilters(),
    getThemes({ ...filters, date: lastYearDate }),
    getCategoryBreakdown({ areaName: resolved.areaName, date: latestDate }),
  ]);

  if (!record) return null;

  const drivers = enrichThemes(record.themes, lastYearThemes);

  return { filters, record, trend, availableFilters, drivers, categoryBreakdown };
}

// The trend series on its own, without requiring a record for any single date. The chart
// shows a whole time line for an area/category, so it only needs the aggregation, area and
// category resolved. Fetching the full dashboard context here would be wasteful and would
// fail if the currently-selected date happened to have no row.
export async function getSentimentTrend(input: SentimentFilters): Promise<SentimentTrendPoint[]> {
  const filters = await normaliseFilters(input);
  return getTrend({ aggType: filters.aggType, areaName: filters.areaName, category: filters.category });
}

export async function getAreaComparison(input: ComparisonInput): Promise<SentimentComparison> {
  const comparison = await compareAreas(input);

  if (!comparison) {
    throw new Error("Comparison data was not available for the selected filters.");
  }

  return comparison;
}
