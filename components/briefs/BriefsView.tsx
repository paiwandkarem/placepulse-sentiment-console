"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/ui/sentiment";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import type { BriefJob } from "@/lib/briefs/repository";
import { BRIEF_TYPE_META, BRIEF_TYPES } from "@/lib/briefs/schema";
import type { BriefContent, BriefType } from "@/lib/briefs/schema";

const ALL_CATEGORIES = "All categories";

// The briefs surface: a generate form and a list of past briefs. Generation is asynchronous on the
// server (the POST returns a running job), so the list polls for status while anything is running
// and updates in place. A completed brief shows its drafted summary inline (the "design") with a
// link to the rendered PDF (the "render").

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
  const [areas, setAreas] = useState<string[]>([""]);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaSet = useMemo(() => new Set(areaNames), [areaNames]);

  const setAreaAt = useCallback((index: number, value: string) => {
    setAreas((prev) => prev.map((entry, i) => (i === index ? value : entry)));
  }, []);
  // Comparison needs two or three suburbs; overview needs one. Switching type resizes the picker.
  const selectType = useCallback((value: BriefType) => {
    setType(value);
    setAreas((prev) => (value === "comparison" ? (prev.length < 2 ? [...prev, ""] : prev) : prev.slice(0, 1)));
  }, []);

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

  // Remove a brief and its stored PDF. Optimistic: drop it from the list, then tell the server.
  const remove = useCallback(async (id: string) => {
    track("brief_deleted");
    setBriefs((previous) => previous.filter((brief) => brief.id !== id));
    await fetch(`/api/briefs/${id}`, { method: "DELETE" }).catch(() => undefined);
  }, []);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    const picked = [...new Set(areas.map((entry) => entry.trim()).filter(Boolean))];
    const allValid = picked.every((entry) => areaSet.has(entry));
    if (type === "comparison") {
      if (picked.length < 2 || !allValid) {
        setError("Pick at least two Queensland suburbs to compare.");
        return;
      }
    } else if (picked.length < 1 || !allValid) {
      setError("Pick a Queensland suburb from the list.");
      return;
    }
    const areaNamesToSend = type === "comparison" ? picked.slice(0, 3) : [picked[0]];
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, areaNames: areaNamesToSend, category: category === ALL_CATEGORIES ? undefined : category }),
      });
      if (!response.ok) {
        setError("Could not start the brief. Try again.");
        return;
      }
      track("brief_generated", { type, suburbs: areaNamesToSend.join(", "), category });
      setAreas(type === "comparison" ? ["", ""] : [""]);
      setCategory(ALL_CATEGORIES);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={generate} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {type === "comparison" ? (
            <div className="flex-1 space-y-2">
              <span className="block text-xs font-semibold text-gray-600">Suburbs to compare (2 to 3)</span>
              {areas.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <SearchableDropdown
                    value={value}
                    options={areaNames}
                    onSelect={(next) => setAreaAt(index, next)}
                    placeholder={`Suburb ${index + 1}`}
                    triggerClassName="h-10 w-full"
                  />
                  {areas.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setAreas((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove suburb"
                      className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {areas.length < 3 && (
                <button
                  type="button"
                  onClick={() => setAreas((prev) => [...prev, ""])}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  + Add suburb
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-gray-600">Suburb</span>
              <SearchableDropdown
                value={areas[0] ?? ""}
                options={areaNames}
                onSelect={(next) => setAreaAt(0, next)}
                placeholder="Search a Queensland suburb"
                triggerClassName="h-10 w-full"
              />
            </div>
          )}

        <div className="sm:w-56">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Category</span>
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
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4" aria-hidden="true" />
          )}
          Generate brief
        </button>
        </div>
      </form>
      {error && <p className="-mt-6 text-sm text-rose-600">{error}</p>}

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
      {brief.status === "failed" && (
        <p className="mt-3 text-sm text-rose-600">{brief.error ?? "Generation failed."}</p>
      )}
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
