-- Brief jobs can be exported to PDF and persisted in Vercel Blob. Record where the
-- artefact lives and when it was produced so the brief page can link to a stored copy
-- instead of regenerating on every request.
alter table brief_jobs
  add column if not exists pdf_blob_url text,
  add column if not exists pdf_generated_at timestamptz;

-- The brief list/status views read most-recent-first and filter by status (queued /
-- running / completed / failed), so index that access pattern directly.
create index if not exists idx_brief_jobs_status_created
  on brief_jobs (status, created_at desc);
