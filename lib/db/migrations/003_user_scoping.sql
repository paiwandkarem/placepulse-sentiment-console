-- Per-user scoping for the AI write tables (W1.3). user_id holds Clerk's user id (text, nullable so
-- rows created before auth stay valid). The indexes back the per-user list and read queries, which
-- filter by user_id first, so they stay index seeks rather than scans.
-- Note: the migration runner splits on the semicolon, so comments here must not contain one.
alter table brief_jobs add column if not exists user_id text;
alter table chat_sessions add column if not exists user_id text;

create index if not exists ix_brief_jobs_user on brief_jobs (user_id, created_at desc);
create index if not exists ix_chat_sessions_user on chat_sessions (user_id, updated_at desc);
