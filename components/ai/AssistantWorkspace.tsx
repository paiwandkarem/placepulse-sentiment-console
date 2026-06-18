"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { UIMessage } from "ai";
import { ThreadSidebar } from "./ThreadSidebar";
import { MobileThreadSheet } from "./MobileThreadSheet";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ChatThreadSummary } from "@/lib/assistant/sessions";

// Lazy-load the chat engine (the AI SDK, "ai", and the streamdown markdown renderer) so it stays out
// of this route's first-load JS, exactly as the dashboard dock does. The page header and thread rail
// paint immediately from server HTML; the heavy chat bundle streams in behind a matching-height
// fallback so the layout does not shift.
const AssistantChat = dynamic(() => import("./AssistantChat").then((m) => m.AssistantChat), {
  ssr: false,
  loading: () => <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading…</div>,
});

// The interactive shell for the assistant page. The page (a Server Component) loads the saved threads
// and the open conversation and hands them here with a stable chatId. This component owns the small
// client state that makes the thread rail feel live:
//   - a new conversation appears in the list the instant the first message is sent (optimistic),
//     rather than only after a navigation re-runs listThreads;
//   - once the first turn settles, an AI-generated title swaps in for the provisional first-question
//     title, in place.
// No URL rewrite happens while a new chat streams, so the chat never remounts mid-answer.

function provisionalTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

export function AssistantWorkspace({
  initialThreads,
  chatId,
  activeMessages,
}: {
  initialThreads: ChatThreadSummary[];
  chatId: string;
  activeMessages?: UIMessage[];
}) {
  // Threads started this session before the server list has caught up (it only refetches on
  // navigation), and AI-title overrides keyed by thread id.
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<ChatThreadSummary[]>([]);
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});

  const threads = useMemo(() => {
    const serverIds = new Set(initialThreads.map((thread) => thread.id));
    const extras = optimistic.filter((thread) => !serverIds.has(thread.id));
    // Drop any thread with no id and de-duplicate by id, so the rail never renders two items with the
    // same (or empty) React key even if a stale or empty session id slipped into the data.
    const seen = new Set<string>();
    return [...extras, ...initialThreads]
      .filter((thread) => {
        if (!thread.id || seen.has(thread.id)) return false;
        seen.add(thread.id);
        return true;
      })
      .map((thread) =>
        titleOverrides[thread.id] ? { ...thread, title: titleOverrides[thread.id] } : thread,
      );
  }, [initialThreads, optimistic, titleOverrides]);

  function handleFirstMessage(text: string) {
    setOptimistic((prev) =>
      prev.some((thread) => thread.id === chatId)
        ? prev
        : [
            { id: chatId, title: provisionalTitle(text), updatedAt: new Date().toISOString(), origin: null },
            ...prev,
          ],
    );
    // Pin the URL to this thread id. chatId is already this id, so the re-render does not change it
    // and the chat does not remount mid-stream — but it means a later "New chat" (-> /assistant) is a
    // real navigation, and a refresh resumes this conversation instead of starting a blank one.
    router.replace(`/assistant?thread=${chatId}`, { scroll: false });
  }

  async function handleFirstTurnComplete(question: string, answer: string) {
    try {
      const response = await fetch(`/api/assistant/threads/${chatId}/title`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (!response.ok) return;
      const { title } = (await response.json()) as { title?: string };
      if (title) setTitleOverrides((prev) => ({ ...prev, [chatId]: title }));
    } catch {
      // Best-effort: the provisional first-question title simply stays.
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-dvh">
      <ThreadSidebar threads={threads} activeId={chatId} />
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-gray-200 bg-white px-4 py-4 md:px-8">
          <div className="flex items-start justify-between gap-3">
            <PageHeader
              title="Assistant"
              subtitle="Ask about Queensland suburb sentiment, the themes behind it, or specific places and their reviews. Every answer is read from the data."
            />
            <MobileThreadSheet threads={threads} activeId={chatId} />
          </div>
        </header>
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          {/* Keyed by chatId so switching conversations (or starting a new one) cleanly re-initialises. */}
          <AssistantChat
            key={chatId}
            id={chatId}
            initialMessages={activeMessages}
            surface="assistant"
            onFirstMessage={handleFirstMessage}
            onFirstTurnComplete={handleFirstTurnComplete}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
