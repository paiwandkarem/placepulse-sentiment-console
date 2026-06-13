"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { AssistantChat } from "./AssistantChat";

// The dashboard copilot: a launcher pinned to the bottom-right that opens a chat panel over the
// page. It shares the same engine and components as the full-screen assistant; this is only the
// docked mount point. It sits below the map drawer (z-40 vs the drawer's z-50) so the two never
// compete for the right edge.

export function AssistantDock() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[34rem] max-h-[calc(100dvh-9rem)] w-[24rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">Assistant</p>
                <p className="text-[11px] text-gray-500">Grounded in Queensland review data</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <AssistantChat className="flex-1" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-white shadow-lg transition hover:bg-zinc-800"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </>
  );
}
