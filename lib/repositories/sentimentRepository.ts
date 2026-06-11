import "server-only";
import { sql } from "@/lib/db/client";
import { MONTHLY_CATEGORY_AGG, MONTHLY_OVERALL_AGG } from "@/lib/filters";
import type {
  CategorySentiment,
  FilterCatalogue,
  ReviewEvidence,
  ReviewSentiment,
  SentimentComparison,
  SentimentRecord,
  SentimentTrendPoint,
  ThemeSentiment,
  TopReviewGroups,
  WordCloudGroups,
  WordCloudTerm,
} from "@/lib/types";
import type { ComparisonInput, RequiredSentimentFilters } from "@/lib/validation/sentiment";

// The repository is the only place that talks SQL. It returns domain objects (camelCase,
// typed) and never leaks raw rows upward, so the service and UI layers stay decoupled from
// the table shape. There are no file reads here: Postgres is the runtime source of truth.

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

// The jsonb columns in this dataset are sometimes stored double-encoded: a JSON string
// inside the jsonb value rather than a native array/object, so the driver hands us a string.
// Parse those back; pass through anything already structured. Without this, the theme, word
// cloud and review panels would silently render empty.
function coerceJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// The jsonb columns arrive parsed but snake_cased and in the source's own shape. These
// mappers normalise them into the camelCase domain types the UI consumes, mirroring what
// mapRecord does for the scalar columns, so nothing downstream has to know the raw shape.

function mapThemes(value: unknown): ThemeSentiment[] {
  return toArray<DbRow>(coerceJson(value)).map((theme) => ({
    theme: String(theme.theme ?? ""),
    reviews: toNumber(theme.reviews),
    mentions: toNumber(theme.mentions),
    positiveReviews: toNumber(theme.positive_reviews),
    negativeReviews: toNumber(theme.negative_reviews),
    neutralReviews: toNumber(theme.neutral_reviews),
    positivePct: toNumber(theme.positive_pct),
    negativePct: toNumber(theme.negative_pct),
    neutralPct: toNumber(theme.neutral_pct),
    avgSentiment: toNumber(theme.avg_sentiment),
    avgSimilarity: toNumber(theme.avg_similarity),
  }));
}

function mapWordCloud(value: unknown): WordCloudGroups {
  const groups = (coerceJson(value) ?? {}) as DbRow;
  const mapGroup = (list: unknown, sentiment: ReviewSentiment): WordCloudTerm[] =>
    toArray<DbRow>(list).map((term) => ({
      term: String(term.term ?? ""),
      mentions: toNumber(term.mentions),
      reviews: toNumber(term.reviews),
      sharePct: toNumber(term.share_pct),
      sentiment,
    }));

  return {
    positive: mapGroup(groups.positive, "positive"),
    negative: mapGroup(groups.negative, "negative"),
    neutral: mapGroup(groups.neutral, "neutral"),
  };
}

function mapTopReviews(value: unknown): TopReviewGroups {
  const groups = (coerceJson(value) ?? {}) as DbRow;
  const mapGroup = (list: unknown, sentiment: ReviewSentiment): ReviewEvidence[] =>
    toArray<DbRow>(list).map((review) => ({
      id: review.review_id != null ? String(review.review_id) : undefined,
      placeId: review.place_id != null ? String(review.place_id) : undefined,
      text: String(review.text ?? ""),
      rating: review.rating == null ? undefined : toNumber(review.rating),
      sentiment,
      sentiment100: review.sentiment_100 == null ? undefined : toNumber(review.sentiment_100),
      date: review.created_at != null ? String(review.created_at) : undefined,
    }));

  return {
    positive: mapGroup(groups.positive, "positive"),
    negative: mapGroup(groups.negative, "negative"),
    neutral: mapGroup(groups.neutral, "neutral"),
  };
}

