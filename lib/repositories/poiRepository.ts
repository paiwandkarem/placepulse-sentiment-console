import "server-only";
import { sql } from "@/lib/db/client";
import { humaniseTheme } from "@/lib/sentiment/themeBuckets";

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
    theme: humaniseTheme(String(row.theme ?? "")),
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

// ---- Places explorer (P1): directory search and place profile data access ----

export type PlaceSearchResult = { places: PoiPlace[]; total: number; page: number; pageSize: number };

// Paginated directory search over open QLD places. Name match, suburb and category are optional and
// combine. Name search uses ilike, which scans rather than using an index, so callers should usually
// narrow by suburb or category first; the page size is capped to keep each request bounded.
export async function searchPlaces(opts: {
  query?: string;
  suburb?: string;
  category?: string;
  sort?: "reviews" | "rating";
  page?: number;
  pageSize?: number;
}): Promise<PlaceSearchResult> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = clamp(opts.pageSize ?? 24, 1, 60);
  const offset = (page - 1) * pageSize;

  const where: string[] = ["coalesce(p.permanently_closed, false) = false"];
  const params: unknown[] = [];
  if (opts.query && opts.query.trim().length >= 2) {
    params.push(`%${opts.query.trim()}%`);
    where.push(`p.name ilike $${params.length}`);
  }
  if (opts.suburb) {
    params.push(opts.suburb);
    where.push(`lower(s.suburb_name) = lower($${params.length})`);
  }
  if (opts.category) {
    params.push(opts.category);
    where.push(`lower(p.category) = lower($${params.length})`);
  }
  const whereSql = where.join(" and ");
  const order =
    opts.sort === "rating"
      ? "p.rating desc nulls last, p.reviews_count desc nulls last"
      : "p.reviews_count desc nulls last";

  const rows = (await sql.query(
    `select p.place_id, p.name, p.category, s.suburb_name, p.address, p.rating, p.reviews_count, p.lat, p.lon
       from poi_places p
       join poi_place_suburb s on s.place_id = p.place_id
      where ${whereSql}
      order by ${order}
      limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, offset],
  )) as DbRow[];

  const countRows = (await sql.query(
    `select count(*)::int as total
       from poi_places p
       join poi_place_suburb s on s.place_id = p.place_id
      where ${whereSql}`,
    params,
  )) as DbRow[];

  return { places: rows.map(mapPlace), total: toNumber(countRows[0]?.total), page, pageSize };
}

export type PlaceReview = { text: string; rating: number; sentiment: string; sentiment100: number; date?: string };
export type PlaceReviewPage = { reviews: PlaceReview[]; total: number; page: number; pageSize: number };

// One place's reviews, paginated and optionally filtered by sentiment, newest first.
export async function placeReviews(
  placeId: string,
  opts: { page?: number; pageSize?: number; sentiment?: "positive" | "negative" | "neutral" } = {},
): Promise<PlaceReviewPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = clamp(opts.pageSize ?? 10, 1, 50);
  const offset = (page - 1) * pageSize;

  const where: string[] = ["r.place_id = $1", "length(trim(r.review_text)) >= 1"];
  const params: unknown[] = [placeId];
  if (opts.sentiment) {
    params.push(opts.sentiment);
    where.push(`sc.sentiment_label = $${params.length}`);
  }
  const whereSql = where.join(" and ");

  const rows = (await sql.query(
    `select r.review_text, r.rating, sc.sentiment_label, sc.sentiment_100, r.created_at
       from poi_reviews r
       join poi_review_scores sc on sc.review_id = r.review_id
      where ${whereSql}
      order by r.created_at desc nulls last
      limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, offset],
  )) as DbRow[];

  const countRows = (await sql.query(
    `select count(*)::int as total
       from poi_reviews r
       join poi_review_scores sc on sc.review_id = r.review_id
      where ${whereSql}`,
    params,
  )) as DbRow[];

  return {
    reviews: rows.map((row) => ({
      text: String(row.review_text ?? "").trim(),
      rating: toNumber(row.rating),
      sentiment: String(row.sentiment_label ?? "neutral"),
      sentiment100: toNumber(row.sentiment_100),
      date: toDateString(row.created_at),
    })),
    total: toNumber(countRows[0]?.total),
    page,
    pageSize,
  };
}

export type PlaceWordTerm = { term: string; mentions: number; sentiment: string };

// A place's most mentioned terms, summed across its reviews and grouped by sentiment.
export async function placeWordTerms(placeId: string, limit = 30): Promise<PlaceWordTerm[]> {
  const rows = (await sql.query(
    `select term, sentiment_label, sum(mentions)::int as mentions
       from poi_word_terms
      where place_id = $1 and term is not null
      group by term, sentiment_label
      order by mentions desc nulls last
      limit $2`,
    [placeId, clamp(limit, 1, 100)],
  )) as DbRow[];
  return rows.map((row) => ({
    term: String(row.term ?? ""),
    mentions: toNumber(row.mentions),
    sentiment: String(row.sentiment_label ?? "neutral"),
  }));
}

export type PlacePoint = { placeId: string; name: string; lat: number; lon: number; rating: number };

// Map points for the directory's filters: places with coordinates, capped, most reviewed first. The
// cap keeps the payload to the client bounded; the map clusters them, so a few hundred reads well.
export async function placePoints(
  opts: { query?: string; suburb?: string; category?: string },
  limit = 500,
): Promise<PlacePoint[]> {
  const where: string[] = [
    "coalesce(p.permanently_closed, false) = false",
    "p.lat is not null",
    "p.lon is not null",
  ];
  const params: unknown[] = [];
  if (opts.query && opts.query.trim().length >= 2) {
    params.push(`%${opts.query.trim()}%`);
    where.push(`p.name ilike $${params.length}`);
  }
  if (opts.suburb) {
    params.push(opts.suburb);
    where.push(`lower(s.suburb_name) = lower($${params.length})`);
  }
  if (opts.category) {
    params.push(opts.category);
    where.push(`lower(p.category) = lower($${params.length})`);
  }
  params.push(clamp(limit, 1, 1000));

  const rows = (await sql.query(
    `select p.place_id, p.name, p.lat, p.lon, p.rating
       from poi_places p
       join poi_place_suburb s on s.place_id = p.place_id
      where ${where.join(" and ")}
      order by p.reviews_count desc nulls last
      limit $${params.length}`,
    params,
  )) as DbRow[];

  return rows.map((row) => ({
    placeId: String(row.place_id ?? ""),
    name: String(row.name ?? ""),
    lat: toNumber(row.lat),
    lon: toNumber(row.lon),
    rating: toNumber(row.rating),
  }));
}

// The most common place categories (by open-place count), for the directory's category filter.
export async function listPlaceCategories(limit = 60): Promise<string[]> {
  const rows = (await sql.query(
    `select category, count(*)::int as n
       from poi_places
      where category is not null and coalesce(permanently_closed, false) = false
      group by category
      order by n desc
      limit $1`,
    [clamp(limit, 1, 200)],
  )) as DbRow[];
  return rows.map((row) => String(row.category ?? "")).filter(Boolean);
}
