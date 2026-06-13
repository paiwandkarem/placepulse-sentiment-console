"use client";

import { useState } from "react";
import { Bot, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";
import { AssistantChat } from "./AssistantChat";

// The dashboard copilot: a launcher pinned to the bottom-right that opens a chat panel over the
// page. It shares the same engine and components as the full-screen assistant; this is only the
// docked mount point. It sits below the map drawer (z-40 vs the drawer's z-50) so the two never
// compete for the right edge. Maximizing grows it to a tall, wide panel so wide markdown tables and
// longer answers have room to breathe.

export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);

  return (
    <>
      {open && (
        <div
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl",
            maximized
              ? "inset-y-6 right-6 w-[44rem] max-w-[calc(100vw-3rem)]"
              : "bottom-24 right-6 h-[34rem] max-h-[calc(100dvh-9rem)] w-[24rem] max-w-[calc(100vw-3rem)]",
          )}
        >
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">Assistant</p>
                <p className="text-[11px] text-gray-500">Grounded in Queensland review data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMaximized((value) => !value)}
                aria-label={maximized ? "Restore assistant size" : "Maximize assistant"}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <AssistantChat className="flex-1" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition hover:bg-gray-800"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </>
  );
}
