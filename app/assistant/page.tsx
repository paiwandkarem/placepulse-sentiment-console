import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { AssistantChat } from "@/components/ai/AssistantChat";
import { ThreadSidebar } from "@/components/ai/ThreadSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { listThreads, getThread } from "@/lib/assistant/sessions";

export const metadata: Metadata = {
  title: "Assistant | PlacePulse",
  description: "Ask grounded questions about Queensland suburb and place sentiment.",
};

// Reads the signed-in user's threads and the open one, so it is always rendered fresh.
export const dynamic = "force-dynamic";

// The dedicated assistant surface: a thread list to resume past conversations, plus the same chat
// engine as the dashboard dock given the full height of the content area. Selecting a thread loads
// its stored messages and hydrates the chat by id; "New chat" mints a fresh one. The dock stays
// independent and ephemeral (see AssistantDock).
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadId } = await searchParams;
  const { userId } = await auth();
  const threads = userId ? await listThreads(userId) : [];
  const active = userId && threadId ? await getThread(threadId, userId) : null;

  return (
    <div className="flex h-dvh">
      <ThreadSidebar threads={threads} activeId={active?.id} />
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-gray-200 bg-white px-4 py-4 md:px-8">
          <PageHeader
            title="Assistant"
            subtitle="Ask about Queensland suburb sentiment, the themes behind it, or specific places and their reviews. Every answer is read from the data."
          />
        </header>
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          {/* Keyed by thread so switching conversations cleanly re-initialises the chat. */}
          <AssistantChat
            key={active?.id ?? "new"}
            id={active?.id}
            initialMessages={active?.messages}
            surface="assistant"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
