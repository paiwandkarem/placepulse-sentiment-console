"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { track } from "@vercel/analytics";
import { ArrowUp, Square } from "lucide-react";
import { Streamdown } from "streamdown";
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
  const router = useRouter();
  // Tool calls already applied to the dashboard, so a re-render does not navigate again.
  const appliedFilterRef = useRef<Set<string>>(new Set());
  const busy = status === "submitted" || status === "streaming";

  // Keep the latest content in view as it streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

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
    track("assistant_message");
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
          messages.map((message) =>
            message.role === "user" ? (
              // User turns are short prompts: a right-aligned bubble, plain text.
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-zinc-950 px-3.5 py-2 text-sm leading-relaxed text-white">
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
                    <Streamdown key={index} className="text-sm leading-relaxed text-gray-800">
                      {part.text}
                    </Streamdown>
                  ) : (
                    <ToolCallView key={index} part={part} />
                  ),
                )}
              </div>
            ),
          )
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
