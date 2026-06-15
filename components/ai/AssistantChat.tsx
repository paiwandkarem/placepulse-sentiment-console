"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { track } from "@vercel/analytics";
import { ArrowUp, Loader2, Square, TriangleAlert } from "lucide-react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/ui/sentiment";
import type { ChatSurface } from "@/lib/assistant/sessions";
import { ToolResult } from "./ToolResult";

// The shared assistant chat: message list, streaming tool timeline, and the composer. It is mounted
// in two places (the dashboard dock and the full-screen page), so it owns the conversation but not
// the chrome around it, the caller sizes it with className.
//
// useChat streams from /api/assistant over the transport below. The transport carries the surface
// (page vs dock) so a turn persists to the right kind of session; the chat id (a thread) is sent
// automatically, so the page can resume a saved thread by passing its id and stored messages. There
// is no built-in input state in this SDK version, so the composer is a controlled textarea.

const SUGGESTIONS = [
  "How satisfied are visitors with Brisbane City?",
  "What is driving negative reviews in Surfers Paradise?",
  "Compare Fortitude Valley and South Brisbane",
];

// Best-effort detection of a rate-limit (429) error, so we can tell the user to wait and retry rather
// than show a generic failure. The exact error text depends on the transport, so we match loosely.
const isRateLimit = (error: Error): boolean => /too many|rate limit|slow down|429/i.test(error.message);

