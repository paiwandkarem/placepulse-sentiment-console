-- Queensland suburb reference.
--
-- The place data is Queensland only, so the dashboard and assistant are scoped to match. This
-- materialised view is the set of suburbs that both have sentiment data (sentiment_suburbs) and
-- map to Queensland through the POI geo table (poi_place_suburb). Roughly 2,863 suburbs.
--
-- Materialised rather than a plain view so the filter catalogue reads it cheaply on every cold
-- load instead of paying a distinct-over-millions each time. It is static between imports; after a
-- re-import of either source, refresh it with:
--   refresh materialized view qld_suburbs;
create materialized view if not exists qld_suburbs as
select distinct ss.area_name as name
from sentiment_suburbs ss
where exists (
  select 1
  from poi_place_suburb p
  where lower(p.suburb_name) = lower(ss.area_name)
);

create index if not exists ix_qld_suburbs_name on qld_suburbs (name);
