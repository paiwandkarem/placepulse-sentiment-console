import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { AssistantWorkspace } from "@/components/ai/AssistantWorkspace";
import { listThreads, getThread } from "@/lib/assistant/sessions";

export const metadata: Metadata = {
  title: "Assistant | PlacePulse",
  description: "Ask grounded questions about Queensland suburb and place sentiment.",
};

// Reads the signed-in user's threads and the open one, so it is always rendered fresh.
export const dynamic = "force-dynamic";

// The dedicated assistant surface: a thread rail to resume past conversations, plus the same chat
// engine as the dashboard dock given the full height of the content area. Selecting a thread loads
// its stored messages and hydrates the chat by id; "New chat" mints a fresh one. The interactive
// shell (optimistic new-thread, live titles) lives in AssistantWorkspace.
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadId } = await searchParams;
  const { userId } = await auth();
  const threads = userId ? await listThreads(userId) : [];
  const active = userId && threadId ? await getThread(threadId, userId) : null;

  // A stable id for the chat: the open thread if there is one, otherwise a fresh id for a new
  // conversation. Generated here (server-side) rather than in client state so SSR and hydration agree
  // and the new thread can be saved and titled under a known id.
  // Use `||`, not `??`: an empty `?thread=` (e.g. a stale link) must fall back to a fresh id rather
  // than become an empty chat id that then propagates into thread keys and saved sessions.
  const chatId = threadId || crypto.randomUUID();

  return <AssistantWorkspace initialThreads={threads} chatId={chatId} activeMessages={active?.messages} />;
}
