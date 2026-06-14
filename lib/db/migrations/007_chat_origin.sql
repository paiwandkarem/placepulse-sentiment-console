-- Where a thread came from. Set to 'dock' when a contextual dashboard-dock conversation is promoted
-- to the full assistant page, so the thread list can mark it "From dashboard". Null for chats that
-- started on the assistant page itself.
alter table chat_sessions add column if not exists origin text;
