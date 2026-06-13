"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { track } from "@vercel/analytics";
import { cn } from "@/lib/ui/sentiment";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import type { BriefJob } from "@/lib/briefs/repository";
import type { BriefContent } from "@/lib/briefs/schema";

const OVERALL = "Overall";

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
  const [area, setArea] = useState("");
  const [category, setCategory] = useState(OVERALL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaSet = useMemo(() => new Set(areaNames), [areaNames]);

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
    const trimmed = area.trim();
    if (!areaSet.has(trimmed)) {
      setError("Pick a Queensland suburb from the list.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ areaName: trimmed, category: category === OVERALL ? undefined : category }),
      });
      if (!response.ok) {
        setError("Could not start the brief. Try again.");
        return;
      }
      track("brief_generated", { suburb: trimmed, category });
      setArea("");
      setCategory(OVERALL);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={generate}
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Suburb</span>
          <SearchableDropdown
            value={area}
            options={areaNames}
            onSelect={setArea}
            placeholder="Search a Queensland suburb"
            triggerClassName="h-10 w-full"
          />
        </div>

        <div className="sm:w-56">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Category</span>
          <SearchableDropdown
            value={category}
            options={[OVERALL, ...categories]}
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
          <h3 className="text-sm font-semibold text-gray-900">{brief.title}</h3>
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
