create table if not exists sentiment_area_category_month (
  id bigserial primary key,
  query_key text not null unique,
  agg_type text not null,
  date date not null,
  area_name text not null,
  category text not null,
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

create index if not exists idx_sentiment_area_category_date on sentiment_area_category_month (area_name, category, date desc);
create index if not exists idx_sentiment_category_date on sentiment_area_category_month (category, date desc);
create index if not exists idx_sentiment_area_date on sentiment_area_category_month (area_name, date desc);
create index if not exists idx_sentiment_agg_date on sentiment_area_category_month (agg_type, date desc);

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