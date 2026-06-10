"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FilterCatalogue, RequiredSentimentFilters } from "@/lib/types";

// URL-driven filter controls. Each change writes the selection into the query string and the
// server re-renders the dashboard from it — so the filters are shareable/bookmarkable and
// there's a single source of truth (the URL), not a parallel piece of client state.
//
// `selected` is the *resolved* selection the server actually rendered (defaults already
// applied), so the dropdowns always show what's on screen. Reading the raw query params for
// the displayed value would be wrong on first load — the server defaults the date to the
// latest month, but an empty param would make the control show the earliest option.
export function FilterBar({
  catalogue,
  selected,
}: {
  catalogue: FilterCatalogue;
  selected: RequiredSentimentFilters;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    // replace, not push: changing a filter shouldn't stack history entries. scroll:false keeps
    // the viewport put while the server component re-renders.
    router.replace(`/?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-4">
      <Select label="Area" value={selected.areaName} options={catalogue.areaNames} onChange={(value) => updateParam("areaName", value)} />
      <Select label="Category" value={selected.category} options={catalogue.categories} onChange={(value) => updateParam("category", value)} />
      <Select label="Date" value={selected.date} options={catalogue.dates} onChange={(value) => updateParam("date", value)} />
      <Select label="Aggregation" value={selected.aggType} options={catalogue.aggTypes} onChange={(value) => updateParam("aggType", value)} />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <select
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
