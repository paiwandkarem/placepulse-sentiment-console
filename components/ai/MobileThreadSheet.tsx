"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { ChatThreadSummary } from "@/lib/assistant/sessions";
import { ThreadList } from "./ThreadSidebar";

// Mobile fallback for the assistant's thread rail. The desktop sidebar is hidden below md, so this
// gives small screens a "Threads" button in the page header that opens the same conversation list
// (and "New chat") in a slide-over sheet. It is mobile-only (md:hidden); the desktop rail covers the
// rest. Picking a thread or starting a new chat closes the sheet via ThreadList's onNavigate.
export function MobileThreadSheet({
  threads,
  activeId,
}: {
  threads: ChatThreadSummary[];
  activeId?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open conversations"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
        Threads
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close conversations"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-gray-900/30"
          />
          <div
            role="dialog"
            aria-label="Conversations"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3">
              <p className="text-sm font-semibold text-gray-900">Conversations</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close conversations"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ThreadList threads={threads} activeId={activeId} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
