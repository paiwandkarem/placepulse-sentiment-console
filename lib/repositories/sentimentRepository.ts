import "server-only";
import { sql } from "@/lib/db/client";
import type {
  FilterCatalogue,
  SentimentComparison,
  SentimentRecord,
  SentimentTrendPoint,
} from "@/lib/types";
import type { ComparisonInput, RequiredSentimentFilters } from "@/lib/validation/sentiment";

// The repository is the only place that talks SQL. It returns domain objects (camelCase,
// typed) and never leaks raw rows upward, so the service and UI layers stay decoupled from
// the table shape. There are no file reads here — Postgres is the runtime source of truth.

type DbRow = Record<string, unknown>;

// Postgres `date` columns can come back as a Date or a string depending on the driver path;
// normalise to a plain YYYY-MM-DD so the rest of the app deals in one date format.
function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// Numeric columns may be NULL (genuinely unknown metrics). We coerce to 0 at the boundary
// so the UI can render without null checks everywhere; "unknown vs zero" is preserved in the
// database and could be surfaced separately if a view ever needs it.
function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// Single source of truth for row -> SentimentRecord. The jsonb columns are already parsed
// into objects by the driver; we only guard their shape with safe fallbacks.
function mapRecord(row: DbRow): SentimentRecord {
  return {
    queryKey: String(row.query_key),
    aggType: String(row.agg_type),
    date: toDateString(row.date),
    areaName: String(row.area_name),
    category: String(row.category),
    poiCount: toNumber(row.poi_count),
    reviewedPoiCount: toNumber(row.reviewed_poi_count),
    totalReviews: toNumber(row.total_reviews),
    textSignalReviews: toNumber(row.text_signal_reviews),
    themeReviewCount: toNumber(row.theme_review_count),
    avgRating: toNumber(row.avg_rating),
    starRatingSentiment100: toNumber(row.star_rating_sentiment_100),
    reviewTextSentiment100: toNumber(row.review_text_sentiment_100),
    overallSatisfaction100: toNumber(row.overall_satisfaction_100),
    positiveReviews: toNumber(row.positive_reviews),
    negativeReviews: toNumber(row.negative_reviews),
    neutralReviews: toNumber(row.neutral_reviews),
    unknownReviews: toNumber(row.unknown_reviews),
    positivePct: toNumber(row.positive_pct),
    negativePct: toNumber(row.negative_pct),
    neutralPct: toNumber(row.neutral_pct),
    unknownPct: toNumber(row.unknown_pct),
    reviewCoveragePct: toNumber(row.review_coverage_pct),
    textSignalCoveragePct: toNumber(row.text_signal_coverage_pct),
    themeCoveragePct: toNumber(row.theme_coverage_pct),
    ratingTextConflictCount: toNumber(row.rating_text_conflict_count),
    ratingTextConflictPct: toNumber(row.rating_text_conflict_pct),
    themes: toArray(row.theme_sentiment_json),
    wordCloud: (row.word_cloud_json ?? { positive: [], negative: [], neutral: [] }) as SentimentRecord["wordCloud"],
    topReviews: (row.top_reviews_json ?? { positive: [], negative: [], neutral: [] }) as SentimentRecord["topReviews"],
  };
}

// Distinct values that drive the filter UI. Run as one round trip of parallel queries so the
// catalogue is cheap even though it's four lookups.
export async function listFilters(): Promise<FilterCatalogue> {
  const [aggTypes, areaNames, categories, dates] = await Promise.all([
    sql`select distinct agg_type from sentiment_area_category_month order by agg_type`,
    sql`select distinct area_name from sentiment_area_category_month order by area_name`,
    sql`select distinct category from sentiment_area_category_month order by category`,
    sql`select distinct date::text as date from sentiment_area_category_month order by date`,
  ]);

  return {
    aggTypes: aggTypes.map((row) => String(row.agg_type)),
    areaNames: areaNames.map((row) => String(row.area_name)),
    categories: categories.map((row) => String(row.category)),
    dates: dates.map((row) => String(row.date)),
    minDate: dates[0] ? String(dates[0].date) : undefined,
    maxDate: dates.at(-1) ? String(dates.at(-1)?.date) : undefined,
  };
}

// One fully-specified slice: the record for a single area/category/date/aggregation.
export async function getRecord(filters: RequiredSentimentFilters): Promise<SentimentRecord | null> {
  const rows = await sql`
    select *
    from sentiment_area_category_month
    where agg_type = ${filters.aggType}
      and area_name = ${filters.areaName}
      and category = ${filters.category}
      and date = ${filters.date}
    limit 1
  `;

  return rows[0] ? mapRecord(rows[0]) : null;
}

// The time series for one area/category across every available date. Selects only the
// columns the trend chart needs rather than the full row.
export async function getTrend(
  filters: Omit<RequiredSentimentFilters, "date">,
): Promise<SentimentTrendPoint[]> {
  const rows = await sql`
    select date::text as date, overall_satisfaction_100, avg_rating, positive_pct, negative_pct, neutral_pct, total_reviews
    from sentiment_area_category_month
    where agg_type = ${filters.aggType}
      and area_name = ${filters.areaName}
      and category = ${filters.category}
    order by date
  `;

  return rows.map((row) => ({
    date: String(row.date),
    overallSatisfaction100: toNumber(row.overall_satisfaction_100),
    avgRating: toNumber(row.avg_rating),
    positivePct: toNumber(row.positive_pct),
    negativePct: toNumber(row.negative_pct),
    neutralPct: toNumber(row.neutral_pct),
    totalReviews: toNumber(row.total_reviews),
  }));
}

// Two areas side by side for the same category and date, with the deltas the UI highlights.
// Returns null if either side is missing so the caller can decide how to report it.
export async function compareAreas(input: ComparisonInput): Promise<SentimentComparison | null> {
  const [base, comparison] = await Promise.all([
    getRecord({ aggType: input.aggType, areaName: input.baseAreaName, category: input.category, date: input.date }),
    getRecord({ aggType: input.aggType, areaName: input.comparisonAreaName, category: input.category, date: input.date }),
  ]);

  if (!base || !comparison) return null;

  return {
    base,
    comparison,
    delta: {
      overallSatisfaction100: comparison.overallSatisfaction100 - base.overallSatisfaction100,
      avgRating: comparison.avgRating - base.avgRating,
      positivePct: comparison.positivePct - base.positivePct,
      negativePct: comparison.negativePct - base.negativePct,
      totalReviews: comparison.totalReviews - base.totalReviews,
    },
  };
}
