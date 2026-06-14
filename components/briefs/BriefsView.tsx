"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeftRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Layers,
  Loader2,
  Trash2,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
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

// Each brief type gets an icon and a colour, so the history grid reads at a glance.
const TYPE_STYLE: Record<BriefType, { icon: ComponentType<{ className?: string }>; accent: string; soft: string }> = {
  overview: { icon: LayoutDashboard, accent: "text-gray-700", soft: "bg-gray-100" },
  comparison: { icon: ArrowLeftRight, accent: "text-indigo-700", soft: "bg-indigo-50" },
  category: { icon: Layers, accent: "text-amber-700", soft: "bg-amber-50" },
  momentum: { icon: TrendingUp, accent: "text-emerald-700", soft: "bg-emerald-50" },
};

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
  // Per-suburb satisfaction for the chosen category (keyed by category), used to shade the map in
  // category mode. Keyed so a stale fetch is never shown against the wrong category.
  const [scores, setScores] = useState<{ category: string; data: { areaName: string; value: number }[] } | null>(null);

  // The selector map carries mapbox-gl. On phones it is not core to the brief flow (the suburb is
  // chosen by search) and would cost a heavy load, so it is only *mounted* from md up — not merely
  // CSS-hidden — so the library never loads on small screens.
  const [showMap, setShowMap] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setShowMap(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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

  // In category mode, fetch the category's per-suburb satisfaction so the map can shade it. Cleared
  // for every other type or when no category is chosen.
  useEffect(() => {
    if (type !== "category" || category === ALL_CATEGORIES) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/sentiment/category-rank?category=${encodeURIComponent(category)}`);
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { suburbs: { areaName: string; satisfaction100: number }[] };
        if (!cancelled) {
          setScores({ category, data: data.suburbs.map((suburb) => ({ areaName: suburb.areaName, value: suburb.satisfaction100 })) });
        }
      } catch {
        // Leave any prior scores: the map only shows them when their category matches the selection.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, category]);

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
        <div className="relative hidden min-h-[340px] flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 md:block">
          {showMap && (
            <SuburbSelectMap
              selected={areas}
              selectable={areaNames}
              onToggle={toggleSuburb}
              scores={type === "category" && scores?.category === category ? scores.data : undefined}
            />
          )}
          {type === "category" && (
            <div className="absolute inset-x-0 top-0 z-[1] bg-gray-900/80 px-4 py-2 text-center text-xs font-medium text-white">
              {category === ALL_CATEGORIES
                ? "Pick a category to shade every Queensland suburb by its satisfaction."
                : `Suburbs shaded by satisfaction for ${category}.`}
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
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  const style = TYPE_STYLE[brief.type];
  const Icon = style.icon;

  return (
    <li className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.soft)}>
            <Icon className={cn("h-5 w-5", style.accent)} />
          </span>
          <div className="min-w-0">
            <span className={cn("block text-[10px] font-bold uppercase tracking-wide", style.accent)}>
              {BRIEF_TYPE_META[brief.type].label}
            </span>
            <h3 className="truncate text-sm font-semibold text-gray-900">{brief.title}</h3>
          </div>
        </div>
        <StatusPill status={brief.status} />
      </div>

      {brief.status === "running" && (
        <div className="flex min-h-[3rem] items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Drafting and rendering...
        </div>
      )}
      {brief.status === "failed" && <p className="text-sm text-rose-600">{brief.error ?? "Generation failed."}</p>}
      {brief.status === "completed" && content && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-gray-900">{content.headline}</p>
          <p className="line-clamp-3 text-xs leading-relaxed text-gray-600">{content.executiveSummary}</p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <p className="text-xs text-gray-400">{new Date(brief.createdAt).toLocaleDateString()}</p>
        <div className="flex items-center gap-1.5">
          {brief.status === "completed" && brief.pdfBlobUrl && (
            <a
              href={brief.pdfBlobUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("brief_viewed")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View PDF
            </a>
          )}
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
