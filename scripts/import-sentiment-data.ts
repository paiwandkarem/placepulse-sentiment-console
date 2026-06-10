import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { neon } from "@neondatabase/serverless";

// This is the offline loader that moves the sentiment export into Neon. The CSV/TSV is
// only ever an input here — at runtime the app reads from Postgres, never from a file.
// Like the migration runner, this runs under tsx, so it owns its own Neon client rather
// than importing the server-only lib/db/client.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
}

const sql = neon(databaseUrl);

type RawRow = Record<string, string | undefined>;

// Only the dimensions that identify a row are mandatory. Every metric is allowed to be
// missing or blank — real exports have gaps, and we'd rather load a partial row than drop
// it. Metric coercion below decides how each gap is represented in the column's type.
const requiredColumns = z.object({
  query_key: z.string().min(1),
  agg_type: z.string().min(1),
  date: z.string().min(1),
  area_name: z.string().min(1),
  category: z.string().min(1),
});

// Floating-point metrics keep NULL when absent so averages and percentages are honestly
// "unknown" rather than a misleading zero.
function numberOrNull(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Count columns are NOT NULL in the schema and are genuinely zero when absent, so a blank
// becomes 0 rather than NULL.
function integerOrZero(value: string | undefined): number {
  return Math.round(numberOrNull(value) ?? 0);
}

// The JSON columns (themes, word cloud, review evidence) arrive as embedded JSON strings.
// A malformed or empty cell falls back to a safe empty shape instead of failing the row.
function jsonOrFallback(value: string | undefined, fallback: unknown): unknown {
  if (!value || value.trim() === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// One export may be comma- or tab-delimited. We sniff for a tab anywhere in the file
// rather than relying on the extension, which is often wrong. csv-parse handles the rest
// (header row, BOM, quoted fields) — there is deliberately no handwritten parsing here.
function parseRows(filePath: string): RawRow[] {
  const contents = readFileSync(filePath, "utf8");
  const delimiter = contents.includes("\t") ? "\t" : ",";

  return parse(contents, {
    bom: true,
    columns: true,
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawRow[];
}

// Upsert keyed on query_key (unique in the schema) so re-running the import is idempotent:
// a second load of the same export updates in place instead of duplicating.
async function importRow(row: RawRow): Promise<void> {
  const identity = requiredColumns.parse(row);

  await sql`
    insert into sentiment_area_category_month (
      query_key, agg_type, date, area_name, category,
      poi_count, reviewed_poi_count, total_reviews, text_signal_reviews, theme_review_count,
      avg_rating, star_rating_sentiment_100, review_text_sentiment_100, overall_satisfaction_100,
      positive_reviews, negative_reviews, neutral_reviews, unknown_reviews,
      positive_pct, negative_pct, neutral_pct, unknown_pct,
      rating_text_conflict_count, rating_text_conflict_pct,
      review_coverage_pct, text_signal_coverage_pct, theme_coverage_pct,
      theme_cloud_json, theme_sentiment_json, word_cloud_json, top_reviews_json
    )
    values (
      ${identity.query_key}, ${identity.agg_type}, ${identity.date}, ${identity.area_name}, ${identity.category},
      ${integerOrZero(row.poi_count)}, ${integerOrZero(row.reviewed_poi_count)}, ${integerOrZero(row.total_reviews)}, ${integerOrZero(row.text_signal_reviews)}, ${integerOrZero(row.theme_review_count)},
      ${numberOrNull(row.avg_rating)}, ${numberOrNull(row.star_rating_sentiment_100)}, ${numberOrNull(row.review_text_sentiment_100)}, ${numberOrNull(row.overall_satisfaction_100)},
      ${integerOrZero(row.positive_reviews)}, ${integerOrZero(row.negative_reviews)}, ${integerOrZero(row.neutral_reviews)}, ${integerOrZero(row.unknown_reviews)},
      ${numberOrNull(row.positive_pct)}, ${numberOrNull(row.negative_pct)}, ${numberOrNull(row.neutral_pct)}, ${numberOrNull(row.unknown_pct)},
      ${integerOrZero(row.rating_text_conflict_count)}, ${numberOrNull(row.rating_text_conflict_pct)},
      ${numberOrNull(row.review_coverage_pct)}, ${numberOrNull(row.text_signal_coverage_pct)}, ${numberOrNull(row.theme_coverage_pct)},
      ${JSON.stringify(jsonOrFallback(row.theme_cloud_json, []))}::jsonb,
      ${JSON.stringify(jsonOrFallback(row.theme_sentiment_json, []))}::jsonb,
      ${JSON.stringify(jsonOrFallback(row.word_cloud_json, {}))}::jsonb,
      ${JSON.stringify(jsonOrFallback(row.top_reviews_json, {}))}::jsonb
    )
    on conflict (query_key)
    do update set
      agg_type = excluded.agg_type,
      date = excluded.date,
      area_name = excluded.area_name,
      category = excluded.category,
      poi_count = excluded.poi_count,
      reviewed_poi_count = excluded.reviewed_poi_count,
      total_reviews = excluded.total_reviews,
      text_signal_reviews = excluded.text_signal_reviews,
      theme_review_count = excluded.theme_review_count,
      avg_rating = excluded.avg_rating,
      star_rating_sentiment_100 = excluded.star_rating_sentiment_100,
      review_text_sentiment_100 = excluded.review_text_sentiment_100,
      overall_satisfaction_100 = excluded.overall_satisfaction_100,
      positive_reviews = excluded.positive_reviews,
      negative_reviews = excluded.negative_reviews,
      neutral_reviews = excluded.neutral_reviews,
      unknown_reviews = excluded.unknown_reviews,
      positive_pct = excluded.positive_pct,
      negative_pct = excluded.negative_pct,
      neutral_pct = excluded.neutral_pct,
      unknown_pct = excluded.unknown_pct,
      rating_text_conflict_count = excluded.rating_text_conflict_count,
      rating_text_conflict_pct = excluded.rating_text_conflict_pct,
      review_coverage_pct = excluded.review_coverage_pct,
      text_signal_coverage_pct = excluded.text_signal_coverage_pct,
      theme_coverage_pct = excluded.theme_coverage_pct,
      theme_cloud_json = excluded.theme_cloud_json,
      theme_sentiment_json = excluded.theme_sentiment_json,
      word_cloud_json = excluded.word_cloud_json,
      top_reviews_json = excluded.top_reviews_json,
      updated_at = now()
  `;
}

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error("Usage: npm run import:sentiment -- ./data/sentiment_full.csv");
  }

  // Record the run in import_jobs so a load is an auditable event, not a silent script.
  const importJobId = randomUUID();
  await sql`insert into import_jobs (id, status, source_name) values (${importJobId}, 'running', ${filePath})`;

  const rows = parseRows(filePath);
  let processed = 0;
  let failed = 0;

  // Rows are imported individually rather than in one batch so a single bad row is logged
  // and skipped instead of aborting the whole load. The dataset is small enough (area ×
  // category × month aggregates) that the per-row round trip is an acceptable trade for
  // that resilience.
  for (const row of rows) {
    try {
      await importRow(row);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed importing row", {
        queryKey: row.query_key,
        areaName: row.area_name,
        category: row.category,
        date: row.date,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await sql`
    update import_jobs
    set status = ${failed > 0 ? "completed_with_errors" : "completed"},
        rows_processed = ${processed},
        rows_failed = ${failed},
        updated_at = now()
    where id = ${importJobId}
  `;

  console.log(`Import complete. processed=${processed} failed=${failed}`);
}

main().catch((error: unknown) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
