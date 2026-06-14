import "server-only";
import type { UIMessage } from "ai";
import { sql } from "@/lib/db/client";

// Persistence for assistant conversations. One row per session in chat_sessions, the whole
// message list stored as jsonb so a conversation survives a reload and can later feed the briefs
// and evals features. This is the only place that writes the table; the route handler calls it
// once a streamed turn has finished, off the response path.

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
  messages: UIMessage[];
  filters?: unknown;
}): Promise<void> {
  const title = deriveTitle(input.messages);
  const messagesJson = JSON.stringify(input.messages);
  const filtersJson = input.filters ? JSON.stringify(input.filters) : null;

  // Upsert: the first turn creates the row and fixes the title; later turns of the same session
  // overwrite the message list and touch updated_at. The title is kept from the first turn, and
  // filters are only updated when the caller passes a fresh set.
  // user_id is set on insert and left untouched on conflict: a session belongs to whoever started
  // it, and later turns of the same id only refresh the messages, title and filters.
  await sql`
    insert into chat_sessions (id, user_id, title, filters, messages, updated_at)
    values (${input.id}, ${input.userId}, ${title}, ${filtersJson}::jsonb, ${messagesJson}::jsonb, now())
    on conflict (id) do update set
      messages = excluded.messages,
      title = coalesce(chat_sessions.title, excluded.title),
      filters = coalesce(excluded.filters, chat_sessions.filters),
      updated_at = now()
  `;
}
