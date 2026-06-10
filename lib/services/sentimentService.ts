import "server-only";
import {
  compareAreas,
  getRecord,
  getTrend,
  listFilters,
} from "@/lib/repositories/sentimentRepository";
import type {
  FilterCatalogue,
  SentimentComparison,
  SentimentDashboardContext,
  SentimentFilters,
} from "@/lib/types";
import type { ComparisonInput, RequiredSentimentFilters } from "@/lib/validation/sentiment";

// The service holds the business rules: turning a partial, user-supplied selection into a
// concrete one, and composing the pieces the dashboard needs. It depends on the repository
// for data but knows nothing about SQL, HTTP or React — which keeps it reusable by the API
// routes, the server-rendered page and the AI tools alike.

export async function listAvailableFilters(): Promise<FilterCatalogue> {
  return listFilters();
}

// The dashboard's opening state when the URL carries no filters: first area/category/
// aggregation, most recent date (people usually want the latest period first).
export async function getDefaultFilters(): Promise<RequiredSentimentFilters> {
  const catalogue = await listAvailableFilters();

  if (!catalogue.aggTypes[0] || !catalogue.areaNames[0] || !catalogue.categories[0] || !catalogue.dates[0]) {
    throw new Error("No sentiment data has been imported yet.");
  }

  return {
    aggType: catalogue.aggTypes[0],
    areaName: catalogue.areaNames[0],
    category: catalogue.categories[0],
    date: catalogue.dates.at(-1) ?? catalogue.dates[0],
  };
}

// Fill any missing filter with its default so downstream code always has a complete
// selection. Each field falls back independently, which is simple and predictable; the
// trade-off is that an unusual combination may not exist as a record — getSentimentDashboard
// Context surfaces that explicitly rather than guessing.
export async function normaliseFilters(input: SentimentFilters): Promise<RequiredSentimentFilters> {
  const defaults = await getDefaultFilters();

  return {
    aggType: input.aggType || defaults.aggType,
    areaName: input.areaName || defaults.areaName,
    category: input.category || defaults.category,
    date: input.date || defaults.date,
  };
}

// Everything the dashboard renders in one call: the resolved filters, the selected record,
// its trend series, and the catalogue that powers the filter controls. Fetched in parallel
// since none depends on another.
export async function getSentimentDashboardContext(input: SentimentFilters): Promise<SentimentDashboardContext> {
  const filters = await normaliseFilters(input);

  const [record, trend, availableFilters] = await Promise.all([
    getRecord(filters),
    getTrend({ aggType: filters.aggType, areaName: filters.areaName, category: filters.category }),
    listAvailableFilters(),
  ]);

  if (!record) {
    throw new Error(`No sentiment record found for ${filters.areaName}, ${filters.category}, ${filters.date}`);
  }

  return { filters, record, trend, availableFilters };
}

export async function getAreaComparison(input: ComparisonInput): Promise<SentimentComparison> {
  const comparison = await compareAreas(input);

  if (!comparison) {
    throw new Error("Comparison data was not available for the selected filters.");
  }

  return comparison;
}
