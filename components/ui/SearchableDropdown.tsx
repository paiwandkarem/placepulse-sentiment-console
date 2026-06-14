"use client";

import { useEffect, useRef, useState } from "react";
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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 224) });
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
    function onReposition(event: Event) {
      // A scroll inside the menu's own option list must not close it; only an outside scroll (which
      // would detach the fixed-position menu from its trigger) should. Resize always closes.
      if (event.type === "scroll" && event.target instanceof Node && panelRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
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
  }, [open]);

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
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
      {open && coords && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className="z-50 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label="Search options"
              className="h-8 w-full rounded-md border border-gray-200 px-2 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No matches</li>
            ) : (
              filtered.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option === value}
                    onClick={() => choose(option)}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100",
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