// Single source of truth for row -> SentimentRecord. The jsonb columns are already parsed
// into objects by the driver; we only guard their shape with safe fallbacks.
function mapRecord(row: DbRow): SentimentRecord {
  return {
    queryKey: String(row.query_key),
    aggType: String(row.agg_type),
    date: toDateString(row.date),
    areaName: String(row.area_name),
    // Overall (suburb-level) rows carry a NULL category; keep it an empty string rather than the
    // literal "null" that String(null) would produce.
    category: row.category == null ? "" : String(row.category),
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
    oneStarPct: toNumber(row.one_star_pct),
    twoStarPct: toNumber(row.two_star_pct),
    threeStarPct: toNumber(row.three_star_pct),
    fourStarPct: toNumber(row.four_star_pct),
    fiveStarPct: toNumber(row.five_star_pct),
    unratedPct: toNumber(row.unrated_pct),
    reviewCoveragePct: toNumber(row.review_coverage_pct),
    textSignalCoveragePct: toNumber(row.text_signal_coverage_pct),
    themeCoveragePct: toNumber(row.theme_coverage_pct),
    ratingTextConflictCount: toNumber(row.rating_text_conflict_count),
    ratingTextConflictPct: toNumber(row.rating_text_conflict_pct),
    themes: mapThemes(row.theme_sentiment_json),
    wordCloud: mapWordCloud(row.word_cloud_json),
    topReviews: mapTopReviews(row.top_reviews_json),
  };
}

// Distinct values that drive the filter UI, collected in a single round trip. A plain
// `array_agg(distinct ...)` reads every one of the millions of rows four times over; at this
// table size that is several seconds and dominates a cold page load. Instead each dimension
// uses a recursive "loose index scan" (skip scan): starting from the smallest value, repeatedly
// jump to the next value strictly greater than the last. With a btree on the column that is one
// index descent per distinct value, so the cost scales with the number of options (hundreds),
// not the number of rows (millions). Needs ix_ss_area / ix_ss_category / ix_ss_date plus the
// agg_type-leading ix_ss_grain. Categories skip the suburb-level nulls.
export async function listFilters(): Promise<FilterCatalogue> {
  const rows = await sql`
    with recursive
    agg as (
      (select agg_type a from sentiment_suburbs order by agg_type limit 1)
      union all
      select (select agg_type from sentiment_suburbs where agg_type > agg.a order by agg_type limit 1)
      from agg where agg.a is not null
    ),
    ar as (
      (select area_name a from sentiment_suburbs order by area_name limit 1)
      union all
      select (select area_name from sentiment_suburbs where area_name > ar.a order by area_name limit 1)
      from ar where ar.a is not null
    ),
    cat as (
      (select category a from sentiment_suburbs where category is not null order by category limit 1)
      union all
      select (select category from sentiment_suburbs where category > cat.a and category is not null order by category limit 1)
      from cat where cat.a is not null
    ),
    dt as (
      (select date d from sentiment_suburbs order by date limit 1)
      union all
      select (select date from sentiment_suburbs where date > dt.d order by date limit 1)
      from dt where dt.d is not null
    )
    select
      (select array_agg(a order by a) from agg where a is not null) as agg_types,
      (select array_agg(a order by a) from ar where a is not null) as area_names,
      (select array_agg(a order by a) from cat where a is not null) as categories,
      (select array_agg(d::text order by d::text) from dt where d is not null) as dates
  `;

  // array_agg returns NULL (not an empty array) on an empty table, so default each to [].
  const row = (rows[0] ?? {}) as DbRow;
  const aggTypes = (row.agg_types ?? []) as string[];
  const areaNames = (row.area_names ?? []) as string[];
  const categories = (row.categories ?? []) as string[];
  const dates = (row.dates ?? []) as string[];

  return {
    aggTypes,
    areaNames,
    categories,
    dates,
    minDate: dates[0],
    maxDate: dates.at(-1),
  };
}

// One fully-specified slice: the record for a single area/category/date/aggregation. Category may
// be absent (the overall, suburb-level aggregate), so it is matched with IS NOT DISTINCT FROM,
// which treats NULL = NULL as a match.
export async function getRecord(filters: RequiredSentimentFilters): Promise<SentimentRecord | null> {
  const rows = await sql`
    select *
    from sentiment_suburbs
    where agg_type = ${filters.aggType}
      and area_name = ${filters.areaName}
      and category is not distinct from ${filters.category ?? null}
      and date = ${filters.date}
    limit 1
  `;

  return rows[0] ? mapRecord(rows[0]) : null;
}

