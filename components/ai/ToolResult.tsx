import type { UIMessage } from "ai";
import { ToolCallView } from "./ToolCallView";
import { renderToolCard } from "./ToolCards";

type MessagePart = UIMessage["parts"][number];

// One assistant tool invocation. Where a tool has a rich card (generative UI), it renders above the
// collapsible audit timeline; otherwise only the timeline shows. Keeping the timeline preserves the
// "every figure was read from a tool" guarantee even when a pretty card sits on top. Non-tool parts
// render nothing.
export function ToolResult({ part }: { part: MessagePart }) {
  const shape = part as { type: string; state?: string; output?: unknown };
  const isTool = shape.type === "dynamic-tool" || shape.type.startsWith("tool-");
  if (!isTool) return null;

  const name = shape.type === "dynamic-tool" ? "" : shape.type.replace(/^tool-/, "");
  const card = shape.state === "output-available" ? renderToolCard(name, shape.output) : null;

  if (!card) return <ToolCallView part={part} />;
  return (
    <div className="space-y-1.5">
      {card}
      <ToolCallView part={part} />
    </div>
  );
}
