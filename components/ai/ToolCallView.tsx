import type { UIMessage } from "ai";
import { Check, Loader2, TriangleAlert } from "lucide-react";

// One entry in the assistant's tool timeline. Each tool the model calls shows up as a collapsible
// row: a plain-language label and a status icon by default, expanding to the exact input it sent
// and the data it got back. This is what makes the assistant auditable, you can see every figure
// was read from a tool rather than invented.
//
// It takes any message part and renders nothing for non-tool parts (text, reasoning, step markers),
// so the caller can hand it every part without narrowing the union first.

type MessagePart = UIMessage["parts"][number];

// The tool-call fields we read, once a part is known to be a tool invocation at runtime.
type ToolShape = {
  type: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolName?: string;
};

function isToolPart(part: MessagePart): boolean {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

// Plain-language labels for each tool, so the timeline reads as actions rather than function names.
const TOOL_LABELS: Record<string, string> = {
  listSuburbs: "Looked up suburbs",
  suburbSentiment: "Read suburb sentiment",
  sentimentTrend: "Read the sentiment trend",
  sentimentDrivers: "Found the sentiment drivers",
  categoryBreakdown: "Broke down categories",
  compareSuburbs: "Compared suburbs",
  placesInSuburb: "Listed places",
  placeThemes: "Read a place's themes",
  reviewEvidence: "Pulled review quotes",
};

function toolNameOf(part: ToolShape): string {
  if (part.type === "dynamic-tool") return part.toolName ?? "tool";
  return part.type.replace(/^tool-/, "");
}

export function ToolCallView({ part }: { part: MessagePart }) {
  if (!isToolPart(part)) return null;
  // Safe after the runtime guard: the tool parts carry these fields, the union just does not narrow
  // on a startsWith check.
  const tool = part as ToolShape;
  const name = toolNameOf(tool);
  const label = TOOL_LABELS[name] ?? name;
  const state = tool.state ?? "input-available";
  const running = state === "input-streaming" || state === "input-available";
  const failed = state === "output-error";

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5">
        {failed ? (
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-rose-500" />
        ) : running ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        )}
        <span className="font-medium text-gray-700">{label}</span>
      </summary>
      <div className="space-y-2 border-t border-gray-200 px-2.5 py-2">
        {tool.input != null && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-gray-500">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        )}
        {failed && tool.errorText && <p className="text-rose-600">{tool.errorText}</p>}
        {tool.output != null && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-gray-500">
            {JSON.stringify(tool.output, null, 2)}
          </pre>
        )}
      </div>
    </details>
  );
}
