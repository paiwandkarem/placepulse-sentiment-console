-- Indexes for the QLD POI tables, built by the loader AFTER the data lands.
--
-- Kept out of poi-schema.sql on purpose: maintaining these during a 27M-row COPY would
-- dominate the load time. Building them once, after, is far faster. All are non-unique
-- (the raw export is not guaranteed one row per key) and created if not exists so a rerun
-- is a no-op.
--
-- The access patterns they serve:
--   - join a place to its suburb, themes, reviews and scores by place_id
--   - join a review to its scores, theme hits and word terms by review_id
--   - filter the place layer by suburb, and theme views by theme
--   - order reviews by recency

-- Places and the place to suburb join.
create index if not exists ix_poi_places_place on poi_places (place_id);
create index if not exists ix_poi_place_suburb_place on poi_place_suburb (place_id);
create index if not exists ix_poi_place_suburb_suburb on poi_place_suburb (suburb_name);

-- Per place theme rollup: lookups by place and by theme.
create index if not exists ix_poi_place_themes_place on poi_place_themes (place_id);
create index if not exists ix_poi_place_themes_theme on poi_place_themes (theme);

-- Reviews: by place, by review id, and by recency for newest-first evidence.
create index if not exists ix_poi_reviews_place on poi_reviews (place_id);
create index if not exists ix_poi_reviews_review on poi_reviews (review_id);
create index if not exists ix_poi_reviews_created on poi_reviews (created_at);

-- Per review scores: by review id (join to reviews), by place, and by label for buckets.
create index if not exists ix_poi_review_scores_review on poi_review_scores (review_id);
create index if not exists ix_poi_review_scores_place on poi_review_scores (place_id);
create index if not exists ix_poi_review_scores_label on poi_review_scores (sentiment_label);

-- Per review theme hits: by review, place and theme.
create index if not exists ix_poi_theme_hits_review on poi_theme_hits (review_id);
create index if not exists ix_poi_theme_hits_place on poi_theme_hits (place_id);
create index if not exists ix_poi_theme_hits_theme on poi_theme_hits (theme);

-- Word terms: by place and by term for word clouds.
create index if not exists ix_poi_word_terms_place on poi_word_terms (place_id);
create index if not exists ix_poi_word_terms_term on poi_word_terms (term);
