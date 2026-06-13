"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

// The slide-over chrome for the intercepted place route. It renders over the map explorer; closing
// (backdrop click, the close button, Escape, or browser back) calls router.back(), which dismisses
// the intercepted modal and returns to /places. The content inside stays a Server Component.
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={() => router.back()} className="absolute inset-0 cursor-default bg-black/30" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur">
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
      </div>
    </div>
  );
}
