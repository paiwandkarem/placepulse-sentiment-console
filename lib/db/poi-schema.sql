-- QLD POI dataset: raw landing tables (a "bronze" layer).
--
-- These mirror the seven gzipped-CSV exports under s3://<your-poi-bucket>/poi/
-- column for column, in source order, so the bulk loader can COPY each part straight in
-- without reshaping. The data is Queensland only; the national sentiment_suburbs aggregate
-- stays the spine of the dashboard and these tables enrich the place level beneath it.
--
-- Typing rules for a robust bulk load of raw dumps:
--   - Clean scalars (ids, coordinates, scores, counts, flags, timestamps) get real types so
--     they are queryable and indexable. Empty CSV fields become NULL.
--   - JSON-shaped and free-text columns land as text, not jsonb, so a single malformed cell
--     cannot fail an entire COPY part. They are cast to jsonb at read time where needed.
--   - No primary keys or unique constraints: the source is a verbatim export and is not
--     guaranteed one row per natural key, so a unique build could reject otherwise good rows.
--
-- Every row carries _ingested_at for provenance. The loader names the source columns
-- explicitly in COPY, so this default column is populated without being present in the CSV.
--
-- Indexes are intentionally NOT defined here. They live in poi-indexes.sql and are built by
-- the loader after the data lands, because maintaining indexes during a 27M-row COPY is far
-- slower than building them once at the end.

-- poi_ready: one row per place. The heavy nested columns (reviews, photos_and_videos,
-- questions_answers, popular_times, ...) are kept verbatim as text for completeness.
create table if not exists poi_places (
  place_id text,
  url text,
  country text,
  name text,
  category text,
  address text,
  description text,
  business_details text,
  open_hours text,
  reviews_count integer,
  rating double precision,
  main_image text,
  reviews text,
  lat double precision,
  lon double precision,
  services_provided text,
  hotel_amenities text,
  hotel_star_ratings text,
  open_website text,
  phone_number text,
  permanently_closed boolean,
  photos_and_videos text,
  people_also_search text,
  web_results text,
  reservation_link text,
  questions_answers text,
  top_reviews text,
  reviews_snippets text,
  directory_categories text,
  directory_locations text,
  popular_times text,
  cid_location text,
  is_claimed boolean,
  fid_location text,
  timestamp_raw text,
  review_distribution text,
  _ingested_at timestamptz not null default now()
);

-- poi_ready_geo_suburb: place to suburb mapping. The join that ties a place to a suburb,
-- lga, tourism region and state.
create table if not exists poi_place_suburb (
  place_id text,
  lon double precision,
  lat double precision,
  suburb_name text,
  lga_name text,
  tourism_region_name text,
  state_name text,
  _ingested_at timestamptz not null default now()
);

-- review_nlp_poi_themes: per place, per theme rollup. The place level theme breakdown
-- (review_count, sentiment, positive/negative split, rank within the place).
create table if not exists poi_place_themes (
  run_id text,
  model_version text,
  place_id text,
  theme text,
  review_count integer,
  review_share double precision,
  avg_sentiment_score double precision,
  avg_theme_similarity double precision,
  positive_count integer,
  negative_count integer,
  neutral_count integer,
  mixed_count integer,
  rank_in_poi integer,
  processed_at timestamptz,
  _ingested_at timestamptz not null default now()
);

-- poi_reviews: one row per review. The actual review text, used as evidence quotes.
create table if not exists poi_reviews (
  place_id text,
  place_id_hex text,
  review_id text,
  rating double precision,
  review_text text,
  language text,
  created_at timestamptz,
  edited_at timestamptz,
  is_edited boolean,
  source text,
  source_icon_url text,
  share_url text,
  report_url text,
  reviewer_id text,
  reviewer_name text,
  reviewer_photo_url text,
  reviewer_profile_url text,
  reviewer_contributions_url text,
  reviewer_description text,
  reviewer_total_reviews integer,
  reviewer_is_local_guide boolean,
  aspects text,
  scraped_at timestamptz,
  scrape_sort_order text,
  _ingested_at timestamptz not null default now()
);

-- review_nlp_scores: one row per review. Per review sentiment scores, phrases and topics.
create table if not exists poi_review_scores (
  run_id text,
  model_version text,
  review_id text,
  place_id text,
  rating double precision,
  created_at timestamptz,
  language text,
  input_hash text,
  rating_sentiment_score double precision,
  text_sentiment_score double precision,
  final_sentiment_score double precision,
  sentiment_100 double precision,
  sentiment_label text,
  sentiment_confidence double precision,
  phrase_count integer,
  top_phrases_json text,
  top_positive_phrases_json text,
  top_negative_phrases_json text,
  top_topics_json text,
  has_rating boolean,
  has_text_signal boolean,
  processed_at timestamptz,
  rating_text_diverges boolean,
  _ingested_at timestamptz not null default now()
);

-- review_nlp_theme_hits: per review, per theme. The granular theme tags behind the rollup.
create table if not exists poi_theme_hits (
  run_id text,
  model_version text,
  review_id text,
  place_id text,
  created_at timestamptz,
  theme text,
  theme_rank integer,
  theme_similarity double precision,
  final_sentiment_score double precision,
  sentiment_label text,
  processed_at timestamptz,
  _ingested_at timestamptz not null default now()
);

-- review_nlp_word_terms: per review, per word term. The largest dataset, backs word clouds.
create table if not exists poi_word_terms (
  run_id text,
  model_version text,
  review_id text,
  place_id text,
  created_at timestamptz,
  sentiment_label text,
  term text,
  mentions integer,
  term_rank integer,
  _ingested_at timestamptz not null default now()
);
