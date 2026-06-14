"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, ExternalLink, FileText, Loader2, Trash2, TriangleAlert, X } from "lucide-react";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/ui/sentiment";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import type { BriefJob } from "@/lib/briefs/repository";
import { BRIEF_TYPE_META, BRIEF_TYPES } from "@/lib/briefs/schema";
import type { BriefContent, BriefType } from "@/lib/briefs/schema";

// The briefs surface: a suburb map as the primary selector on the left, a fixed control panel on the
// right (brief type, the selected suburbs, the category, and Generate), and the history of past
// briefs below. Generation is asynchronous on the server (the POST returns a running job), so the
// list polls for status while anything is running and updates in place.

// The map carries mapbox-gl, so it is code-split and only loaded on the briefs page, never the first
// paint elsewhere.
const SuburbSelectMap = dynamic(() => import("./SuburbSelectMap").then((module) => module.SuburbSelectMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-50">
      <Loader2 className="h-5 w-5 animate-spin text-gray-300" aria-hidden="true" />
    </div>
  ),
});

const ALL_CATEGORIES = "All categories";

// One suburb for overview and momentum, two or three for comparison, none for the category deep-dive.
function capFor(type: BriefType): number {
  if (type === "comparison") return 3;
  if (type === "category") return 0;
  return 1;
}

function parseContent(raw: string | null): BriefContent | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BriefContent;
  } catch {
    return null;
  }
}

