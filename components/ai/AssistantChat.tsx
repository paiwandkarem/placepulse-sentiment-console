"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";
import { ToolCallView } from "./ToolCallView";

// The shared assistant chat: message list, streaming tool timeline, and the composer. It is mounted
// in two places (the dashboard dock and the full-screen page), so it owns the conversation but not
// the chrome around it, the caller sizes it with className.
//
// useChat streams from /api/assistant over the transport below. There is no built-in input state in
// this version of the SDK, so the composer is a plain controlled textarea that calls sendMessage.

// One transport for the endpoint, created once rather than on every render.
const transport = new DefaultChatTransport({ api: "/api/assistant" });

const SUGGESTIONS = [
  "How satisfied are visitors with Brisbane City?",
  "What is driving negative reviews in Surfers Paradise?",
  "Compare Fortitude Valley and South Brisbane",
];

export function AssistantChat({ className }: { className?: string }) {
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Keep the latest content in view as it streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
                  className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] space-y-2",
                  message.role === "user"
                    ? "rounded-2xl bg-zinc-950 px-3.5 py-2 text-sm text-white"
                    : "text-sm text-gray-800",
                )}
              >
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <p key={index} className="whitespace-pre-wrap leading-relaxed">
                      {part.text}
                    </p>
                  ) : (
                    // Renders the tool timeline for tool parts and nothing for the rest.
                    <ToolCallView key={index} part={part} />
                  ),
                )}
              </div>
            </div>
          ))
        )}
        {status === "submitted" && <p className="text-xs text-gray-400">Thinking...</p>}
        {error && <p className="text-xs text-rose-600">Something went wrong. Please try again.</p>}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="border-t border-gray-200 p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-gray-400">
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
            placeholder="Ask about a suburb, theme, or place"
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Stop generating"
              className="rounded-lg bg-gray-200 p-1.5 text-gray-700 hover:bg-gray-300"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="rounded-lg bg-zinc-950 p-1.5 text-white disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
