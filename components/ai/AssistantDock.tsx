"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Maximize2, Minimize2, RotateCcw, SquareArrowOutUpRight, X } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";
import { AssistantChat } from "./AssistantChat";

// sessionStorage key under which the dock keeps its in-progress conversation, so it survives closing
// the panel or navigating to a place detail. Per-tab and ephemeral by design: a new tab starts fresh
// and nothing leaks into the page's browsable thread list.
const DOCK_PERSIST_KEY = "placepulse:dock-chat";

// The dashboard copilot: a launcher pinned to the bottom-right that opens a chat panel over the
// page. It shares the same engine and components as the full-screen assistant; this is only the
// docked mount point. It sits below the map drawer (z-40 vs the drawer's z-50) so the two never
// compete for the right edge. Maximizing grows it to a tall, wide panel so wide markdown tables and
// longer answers have room to breathe.
//
// It is a non-modal dock (the dashboard stays usable beside it), so it does not trap focus. It does
// move focus into the panel on open and return it to the launcher on close, and Escape closes it.

// areaName/category are the dashboard's current selection, seeded into the dock so its answers
// reference the live view. The dock conversation persists in sessionStorage across navigation and is
// auto-saved as a listed assistant thread tagged "From dashboard" (origin = 'dock'), so it shows up
// on the /assistant page and can be reopened there via the header's "open in assistant" button.
export function AssistantDock({ areaName, category }: { areaName?: string; category?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  // Bumped to force a fresh AssistantChat (new thread id, empty history) when the user restarts.
  const [resetNonce, setResetNonce] = useState(0);
  // Live message count from the chat, so "open in assistant" only shows once there is a conversation.
  const [messageCount, setMessageCount] = useState(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  // Open the current dock conversation on the full assistant page. Dock turns are auto-saved as
  // listed threads (tagged "From dashboard"), so this is a plain navigation to the same thread id —
  // no promotion step needed. The dock keeps its in-tab copy; both point at the one thread.
  function openInAssistant() {
    let id: string | undefined;
    try {
      const raw = window.sessionStorage.getItem(DOCK_PERSIST_KEY);
      if (raw) id = (JSON.parse(raw) as { id?: string }).id;
    } catch {
      // ignore: handled by the guard below
    }
    if (!id) return;
    setOpen(false);
    router.push(`/assistant?thread=${id}`);
  }

  // Clear the persisted conversation and remount the chat fresh. Keeps the dock open so the user
  // lands on an empty composer rather than having the panel disappear under them.
  function restart() {
    try {
      window.sessionStorage.removeItem(DOCK_PERSIST_KEY);
    } catch {
      // Best-effort: if storage is unavailable the remount below still starts a clean chat.
    }
    setResetNonce((value) => value + 1);
    panelRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Assistant"
          tabIndex={-1}
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl outline-none",
            // On phones the dock is a near-full-screen sheet (a 24rem panel would be cramped); from sm
            // up it is the floating bottom-right panel, growing wider when maximized.
            maximized
              ? "inset-3 sm:inset-y-6 sm:left-auto sm:right-6 sm:w-[44rem] sm:max-w-[calc(100vw-3rem)]"
              : "inset-x-3 bottom-20 top-16 sm:inset-x-auto sm:left-auto sm:top-auto sm:bottom-24 sm:right-6 sm:h-[34rem] sm:max-h-[calc(100dvh-9rem)] sm:w-[24rem] sm:max-w-[calc(100vw-3rem)]",
          )}
        >
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">Assistant</p>
                <p className="text-xs text-gray-500">Answers read from Queensland review data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messageCount > 0 && (
                <button
                  type="button"
                  onClick={openInAssistant}
                  aria-label="Open this conversation in the full assistant"
                  title="Open in assistant"
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <SquareArrowOutUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={restart}
                aria-label="Start a new conversation"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setMaximized((value) => !value)}
                aria-label={maximized ? "Restore assistant size" : "Maximize assistant"}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                {maximized ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close assistant"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>
          <AssistantChat
            key={resetNonce}
            surface="dock"
            contextFilters={{ areaName, category }}
            persistKey={DOCK_PERSIST_KEY}
            onMessagesChange={setMessageCount}
            className="flex-1"
          />
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition hover:bg-gray-800"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Bot className="h-5 w-5" aria-hidden="true" />}
      </button>
    </>
  );
}
