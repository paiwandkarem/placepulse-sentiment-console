"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { track } from "@vercel/analytics";
import { Spinner } from "@/components/ui/Spinner";

// The directory's search and filter controls. Like the dashboard filter bar, state lives in the URL:
// every change rewrites the query string and the server re-renders the list, so a search is
// shareable and the back button works. Name and suburb are free text (applied on submit); category
// and sort apply immediately.

type Selected = { query: string; suburb: string; category: string; sort: "reviews" | "rating" };

export function PlacesControls({ categories, selected }: { categories: string[]; selected: Selected }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(selected.query);
  const [suburb, setSuburb] = useState(selected.suburb);

  // Any change resets to page 1 (the page param is simply omitted).
  function navigate(overrides: Partial<Selected>) {
    const next = { query, suburb, category: selected.category, sort: selected.sort, ...overrides };
    const params = new URLSearchParams();
    if (next.query.trim()) params.set("q", next.query.trim());
    if (next.suburb.trim()) params.set("suburb", next.suburb.trim());
    if (next.category) params.set("category", next.category);
    if (next.sort !== "reviews") params.set("sort", next.sort);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/places?${qs}` : "/places", { scroll: false }));
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        track("places_searched", { query: query.trim(), category: selected.category || "all" });
        navigate({});
      }}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search places by name"
          className="h-10 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
      </div>

      <input
        value={suburb}
        onChange={(event) => setSuburb(event.target.value)}
        placeholder="Suburb (optional)"
        className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-gray-400 sm:w-44"
      />

      <select
        value={selected.category}
        onChange={(event) => navigate({ category: event.target.value })}
        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-400 sm:w-48"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <select
        value={selected.sort}
        onChange={(event) => navigate({ sort: event.target.value as Selected["sort"] })}
        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-400 sm:w-40"
      >
        <option value="reviews">Most reviewed</option>
        <option value="rating">Highest rated</option>
      </select>

      <button
        type="submit"
        className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
      >
        {isPending ? <Spinner size="sm" className="text-white" /> : "Search"}
      </button>
    </form>
  );
}
