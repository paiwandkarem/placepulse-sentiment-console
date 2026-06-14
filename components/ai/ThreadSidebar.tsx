"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessagesSquare, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";
import type { ChatThreadSummary } from "@/lib/assistant/sessions";

// The conversation list shared by the desktop sidebar and the mobile sheet: a "New chat" action and
// the user's saved threads, each a link that resumes it. Deleting a thread removes it and refreshes
// the list, leaving the current view if the open thread was the one deleted. The dock has no
// equivalent: its chats are ephemeral and never listed (they are stored under the 'dock' surface,
// which this list excludes).
//
// onNavigate lets the mobile sheet close itself when the user picks a thread or starts a new chat.
export function ThreadList({
  threads,
  activeId,
  onNavigate,
}: {
  threads: ChatThreadSummary[];
  activeId?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/assistant/threads/${id}`, { method: "DELETE" });
      if (id === activeId) router.push("/assistant");
      else router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="p-3">
        <Link
          href="/assistant"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New chat
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label="Conversations">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <MessagesSquare className="h-6 w-6 text-gray-300" aria-hidden="true" />
            <p className="text-xs font-medium text-gray-500">No conversations yet</p>
            <p className="text-[11px] text-gray-400">Ask a question to start your first chat.</p>
          </div>
        ) : (
          threads.map((thread) => {
            const active = thread.id === activeId;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl px-2",
                  active ? "border-l-2 border-emerald-600 bg-gray-100" : "hover:bg-gray-50",
                )}
              >
                <Link
                  href={`/assistant?thread=${thread.id}`}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-w-0 flex-1 truncate py-2 text-sm",
                    active ? "font-medium text-gray-900" : "text-gray-700",
                  )}
                  title={thread.title ?? "Untitled chat"}
                >
                  {thread.title ?? "Untitled chat"}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(thread.id)}
                  disabled={deleting === thread.id}
                  aria-label={`Delete conversation: ${thread.title ?? "Untitled chat"}`}
                  className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition hover:text-rose-600 group-hover:opacity-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </nav>
    </>
  );
}

// The desktop conversation rail: hidden on mobile, where the page header offers a "Threads" sheet
// instead (see MobileThreadSheet).
export function ThreadSidebar({ threads, activeId }: { threads: ChatThreadSummary[]; activeId?: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <ThreadList threads={threads} activeId={activeId} />
    </aside>
  );
}
