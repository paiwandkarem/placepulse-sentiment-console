import { spawn, spawnSync } from "node:child_process";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";

// Offline bulk loader: streams the seven gzipped-CSV POI exports out of S3 and COPYs each part
// straight into its Neon landing table. Nothing is parsed in Node; the gunzipped CSV is piped
// directly into COPY FROM STDIN so Postgres does the parsing. That keeps memory flat and lets
// 27M rows land in minutes rather than hours of row-by-row inserts.
//
// Run after the Neon tier can hold the data:
//   tsx scripts/import-poi-data.ts                      full load, all seven datasets
//   tsx scripts/import-poi-data.ts --only=poi_reviews   one dataset
//   tsx scripts/import-poi-data.ts --limit=1            one part per dataset (smoke test)
//   tsx scripts/import-poi-data.ts --no-truncate        append instead of replacing
//   tsx scripts/import-poi-data.ts --skip-indexes       load only, build indexes later

const BUCKET = process.env.POI_S3_BUCKET ?? "pipeline-test-bucket-localis";
const ROOT = process.env.POI_S3_ROOT ?? "poi";

type Dataset = { table: string; prefix: string; columns: string[] };

// Column lists are the CSV header, in source order. COPY names them explicitly so the table's
// extra _ingested_at column (not in the CSV) keeps its default.
const DATASETS: Dataset[] = [
  {
    table: "poi_places",
    prefix: "poi_ready",
    columns: [
      "place_id", "url", "country", "name", "category", "address", "description",
      "business_details", "open_hours", "reviews_count", "rating", "main_image", "reviews",
      "lat", "lon", "services_provided", "hotel_amenities", "hotel_star_ratings", "open_website",
      "phone_number", "permanently_closed", "photos_and_videos", "people_also_search",
      "web_results", "reservation_link", "questions_answers", "top_reviews", "reviews_snippets",
      "directory_categories", "directory_locations", "popular_times", "cid_location",
      "is_claimed", "fid_location", "timestamp_raw", "review_distribution",
    ],
  },
  {
    table: "poi_place_suburb",
    prefix: "poi_ready_geo_suburb",
    columns: ["place_id", "lon", "lat", "suburb_name", "lga_name", "tourism_region_name", "state_name"],
  },
  {
    table: "poi_place_themes",
    prefix: "review_nlp_poi_themes",
    columns: [
      "run_id", "model_version", "place_id", "theme", "review_count", "review_share",
      "avg_sentiment_score", "avg_theme_similarity", "positive_count", "negative_count",
      "neutral_count", "mixed_count", "rank_in_poi", "processed_at",
    ],
  },
  {
    table: "poi_reviews",
    prefix: "poi_reviews",
    columns: [
      "place_id", "place_id_hex", "review_id", "rating", "review_text", "language", "created_at",
      "edited_at", "is_edited", "source", "source_icon_url", "share_url", "report_url",
      "reviewer_id", "reviewer_name", "reviewer_photo_url", "reviewer_profile_url",
      "reviewer_contributions_url", "reviewer_description", "reviewer_total_reviews",
      "reviewer_is_local_guide", "aspects", "scraped_at", "scrape_sort_order",
    ],
  },
  {
    table: "poi_review_scores",
    prefix: "review_nlp_scores",
    columns: [
      "run_id", "model_version", "review_id", "place_id", "rating", "created_at", "language",
      "input_hash", "rating_sentiment_score", "text_sentiment_score", "final_sentiment_score",
      "sentiment_100", "sentiment_label", "sentiment_confidence", "phrase_count",
      "top_phrases_json", "top_positive_phrases_json", "top_negative_phrases_json",
      "top_topics_json", "has_rating", "has_text_signal", "processed_at", "rating_text_diverges",
    ],
  },
  {
    table: "poi_theme_hits",
    prefix: "review_nlp_theme_hits",
    columns: [
      "run_id", "model_version", "review_id", "place_id", "created_at", "theme", "theme_rank",
      "theme_similarity", "final_sentiment_score", "sentiment_label", "processed_at",
    ],
  },
  {
    table: "poi_word_terms",
    prefix: "review_nlp_word_terms",
    columns: [
      "run_id", "model_version", "review_id", "place_id", "created_at", "sentiment_label",
      "term", "mentions", "term_rank",
    ],
  },
];

