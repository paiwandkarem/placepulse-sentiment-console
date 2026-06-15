"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

// The single searchable single-select used by every filter bar in the app (dashboard, places,
// briefs), so the controls look and behave identically everywhere. A trigger button shows the
// current value and opens a filtered, scrollable list with a search box. The menu is positioned with
// fixed coordinates measured from the trigger, so a horizontally scrolling or clipped container can
// never crop it. Closes on outside pointer, Escape, scroll or resize.
export function SearchableDropdown({
  value,
  options,
  onSelect,
  disabled,
  placeholder = "Search",
  triggerClassName,
}: {
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Place the menu relative to the trigger: clamped within the viewport horizontally (never off the
  // right edge on a phone), opening below by default but flipping above when there is more room there
  // (so the list is never cut off at the bottom of a small screen), with a max-height that fits the
  // available space so the options always scroll into reach. Re-measured on scroll/resize so the menu
  // tracks the trigger instead of detaching.
  const measure = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const width = Math.min(Math.max(rect.width, 224), vw - gap * 2);
    const left = Math.min(Math.max(gap, rect.left), vw - gap - width);
    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(360, Math.max(160, openUp ? spaceAbove : spaceBelow));
    setCoords(
      openUp
        ? { left, width, bottom: vh - rect.top + 4, maxHeight }
        : { left, width, top: rect.bottom + 4, maxHeight },
    );
  }, []);

  function openMenu() {
    measure();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    // Keep the menu glued to the trigger as the page/containers scroll or the viewport resizes,
    // rather than closing — a scroll while reaching for an option must not dismiss it on touch.
    function onReposition() {
      measure();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, measure]);

  const filtered = options.filter((option) => option.toLowerCase().includes(query.toLowerCase())).slice(0, 200);

  function choose(option: string) {
    onSelect(option);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center justify-between gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
      </button>
      {open && coords && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            left: coords.left,
            width: coords.width,
            top: coords.top,
            bottom: coords.bottom,
            maxHeight: coords.maxHeight,
          }}
          className="z-50 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label="Search options"
              className="h-9 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
            ) : (
              filtered.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option === value}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex min-h-[40px] w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100",
                      option === value ? "font-semibold text-gray-900" : "text-gray-700",
                    )}
                  >
                    {option}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </>
  );
}
