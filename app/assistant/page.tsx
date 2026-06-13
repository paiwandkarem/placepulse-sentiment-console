import type { Metadata } from "next";
import { AssistantChat } from "@/components/ai/AssistantChat";

export const metadata: Metadata = {
  title: "Assistant | PlacePulse",
  description: "Ask grounded questions about Queensland suburb and place sentiment.",
};

// The dedicated assistant surface: the same engine as the dashboard dock, given the full height of
// the content area for deeper exploration. AssistantChat owns the conversation; this page only sizes
// it and adds the page heading. The conversation here is independent of the dock's.
export default function AssistantPage() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-4 md:px-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Assistant</h1>
        <p className="mt-0.5 text-sm font-semibold text-gray-600">
          Ask about Queensland suburb sentiment, the themes behind it, or specific places and their
          reviews. Every answer is read from the data.
        </p>
      </header>
      <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col">
        <AssistantChat className="flex-1" />
      </div>
    </div>
  );
}
