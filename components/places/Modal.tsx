"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

// The slide-over chrome for the intercepted place route, styled like the dashboard's map drawer: a
// right-edge panel that slides in over the map and out on close. It mounts off-screen and animates to
// open on the next frame, so it never pops in. No dimming backdrop, so the map stays visible and
// interactive beside it (clicking another point swaps the panel). Close via the button, Escape, or
// browser back, which dismisses the intercepted route and returns to /places.
//
// Because the map stays interactive, this is deliberately a NON-modal dialog: it does not set
// aria-modal or trap focus (that would wrongly mark the map inert and block point-to-point browsing).
// It does the parts that matter for keyboard and screen-reader users: move focus into the panel on
// open, and restore it to the triggering element on close.
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      setShown(true);
      closeRef.current?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      // Return focus to wherever it was (the map point or directory link that opened the panel).
      previouslyFocused?.focus?.();
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
          ref={closeRef}
          type="button"
          onClick={() => router.back()}
          aria-label="Close place"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-3">{children}</div>
    </aside>
  );
}
