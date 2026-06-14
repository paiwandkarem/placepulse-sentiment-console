create table if not exists sentiment_suburbs (
  id bigserial primary key,
  -- query_key identifies the agg_type + area, but NOT the category. One suburb/period has a
  -- row per category under the same key, so it is intentionally not unique on its own.
  query_key text not null,
  agg_type text not null,
  date date not null,
  area_name text not null,
  -- Nullable: suburb-level overall rows (the *_suburb agg types) carry no category, so the
  -- repository matches with "category is not distinct from ?" to treat NULL as a value.
  category text,
  poi_count integer not null default 0,
  reviewed_poi_count integer not null default 0,
  total_reviews integer not null default 0,
  text_signal_reviews integer not null default 0,
  theme_review_count integer not null default 0,
  avg_rating double precision,
  star_rating_sentiment_100 double precision,
  review_text_sentiment_100 double precision,
  overall_satisfaction_100 double precision,
  positive_reviews integer not null default 0,
  negative_reviews integer not null default 0,
  neutral_reviews integer not null default 0,
  unknown_reviews integer not null default 0,
  positive_pct double precision,
  negative_pct double precision,
  neutral_pct double precision,
  unknown_pct double precision,
  one_star_reviews integer,
  two_star_reviews integer,
  three_star_reviews integer,
  four_star_reviews integer,
  five_star_reviews integer,
  unrated_reviews integer,
  one_star_pct double precision,
  two_star_pct double precision,
  three_star_pct double precision,
  four_star_pct double precision,
  five_star_pct double precision,
  unrated_pct double precision,
  rating_text_conflict_count integer not null default 0,
  rating_text_conflict_pct double precision,
  review_coverage_pct double precision,
  text_signal_coverage_pct double precision,
  theme_coverage_pct double precision,
  theme_cloud_json jsonb not null default '[]'::jsonb,
  theme_sentiment_json jsonb not null default '[]'::jsonb,
  word_cloud_json jsonb not null default '{}'::jsonb,
  top_reviews_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The natural grain of a row (agg_type, area_name, category, date). It is UNIQUE so each grain holds
-- exactly one row and the import upserts instead of duplicating, and it serves getRecord (exact
-- match), getTrend and getThemes (prefix match) as an index lookup rather than a scan. The unique
-- index (ux_ss_grain, NULLS NOT DISTINCT so the NULL-category overall rows dedup too) is created in
-- migration 006_dedupe_sentiment_grain.sql, not here, because building it needs a one-time dedup of
-- the existing data and the migration runner applies this base schema before any migration.

-- Single-column indexes backing the filter catalogue. listFilters reads the distinct values of
-- each dimension with a recursive "loose index scan" (jump to the next value greater than the
-- last), which costs one index descent per option instead of a full scan of every row. At a few
-- million rows that is the difference between ~250 ms and ~10 s on a cold page load. agg_type is
-- already covered by ix_ss_grain's leading column. Categories skip the suburb-level nulls.
create index if not exists ix_ss_area on sentiment_suburbs (area_name);
create index if not exists ix_ss_category on sentiment_suburbs (category) where category is not null;
create index if not exists ix_ss_date on sentiment_suburbs (date);

-- Backs getDefaultSlice: the opening view picks the most-reviewed overall (mthly_suburb) slice.
-- Leading with agg_type lets that query be an index range seek returning the single top row, and
-- the ordering (desc nulls last) must match the query exactly or the planner falls back to a sort.
create index if not exists ix_ss_agg_reviews
  on sentiment_suburbs (agg_type, total_reviews desc nulls last);

-- Backs getCategoryBreakdown: every category's score for one suburb at one month, ordered by
-- review volume. ix_ss_grain puts date after category, so it cannot serve this filter+sort; this
-- composite leads (agg_type, area_name, date) and carries total_reviews so the rows come back
-- pre-ordered. Partial on the per-category rows it actually reads.
create index if not exists ix_ss_area_date_reviews
  on sentiment_suburbs (agg_type, area_name, date, total_reviews desc nulls last) where category is not null;

create table if not exists brief_jobs (
  id text primary key,
  status text not null,
  title text not null,
  filters jsonb not null,
  content text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_sessions (
  id text primary key,
  title text,
  filters jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eval_runs (
  id text primary key,
  status text not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists import_jobs (
  id text primary key,
  status text not null,
  source_name text,
  rows_processed integer not null default 0,
  rows_failed integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigserial primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);