export function BriefsView({
  areaNames,
  categories,
  initialBriefs,
}: {
  areaNames: string[];
  categories: string[];
  initialBriefs: BriefJob[];
}) {
  const [briefs, setBriefs] = useState<BriefJob[]>(initialBriefs);
  const [type, setType] = useState<BriefType>("overview");
  const [areas, setAreas] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaSet = useMemo(() => new Set(areaNames), [areaNames]);

  // Switching type resizes the selection to the new cap.
  const selectType = useCallback((value: BriefType) => {
    setType(value);
    setAreas((prev) => prev.slice(0, capFor(value)));
  }, []);

  // Toggle a suburb in the selection, respecting the cap. At the cap, adding drops the oldest, so a
  // click is never a dead end. Shared by the map and the name search.
  const toggleSuburb = useCallback(
    (name: string) => {
      const cap = capFor(type);
      if (cap === 0) return;
      setAreas((prev) => {
        if (prev.includes(name)) return prev.filter((entry) => entry !== name);
        if (cap === 1) return [name];
        if (prev.length < cap) return [...prev, name];
        return [...prev.slice(1), name];
      });
    },
    [type],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/briefs");
    if (!response.ok) return;
    const data = (await response.json()) as { briefs: BriefJob[] };
    setBriefs(data.briefs);
  }, []);

  // Poll only while a brief is still being generated, then stop.
  useEffect(() => {
    if (!briefs.some((brief) => brief.status === "running")) return;
    const timer = setInterval(refresh, 2500);
    return () => clearInterval(timer);
  }, [briefs, refresh]);

  const remove = useCallback(async (id: string) => {
    track("brief_deleted");
    setBriefs((previous) => previous.filter((brief) => brief.id !== id));
    await fetch(`/api/briefs/${id}`, { method: "DELETE" }).catch(() => undefined);
  }, []);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    const picked = areas.filter((name) => areaSet.has(name));
    const realCategory = category === ALL_CATEGORIES ? undefined : category;

    if (type === "category") {
      if (!realCategory) {
        setError("Pick a category for the deep-dive.");
        return;
      }
    } else if (type === "comparison") {
      if (picked.length < 2) {
        setError("Select at least two suburbs on the map to compare.");
        return;
      }
    } else if (picked.length < 1) {
      setError("Select a suburb on the map.");
      return;
    }

    const areaNamesToSend = type === "category" ? [] : type === "comparison" ? picked.slice(0, 3) : [picked[0]];
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, areaNames: areaNamesToSend, category: realCategory }),
      });
      if (!response.ok) {
        setError("Could not start the brief. Try again.");
        return;
      }
      track("brief_generated", { type, suburbs: areaNamesToSend.join(", "), category });
      setAreas([]);
      setCategory(ALL_CATEGORIES);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:h-[60vh] lg:flex-row">
        <div className="relative min-h-[340px] flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <SuburbSelectMap selected={areas} selectable={areaNames} onToggle={toggleSuburb} />
          {type === "category" && (
            <div className="absolute inset-x-0 top-0 z-[1] bg-gray-900/80 px-4 py-2 text-center text-xs font-medium text-white">
              Category deep-dive ranks every Queensland suburb, so no map selection is needed.
            </div>
          )}
        </div>

        <form
          onSubmit={generate}
          className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 lg:w-80"
        >
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-gray-600">Brief type</span>
            <div className="flex flex-wrap gap-2">
              {BRIEF_TYPES.map((value) => {
                const meta = BRIEF_TYPE_META[value];
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!meta.available}
                    onClick={() => selectType(value)}
                    title={meta.available ? meta.description : "Coming soon"}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-gray-900 bg-gray-900 text-white"
                        : meta.available
                          ? "border-gray-200 text-gray-700 hover:bg-gray-50"
                          : "cursor-not-allowed border-gray-100 text-gray-300",
                    )}
                  >
                    {meta.label}
                    {!meta.available && <span className="ml-1 text-[10px] uppercase tracking-wide">Soon</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {type !== "category" && (
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                {type === "comparison" ? "Suburbs (2 to 3)" : "Suburb"}
              </span>
              {areas.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {areas.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setAreas((prev) => prev.filter((entry) => entry !== name))}
                        aria-label={`Remove ${name}`}
                        className="text-gray-300 hover:text-white"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-xs text-gray-400">Click a suburb on the map, or search below.</p>
              )}
              <SearchableDropdown
                value=""
                options={areaNames}
                onSelect={(name) => toggleSuburb(name)}
                placeholder="Search a suburb to add"
                triggerClassName="h-10 w-full"
              />
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-gray-600">
              {type === "category" ? "Category (required)" : "Category"}
            </span>
            <SearchableDropdown
              value={category}
              options={[ALL_CATEGORIES, ...categories]}
              onSelect={setCategory}
              placeholder="Search categories"
              triggerClassName="h-10 w-full"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-auto flex h-10 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4" aria-hidden="true" />
            )}
            Generate brief
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Your briefs</h2>
        {briefs.length === 0 ? (
          <p className="text-sm text-gray-500">No briefs yet. Generate one above.</p>
        ) : (
          <ul className="space-y-4">
            {briefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} onDelete={remove} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BriefCard({ brief, onDelete }: { brief: BriefJob; onDelete: (id: string) => void }) {
  const content = parseContent(brief.content);

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{brief.title}</h3>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {BRIEF_TYPE_META[brief.type].label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{new Date(brief.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={brief.status} />
          {brief.status !== "running" && (
            <button
              type="button"
              onClick={() => onDelete(brief.id)}
              aria-label="Delete brief"
              title="Delete brief"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {brief.status === "running" && (
        <div className="mt-3 flex min-h-[3.5rem] items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Drafting the brief and rendering the PDF...
        </div>
      )}
      {brief.status === "failed" && <p className="mt-3 text-sm text-rose-600">{brief.error ?? "Generation failed."}</p>}
      {brief.status === "completed" && content && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold text-gray-900">{content.headline}</p>
          <p className="text-sm text-gray-600">{content.executiveSummary}</p>
          {brief.pdfBlobUrl && (
            <a
              href={brief.pdfBlobUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("brief_viewed")}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View PDF
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: BriefJob["status"] }) {
  const map = {
    running: { label: "Generating", icon: Loader2, spin: true, className: "border-amber-200 bg-amber-50 text-amber-700" },
    completed: { label: "Ready", icon: CheckCircle2, spin: false, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    failed: { label: "Failed", icon: TriangleAlert, spin: false, className: "border-rose-200 bg-rose-50 text-rose-700" },
  } as const;
  const { label, icon: Icon, spin, className } = map[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", className)}>
      <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} aria-hidden="true" />
      {label}
    </span>
  );
}