// A real, data-rich slice to open the dashboard on. We open on the most-reviewed suburb-level
// monthly overall slice (no category), so the first view is the headline sentiment for the
// busiest area, with the per-category breakdown a click away.
export async function getDefaultSlice(): Promise<RequiredSentimentFilters | null> {
  const rows = await sql`
    select agg_type, area_name, category, date::text as date
    from sentiment_suburbs
    where agg_type = ${MONTHLY_OVERALL_AGG}
    order by total_reviews desc nulls last
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    aggType: String(row.agg_type),
    areaName: String(row.area_name),
    category: row.category == null ? undefined : String(row.category),
    date: String(row.date),
  };
}

// Just the theme breakdown for one fully-specified slice. The drivers card uses this to pull
// the same slice a year earlier so it can show year-on-year deltas, without paying for the
// full record (every other column) on a row we only read the themes from.
export async function getThemes(filters: RequiredSentimentFilters): Promise<ThemeSentiment[]> {
  const rows = await sql`
    select theme_sentiment_json
    from sentiment_suburbs
    where agg_type = ${filters.aggType}
      and area_name = ${filters.areaName}
      and category is not distinct from ${filters.category ?? null}
      and date = ${filters.date}
    limit 1
  `;

  return rows[0] ? mapThemes(rows[0].theme_sentiment_json) : [];
}

// Every category's sentiment for one area at a single month, ranked by review volume. This
// backs the category breakdown section (one row per category) and the rank chip that places a
// selected category against its peers. We also pull the same area/month a year earlier and join
// on category so each row can carry last year's overall satisfaction for a year-on-year delta;
// categories with no prior-year row simply omit it.
export async function getCategoryBreakdown(filters: {
  areaName: string;
  date: string;
}): Promise<CategorySentiment[]> {
  // Plain string math for the prior-year date (no date library), mirroring SentimentKpiCards.
  const lastYearDate = `${Number(filters.date.slice(0, 4)) - 1}${filters.date.slice(4)}`;

  const [rows, lastYearRows] = await Promise.all([
    sql`
      select category, overall_satisfaction_100, total_reviews, positive_pct, negative_pct, neutral_pct
      from sentiment_suburbs
      where agg_type = ${MONTHLY_CATEGORY_AGG}
        and area_name = ${filters.areaName}
        and date = ${filters.date}
        and category is not null
      order by total_reviews desc nulls last
    `,
    sql`
      select category, overall_satisfaction_100, total_reviews, positive_pct, negative_pct, neutral_pct
      from sentiment_suburbs
      where agg_type = ${MONTHLY_CATEGORY_AGG}
        and area_name = ${filters.areaName}
        and date = ${lastYearDate}
        and category is not null
      order by total_reviews desc nulls last
    `,
  ]);

  const lastYearByCategory = new Map<string, number>(
    lastYearRows.map((row) => [String(row.category), toNumber(row.overall_satisfaction_100)]),
  );

  return rows.map((row) => {
    const category = String(row.category);
    const lastYear = lastYearByCategory.get(category);
    return {
      category,
      overallSatisfaction100: toNumber(row.overall_satisfaction_100),
      totalReviews: toNumber(row.total_reviews),
      positivePct: toNumber(row.positive_pct),
      negativePct: toNumber(row.negative_pct),
      neutralPct: toNumber(row.neutral_pct),
      ...(lastYear === undefined ? {} : { overallSatisfaction100LastYear: lastYear }),
    };
  });
}

// The time series for one area/category across every available date. Selects only the
// columns the trend chart needs rather than the full row.
export async function getTrend(
  filters: Omit<RequiredSentimentFilters, "date">,
): Promise<SentimentTrendPoint[]> {
  const rows = await sql`
    select date::text as date, overall_satisfaction_100, avg_rating, positive_pct, negative_pct, neutral_pct, total_reviews
    from sentiment_suburbs
    where agg_type = ${filters.aggType}
      and area_name = ${filters.areaName}
      and category is not distinct from ${filters.category ?? null}
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