export function AssistantChat({
  className,
  id,
  initialMessages,
  surface = "assistant",
  contextFilters,
  persistKey,
  onMessagesChange,
  onFirstMessage,
  onFirstTurnComplete,
}: {
  className?: string;
  id?: string;
  initialMessages?: UIMessage[];
  surface?: ChatSurface;
  contextFilters?: { areaName?: string; category?: string };
  // When set, the chat self-manages a stable thread id and its message list in sessionStorage under
  // this key, so an in-progress conversation survives closing the panel or navigating to a place
  // detail and back instead of resetting each time it opens. The full-screen page does not pass this
  // — it resumes server-saved threads via id/initialMessages instead.
  persistKey?: string;
  // Notified with the current message count whenever it changes, so a host (the dock) can enable
  // actions like "open in assistant" only once there is a conversation to act on.
  onMessagesChange?: (count: number) => void;
  // Called with the user's first message the moment it is sent (the chat started empty), so the
  // assistant page can show the new thread in its list optimistically rather than after a refresh.
  onFirstMessage?: (text: string) => void;
  // Called once the first turn settles, with the question and the assistant's answer, so the page can
  // generate a readable title for the new thread.
  onFirstTurnComplete?: (question: string, answer: string) => void;
}) {
  // Resolve the persisted session once, on the client, from sessionStorage: an existing {id, messages}
  // if the user already has a conversation in this tab, otherwise a fresh id and empty history. The
  // dock panel only mounts after a click, so this never runs during SSR and cannot mismatch hydration.
  const [persisted] = useState<{ id: string; messages: UIMessage[] } | null>(() => {
    if (!persistKey || typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(persistKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; messages?: UIMessage[] };
        if (parsed.id) return { id: parsed.id, messages: parsed.messages ?? [] };
      }
    } catch {
      // Corrupt or unavailable storage falls through to a fresh session.
    }
    return { id: crypto.randomUUID(), messages: [] };
  });
  const effectiveId = id ?? persisted?.id;
  const effectiveInitialMessages = initialMessages ?? persisted?.messages;

  // One transport per surface, carrying the current dashboard selection when the dock provides it so
  // the model can ground an ambiguous question in the live view. Memoised on a stable key, since the
  // contextFilters object is a fresh reference each render.
  const contextKey = contextFilters ? JSON.stringify(contextFilters) : "";
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/assistant", body: { surface, filters: contextFilters } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface, contextKey],
  );
  // Only pass `id` when we actually have one. useChat recreates its underlying Chat on every render
  // whenever an `id` key is present but undefined, because the Chat it builds generates its own id
  // that never equals undefined. That recreation silently discards the streaming state, so nothing
  // renders live. A resumed thread passes a real id (stable, so no recreation); a fresh chat or the
  // dock passes none.
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat({
    ...(effectiveId ? { id: effectiveId } : {}),
    messages: effectiveInitialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Tool calls already applied to the dashboard, so a re-render does not navigate again.
  const appliedFilterRef = useRef<Set<string>>(new Set());
  // First-turn bookkeeping for the page's optimistic thread + title: set when the user sends into an
  // empty chat, cleared once the title hook has fired so it runs at most once per new conversation.
  const startedEmptyRef = useRef(false);
  const titleFiredRef = useRef(false);
  const busy = status === "submitted" || status === "streaming";

  // Keep the latest content in view as it streams in, but only when the user is already near the
  // bottom, so scrolling up to read earlier output is not yanked back down on every streamed token.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight });
  }, [messages, status]);

  // Mirror the conversation into sessionStorage once each turn settles, so reopening the dock (or
  // coming back from a place detail) restores it. Only settled states are written, which keeps this
  // off the per-token streaming path; the server still persists completed turns independently.
  useEffect(() => {
    if (!persistKey || !effectiveId || busy) return;
    try {
      window.sessionStorage.setItem(persistKey, JSON.stringify({ id: effectiveId, messages }));
    } catch {
      // Storage full or unavailable: persistence is best-effort, the live chat is unaffected.
    }
  }, [persistKey, effectiveId, messages, busy]);

  // Report the message count up to the host (the dock uses it to gate "open in assistant").
  useEffect(() => {
    onMessagesChange?.(messages.length);
  }, [messages.length, onMessagesChange]);

  // Once the first turn of a newly-started chat settles, hand the question and answer to the host so
  // it can generate a readable title. Fires at most once.
  useEffect(() => {
    if (!startedEmptyRef.current || titleFiredRef.current || status !== "ready") return;
    const textOf = (message: UIMessage) =>
      message.parts.map((part) => (part.type === "text" ? part.text : "")).join(" ").trim();
    const question = textOf(messages.find((message) => message.role === "user") ?? ({ parts: [] } as unknown as UIMessage));
    const answer = textOf([...messages].reverse().find((message) => message.role === "assistant") ?? ({ parts: [] } as unknown as UIMessage));
    if (question && answer) {
      titleFiredRef.current = true;
      onFirstTurnComplete?.(question, answer);
    }
  }, [status, messages, onFirstTurnComplete]);

  // When the model calls setDashboardFilter and it resolves, apply the action by navigating the URL
  // filter contract. From the dashboard dock this updates the page in place; from the full-screen
  // page it takes the user to the dashboard showing what they asked for.
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        const tool = part as { type: string; state?: string; toolCallId?: string; output?: unknown };
        if (tool.type !== "tool-setDashboardFilter" || tool.state !== "output-available") continue;
        const output = tool.output as { applied?: boolean; url?: string } | undefined;
        if (!tool.toolCallId || appliedFilterRef.current.has(tool.toolCallId)) continue;
        if (output?.applied && output.url) {
          appliedFilterRef.current.add(tool.toolCallId);
          track("assistant_drove_dashboard");
          router.replace(output.url);
        }
      }
    }
  }, [messages, router]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    clearError?.();
    track("assistant_message");
    // First message of an empty chat: tell the host so it can show the new thread immediately.
    if (messages.length === 0) {
      startedEmptyRef.current = true;
      onFirstMessage?.(trimmed);
    }
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Ask about Queensland suburb sentiment, the themes behind it, or specific places and
              their reviews. Answers come only from the data.
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              // User turns are short prompts: a right-aligned bubble, plain text.
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-gray-900 px-3.5 py-2 text-sm leading-relaxed text-white">
                  {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
                </div>
              </div>
            ) : (
              // Assistant turns run full width so markdown tables and lists have room. Text parts
              // render through Streamdown (GFM tables, code, hardened, streaming-aware); tool parts
              // render as the audit timeline.
              <div key={message.id} className="space-y-2">
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <Streamdown
                      key={index}
                      className="text-sm leading-relaxed text-gray-800 [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                    >
                      {part.text}
                    </Streamdown>
                  ) : (
                    <ToolResult key={index} part={part} />
                  ),
                )}
              </div>
            ),
          )
        )}
        {status === "submitted" && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" aria-hidden="true" />
            Thinking...
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              {isRateLimit(error)
                ? "You're sending messages too quickly. Wait a moment, then retry."
                : "Something went wrong generating a response."}
            </span>
            <button
              type="button"
              onClick={() => {
                clearError?.();
                regenerate();
              }}
              className="shrink-0 rounded-md bg-rose-100 px-2 py-1 font-semibold text-rose-700 hover:bg-rose-200"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="border-t border-gray-200 p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-100">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={1}
            aria-label="Ask the assistant a question"
            placeholder="Ask about a suburb, theme, or place"
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Stop generating"
              className="rounded-lg bg-gray-200 p-1.5 text-gray-700 hover:bg-gray-300"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="rounded-lg bg-gray-900 p-1.5 text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
