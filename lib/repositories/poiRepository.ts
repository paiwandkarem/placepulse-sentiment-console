import "server-only";
import { sql } from "@/lib/db/client";

// Data access for the Queensland place-level tables loaded from the POI export. Mirrors the
// sentiment repository's contract: this is the only place that talks SQL to the poi_* tables,
// and it returns camelCase domain objects rather than raw rows. The national suburb aggregate
// lives in sentimentRepository; this layer is the QLD place-level detail beneath it.

type DbRow = Record<string, unknown>;

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// The pipeline scores sentiment in [-1, 1]. The rest of the app speaks the 0 to 100 scale the
// aggregate uses, so convert with the same (s + 1) * 50 formula the source applies.
function toSentiment100(value: unknown): number {
  return Math.round((toNumber(value) + 1) * 50 * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type PoiPlace = {
  placeId: string;
  name: string;
  category: string;
  suburb: string;
  address: string;
  rating: number;
  reviewsCount: number;
  lat: number;
  lon: number;
};

function mapPlace(row: DbRow): PoiPlace {
  return {
    placeId: String(row.place_id ?? ""),
    name: String(row.name ?? ""),
    category: String(row.category ?? ""),
    suburb: String(row.suburb_name ?? ""),
    address: String(row.address ?? ""),
    rating: toNumber(row.rating),
    reviewsCount: toNumber(row.reviews_count),
    lat: toNumber(row.lat),
    lon: toNumber(row.lon),
  };
}

// The most reviewed (or highest rated) places in a QLD suburb. Open places only, so closed
// venues do not crowd out live ones.
export async function placesInSuburb(
  suburb: string,
  opts: { limit?: number; sort?: "reviews" | "rating" } = {},
): Promise<PoiPlace[]> {
  const limit = clamp(opts.limit ?? 10, 1, 50);
  const order =
    opts.sort === "rating"
      ? "p.rating desc nulls last, p.reviews_count desc nulls last"
      : "p.reviews_count desc nulls last";
  const rows = (await sql.query(
    `select p.place_id, p.name, p.category, s.suburb_name, p.address, p.rating, p.reviews_count, p.lat, p.lon
       from poi_places p
       join poi_place_suburb s on s.place_id = p.place_id
      where lower(s.suburb_name) = lower($1)
        and coalesce(p.permanently_closed, false) = false
      order by ${order}
      limit $2`,
    [suburb, limit],
  )) as DbRow[];
  return rows.map(mapPlace);
}

export type PoiPlaceDetail = PoiPlace & {
  description: string;
  isClaimed: boolean;
  permanentlyClosed: boolean;
};

// One place by its Google place_id, with the suburb joined in.
export async function placeDetail(placeId: string): Promise<PoiPlaceDetail | null> {
  const rows = (await sql.query(
    `select p.place_id, p.name, p.category, s.suburb_name, p.address, p.rating, p.reviews_count, p.lat, p.lon,
            p.description, p.is_claimed, p.permanently_closed
       from poi_places p
       left join poi_place_suburb s on s.place_id = p.place_id
      where p.place_id = $1
      limit 1`,
    [placeId],
  )) as DbRow[];
  if (!rows.length) return null;
  const row = rows[0];
  return {
    ...mapPlace(row),
    description: String(row.description ?? ""),
    isClaimed: row.is_claimed === true,
    permanentlyClosed: row.permanently_closed === true,
  };
}

export type PoiPlaceTheme = {
  theme: string;
  reviewCount: number;
  avgSentiment100: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  rankInPoi: number;
};

// The theme breakdown for one place, ordered by the place-level rank the pipeline assigned.
export async function placeThemes(placeId: string, limit = 10): Promise<PoiPlaceTheme[]> {
  const rows = (await sql.query(
    `select theme, review_count, avg_sentiment_score, positive_count, negative_count, neutral_count, rank_in_poi
       from poi_place_themes
      where place_id = $1
      order by rank_in_poi asc nulls last
      limit $2`,
    [placeId, clamp(limit, 1, 25)],
  )) as DbRow[];
  return rows.map((row) => ({
    theme: String(row.theme ?? ""),
    reviewCount: toNumber(row.review_count),
    avgSentiment100: toSentiment100(row.avg_sentiment_score),
    positiveCount: toNumber(row.positive_count),
    negativeCount: toNumber(row.negative_count),
    neutralCount: toNumber(row.neutral_count),
    rankInPoi: toNumber(row.rank_in_poi),
  }));
}

export type PoiReviewQuote = {
  text: string;
  rating: number;
  sentiment: string;
  sentiment100: number;
  date?: string;
  placeId: string;
  placeName: string;
};

// Real review quotes (QLD), the evidence behind a sentiment claim. Filterable by place, suburb
// and sentiment. For a requested sentiment the most extreme score leads; otherwise newest first.
export async function reviewEvidence(opts: {
  placeId?: string;
  suburb?: string;
  sentiment?: "positive" | "negative" | "neutral";
  limit?: number;
}): Promise<PoiReviewQuote[]> {
  const limit = clamp(opts.limit ?? 5, 1, 20);
  const where: string[] = ["length(trim(r.review_text)) >= 12"];
  const params: unknown[] = [];

  if (opts.placeId) {
    params.push(opts.placeId);
    where.push(`r.place_id = $${params.length}`);
  }
  if (opts.suburb) {
    params.push(opts.suburb);
    where.push(`lower(s.suburb_name) = lower($${params.length})`);
  }
  if (opts.sentiment) {
    params.push(opts.sentiment);
    where.push(`sc.sentiment_label = $${params.length}`);
  }
  params.push(limit);

  const joinSuburb = opts.suburb ? "join poi_place_suburb s on s.place_id = r.place_id" : "";
  const order =
    opts.sentiment === "negative"
      ? "sc.sentiment_100 asc nulls last"
      : opts.sentiment === "positive"
        ? "sc.sentiment_100 desc nulls last"
        : "r.created_at desc nulls last";

  const rows = (await sql.query(
    `select r.review_text, r.rating, sc.sentiment_label, sc.sentiment_100, r.created_at, r.place_id, p.name as place_name
       from poi_reviews r
       join poi_review_scores sc on sc.review_id = r.review_id
       ${joinSuburb}
       join poi_places p on p.place_id = r.place_id
      where ${where.join(" and ")}
      order by ${order}
      limit $${params.length}`,
    params,
  )) as DbRow[];

  return rows.map((row) => ({
    text: String(row.review_text ?? "").trim(),
    rating: toNumber(row.rating),
    sentiment: String(row.sentiment_label ?? "neutral"),
    sentiment100: toNumber(row.sentiment_100),
    date: toDateString(row.created_at),
    placeId: String(row.place_id ?? ""),
    placeName: String(row.place_name ?? ""),
  }));
}
