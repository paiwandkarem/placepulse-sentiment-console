"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FaMapMarkedAlt } from "react-icons/fa";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

// Persistent vertical handle on the right edge that opens and closes the map panel (a second
// affordance alongside the filter-bar map toggle and the panel's own close button). It stays
// visible while the panel is open and slides to the panel's edge, with the chevron flipping to
// signal open vs close. The accessible name lives in
// aria-label and title.
export function MapEdgeTab({ mapOpen }: { mapOpen: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (mapOpen) next.delete("map");
    else next.set("map", "1");
    router.replace(`/?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mapOpen ? "Close map panel" : "Open map panel"}
      title={mapOpen ? "Close map panel" : "Open map panel"}
      className={`fixed top-1/2 z-[60] flex min-h-[68px] w-[38px] -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-[18px] border border-r-0 border-gray-800 bg-gray-900 px-1 py-1.5 text-white shadow-[0_14px_32px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-300 ease-in-out hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 ${
        mapOpen ? "right-0 sm:right-[420px]" : "right-0"
      }`}
    >
      <FaMapMarkedAlt size={16} className="shrink-0" />
      {mapOpen ? <HiChevronRight size={18} /> : <HiChevronLeft size={18} />}
    </button>
  );
}
