"use client";

import { ChevronLeft, ChevronRight, Map } from "lucide-react";
import { useMapDrawer } from "./MapDrawerContext";

// Persistent vertical handle on the right edge that opens and closes the map panel (a second
// affordance alongside the filter-bar map toggle and the panel's own close button). It stays
// visible while the panel is open and slides to the panel's edge, with the chevron flipping to
// signal open vs close. The accessible name lives in
// aria-label and title.
export function MapEdgeTab() {
  const { open: mapOpen, toggle } = useMapDrawer();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mapOpen ? "Close map panel" : "Open map panel"}
      title={mapOpen ? "Close map panel" : "Open map panel"}
      // Hidden on phones: there the floating right-edge handle reads as a stray button, and the map is
      // opened from the (now stacked) filter bar instead. Shown from sm up as a desktop affordance.
      className={`fixed top-1/2 z-[60] hidden min-h-[68px] w-[38px] -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-[18px] border border-r-0 border-gray-800 bg-gray-900 px-1 py-1.5 text-white shadow-[0_14px_32px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-300 ease-in-out hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 sm:flex ${
        mapOpen ? "right-0 sm:right-[420px]" : "right-0"
      }`}
    >
      <Map className="h-4 w-4 shrink-0" aria-hidden="true" />
      {mapOpen ? (
        <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
