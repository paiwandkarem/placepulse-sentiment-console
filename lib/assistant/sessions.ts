import "server-only";
import type { UIMessage } from "ai";
import { sql } from "@/lib/db/client";

// Persistence for assistant conversations. One row per session in chat_sessions, the whole
// message list stored as jsonb so a conversation survives a reload and can later feed the briefs
// and evals features. The route handler writes a turn once it has finished (off the response path);
// the assistant page reads back the user's threads to resume them.

// Where a session lives: the full assistant page keeps a browsable history, the dashboard dock is
// contextual and never listed.
export type ChatSurface = "assistant" | "dock";

// A readable session title taken from the first thing the user asked, trimmed to fit a list row.
function deriveTitle(messages: UIMessage[]): string | null {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser) return null;
  const text = firstUser.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

export async function saveChatSession(input: {
  id: string;
  userId: string;
  surface: ChatSurface;
  messages: UIMessage[];
  filters?: unknown;
}): Promise<void> {
  const title = deriveTitle(input.messages);
  const messagesJson = JSON.stringify(input.messages);
  const filtersJson = input.filters ? JSON.stringify(input.filters) : null;

  // Upsert: the first turn creates the row and fixes the title; later turns of the same session
  // overwrite the message list and touch updated_at. The title is kept from the first turn, and
  // filters are only updated when the caller passes a fresh set.
  // user_id and surface are set on insert and left untouched on conflict: a session belongs to
  // whoever started it and never moves surface; later turns of the same id only refresh the
  // messages, title and filters.
  await sql`
    insert into chat_sessions (id, user_id, surface, title, filters, messages, updated_at)
    values (${input.id}, ${input.userId}, ${input.surface}, ${title}, ${filtersJson}::jsonb, ${messagesJson}::jsonb, now())
    on conflict (id) do update set
      messages = excluded.messages,
      title = coalesce(chat_sessions.title, excluded.title),
      filters = coalesce(excluded.filters, chat_sessions.filters),
      updated_at = now()
  `;
}

export type ChatThreadSummary = { id: string; title: string | null; updatedAt: string };

// The assistant page's thread list: a user's resumable conversations, most recent first. Scoped to
// the 'assistant' surface so the ephemeral dock chats never appear here.
export async function listThreads(userId: string, limit = 50): Promise<ChatThreadSummary[]> {
  const rows = (await sql`
    select id, title, updated_at
    from chat_sessions
    where user_id = ${userId} and surface = 'assistant'
    order by updated_at desc
    limit ${limit}
  `) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    title: (row.title as string | null) ?? null,
    updatedAt: String(row.updated_at),
  }));
}

export type ChatThread = {
  id: string;
  title: string | null;
  messages: UIMessage[];
  filters: unknown;
};

// The neon driver returns jsonb already parsed, but a defensive parse keeps this correct even if a
// row was ever written as a JSON string.
function coerceMessages(value: unknown): UIMessage[] {
  if (Array.isArray(value)) return value as UIMessage[];
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as UIMessage[];
    } catch {
      return [];
    }
  }
  return [];
}

// A single thread with its full message list, for hydrating useChat on resume. Scoped by user_id so
// a thread id alone can never read another user's conversation.
export async function getThread(id: string, userId: string): Promise<ChatThread | null> {
  const rows = (await sql`
    select id, title, messages, filters
    from chat_sessions
    where id = ${id} and user_id = ${userId}
    limit 1
  `) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    title: (row.title as string | null) ?? null,
    messages: coerceMessages(row.messages),
    filters: row.filters ?? null,
  };
}

export async function deleteThread(id: string, userId: string): Promise<void> {
  await sql`delete from chat_sessions where id = ${id} and user_id = ${userId}`;
}
