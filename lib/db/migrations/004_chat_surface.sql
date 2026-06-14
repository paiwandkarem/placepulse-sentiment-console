-- Thread surfaces (W2.1). A chat session belongs to either the full assistant page ('assistant',
-- which keeps a browsable, resumable thread history) or the dashboard dock ('dock', contextual and
-- never listed). Existing rows default to 'assistant' so prior conversations remain reachable.
alter table chat_sessions add column if not exists surface text not null default 'assistant';
