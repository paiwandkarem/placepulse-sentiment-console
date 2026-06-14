-- Brief types (W3.1). A brief is now one of a family (overview, comparison, category, momentum),
-- discriminated by this column. Existing rows default to 'overview' so they stay valid. The per-type
-- input params (one or more suburbs, an optional category) continue to live in the filters jsonb.
alter table brief_jobs add column if not exists type text not null default 'overview';
