"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/ui/sentiment";
import { Spinner } from "@/components/ui/Spinner";
import { useMapDrawer } from "./MapDrawerContext";

// The map pulls in mapbox-gl, its CSS and a multi-megabyte boundary file, so it is code-split and
// only loads on the client when the drawer first opens. Because this is a Client Component, the
// import can be ssr:false (it cannot in the Server page), and a spinner shows while mapbox loads.
const MapPanel = dynamic(() => import("./MapPanel").then((module) => module.MapPanel), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
});

// The slide-over drawer. The aside is always mounted, so flipping the transform class animates
// immediately on toggle (no server round-trip, no wait on the map's data). The map itself mounts
// on first open and then stays mounted, so reopening is instant.
export function MapDrawer({ suburbs, selected }: { suburbs: string[]; selected: string | null }) {
  const { open, hasOpened, setOpen } = useMapDrawer();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Treat the slide-over as a (non-modal) dialog for keyboard and screen-reader users, the same way
  // the assistant dock does: announce it via role/aria-label, move focus into it on open, close on
  // Escape, and return focus to whatever opened it on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    previouslyFocused.current?.focus?.();
  }, [open, setOpen]);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-label="Suburb map"
      aria-hidden={!open}
      tabIndex={-1}
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-full transform bg-gray-50 shadow-2xl outline-none transition-transform duration-300 ease-in-out sm:max-w-[420px]",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      {hasOpened && selected && <MapPanel suburbs={suburbs} selected={selected} />}
    </aside>
  );
}
