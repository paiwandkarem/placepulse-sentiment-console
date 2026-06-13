"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

// The slide-over chrome for the intercepted place route, styled like the dashboard's map drawer: a
// right-edge panel that slides in over the map and out on close. It mounts off-screen and animates to
// open on the next frame, so it never pops in. No dimming backdrop, so the map stays visible and
// interactive beside it (clicking another point swaps the panel). Close via the button, Escape, or
// browser back, which dismisses the intercepted route and returns to /places.
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <aside
      role="dialog"
      aria-label="Place details"
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full transform flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:max-w-[460px]",
        shown ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Place details</span>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close place"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-3">{children}</div>
    </aside>
  );
}
