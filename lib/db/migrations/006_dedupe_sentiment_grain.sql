-- Deduplicate sentiment_suburbs and enforce one row per natural grain.
--
-- Repeated imports triple-loaded the table: the import upserts ON CONFLICT
-- (agg_type, area_name, category, date), but no unique index ever existed to match that target, so
-- every row was inserted afresh. Overall rows (the *_suburb agg types) carry a NULL category, which
-- a standard unique index treats as distinct, so they would escape dedup even once an index existed.
--
-- This migration keeps the most recently written row for each grain and drops the rest, then adds a
-- unique index with NULLS NOT DISTINCT so the NULL-category overall rows collide and dedup too, and
-- so the import's ON CONFLICT finally has a target. Idempotent: a re-run deletes nothing and the
-- index already exists.

delete from sentiment_suburbs s
using (
  select
    id,
    row_number() over (
      partition by agg_type, area_name, category, date
      order by updated_at desc, id desc
    ) as rn
  from sentiment_suburbs
) ranked
where s.id = ranked.id and ranked.rn > 1;

create unique index if not exists ux_ss_grain
  on sentiment_suburbs (agg_type, area_name, category, date) nulls not distinct;

-- The old non-unique grain index is superseded by ux_ss_grain (same leading columns).
drop index if exists ix_ss_grain;
