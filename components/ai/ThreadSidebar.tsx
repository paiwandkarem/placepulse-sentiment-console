"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";
import type { ChatThreadSummary } from "@/lib/assistant/sessions";

// The assistant page's conversation list: a "New chat" action and the user's saved threads, each a
// link that resumes it. Deleting a thread removes it and refreshes the list, leaving the current view
// if the open thread was the one deleted. The dock has no equivalent: its chats are ephemeral and
// never listed (they are stored under the 'dock' surface, which this list excludes).
export function ThreadSidebar({ threads, activeId }: { threads: ChatThreadSummary[]; activeId?: string }) {
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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="p-3">
        <Link
          href="/assistant"
          className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New chat
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label="Conversations">
        {threads.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">No conversations yet.</p>
        ) : (
          threads.map((thread) => {
            const active = thread.id === activeId;
            return (
              <div
                key={thread.id}
                className={cn("group flex items-center gap-1 rounded-lg px-2", active ? "bg-gray-100" : "hover:bg-gray-50")}
              >
                <Link
                  href={`/assistant?thread=${thread.id}`}
                  aria-current={active ? "page" : undefined}
                  className="min-w-0 flex-1 truncate py-2 text-sm text-gray-700"
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
    </aside>
  );
}
