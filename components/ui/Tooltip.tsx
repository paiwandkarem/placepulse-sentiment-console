import type { ReactNode } from "react";

// A small hover/focus tooltip, replacing flowbite's Tooltip so that dependency can be dropped. The
// trigger is made focusable so keyboard users get the same disclosure as mouse users; the bubble
// reveals on group-hover and group-focus-within. Purely presentational, no client JS.
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      <span tabIndex={0} className="cursor-help rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-[240px] -translate-x-1/2 whitespace-normal rounded-lg bg-gray-900 px-2 py-1 text-left text-[11px] font-medium leading-snug text-white shadow-lg group-hover/tooltip:block group-focus-within/tooltip:block"
      >
        {content}
      </span>
    </span>
  );
}
