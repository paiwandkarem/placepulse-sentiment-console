-- Where a thread started. Set to 'dock' for conversations that began in the dashboard copilot (saved
-- as listed threads automatically), so the thread list can mark them "From dashboard". Null for chats
-- that started on the assistant page itself.
alter table chat_sessions add column if not exists origin text;