// PgBouncer transaction pooling on the -pooler endpoint does not support COPY FROM STDIN, so the
// loader talks to the direct endpoint. channel_binding is also dropped because node-postgres does
// not negotiate it the way the serverless HTTP driver does.
function directConnectionString(): string {
  const raw =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
  const url = new URL(raw);
  url.hostname = url.hostname.replace("-pooler.", ".");
  url.searchParams.delete("channel_binding");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

function listParts(prefix: string): string[] {
  const res = spawnSync("aws", ["s3", "ls", `s3://${BUCKET}/${ROOT}/${prefix}/`], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`aws s3 ls failed for ${prefix}: ${res.stderr}`);
  return res.stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/).pop() ?? "")
    .filter((key) => key.endsWith(".gz"))
    .sort()
    .map((key) => `${ROOT}/${prefix}/${key}`);
}

// Stream one part: aws s3 cp to stdout, gunzip, into COPY. pipeline resolves when COPY finishes;
// the separate close promise makes a non-zero aws exit fail the part rather than hang.
async function copyPart(client: Client, ds: Dataset, key: string): Promise<void> {
  const sql = `COPY ${ds.table} (${ds.columns.join(", ")}) FROM STDIN WITH (FORMAT csv, HEADER true)`;
  const dbStream = client.query(copyFrom(sql));
  const aws = spawn("aws", ["s3", "cp", `s3://${BUCKET}/${key}`, "-"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let awsErr = "";
  aws.stderr.on("data", (chunk) => {
    awsErr += chunk.toString();
  });
  const awsClosed = new Promise<void>((resolve, reject) => {
    aws.on("error", reject);
    aws.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`aws s3 cp exited ${code}: ${awsErr.slice(0, 300)}`)),
    );
  });
  await Promise.all([pipeline(aws.stdout, createGunzip(), dbStream), awsClosed]);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",");
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
  const noTruncate = args.includes("--no-truncate");
  const skipIndexes = args.includes("--skip-indexes") || limit > 0;

  const targets = only ? DATASETS.filter((d) => only.includes(d.table)) : DATASETS;
  if (only && targets.length === 0) throw new Error(`--only matched no datasets: ${only.join(",")}`);

  const client = new Client({ connectionString: directConnectionString(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  const jobId = randomUUID();
  await client.query(`insert into import_jobs (id, status, source_name) values ($1, 'running', $2)`, [
    jobId,
    `s3 poi load (${targets.map((t) => t.table).join(", ")})`,
  ]);

  let totalRows = 0;
  const startedAt = Date.now();
  try {
    // Idempotent: ensure the landing tables exist before loading.
    await client.query(readFileSync("lib/db/poi-schema.sql", "utf8"));

    for (const ds of targets) {
      const parts = listParts(ds.prefix);
      const slice = limit > 0 ? parts.slice(0, limit) : parts;
      if (!noTruncate) await client.query(`truncate table ${ds.table}`);

      let done = 0;
      for (const key of slice) {
        await copyPart(client, ds, key);
        done += 1;
        if (done % 8 === 0 || done === slice.length) {
          process.stdout.write(`\r${ds.table}: ${done}/${slice.length} parts`);
        }
      }

      const { rows } = await client.query<{ count: string }>(`select count(*)::bigint as count from ${ds.table}`);
      const count = Number(rows[0].count);
      totalRows += count;
      process.stdout.write(`\r${ds.table}: ${slice.length} parts loaded, ${count.toLocaleString()} rows\n`);
      await client.query(`update import_jobs set rows_processed = $1, updated_at = now() where id = $2`, [totalRows, jobId]);
    }

    if (!skipIndexes) {
      process.stdout.write(`Building indexes...`);
      await client.query(readFileSync("lib/db/poi-indexes.sql", "utf8"));
      process.stdout.write(` done\n`);
    }

    if (!limit) {
      // Both sentiment_suburbs and poi_place_suburb are present now, so build and refresh the
      // Queensland suburb reference that scopes the dashboard and assistant to QLD.
      process.stdout.write(`Refreshing qld_suburbs reference...`);
      await client.query(readFileSync("lib/db/qld-suburbs.sql", "utf8"));
      await client.query("refresh materialized view qld_suburbs");
      process.stdout.write(` done\n`);
    }

    await client.query(`update import_jobs set status = 'complete', rows_processed = $1, updated_at = now() where id = $2`, [totalRows, jobId]);
    const secs = Math.round((Date.now() - startedAt) / 1000);
    process.stdout.write(`\nLoad complete. ${totalRows.toLocaleString()} rows across ${targets.length} dataset(s) in ${secs}s.\n`);
  } catch (err) {
    const message = String((err as Error).message).slice(0, 500);
    await client
      .query(`update import_jobs set status = 'failed', error = $1, updated_at = now() where id = $2`, [message, jobId])
      .catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  process.exit(1);
});
