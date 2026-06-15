"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

// The suburb sentiment overview, shown on the left when a suburb is selected on the map. It is the
// dashboard's aggregate at a glance (satisfaction, rating, split, top drivers), tying the
// suburb-level sentiment to the POI places on the same screen. Fetched on demand only when a suburb
// is active, so it never costs anything otherwise; the route is CDN-cached.

type Driver = { label: string; positivePct?: number; negativePct?: number };
type Overview = {
  areaName: string;
  satisfaction100: number;
  avgRating: number;
  totalReviews: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  working: Driver[];
  notWorking: Driver[];
};

export function SuburbPanel({ suburb, onClear }: { suburb: string; onClear: () => void }) {
  const [overview, setOverview] = useState<Overview | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // Reset to the loading state while the new suburb's overview is fetched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverview(undefined);
    fetch(`/api/places/suburb?name=${encodeURIComponent(suburb)}`)
      .then((response) => response.json())
      .then((data: { overview: Overview | null }) => {
        if (!cancelled) setOverview(data.overview ?? null);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [suburb]);

  return (
    <div className="pointer-events-auto absolute left-4 top-[4.75rem] z-30 w-[18.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Suburb overview</p>
          <p className="text-base font-bold text-gray-900">{suburb}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear suburb"
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-4 py-3">
        {overview === undefined ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : overview === null ? (
          <p className="text-sm text-gray-500">No suburb-level sentiment for this area.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Satisfaction" value={`${overview.satisfaction100}/100`} />
              <Kpi label="Avg rating" value={`${overview.avgRating.toFixed(1)}/5`} />
              <Kpi label="Reviews" value={overview.totalReviews.toLocaleString()} />
              <Kpi label="Positive" value={`${overview.positivePct}%`} accent="text-emerald-600" />
            </div>

            <div className="mt-3">
              <div className="flex h-2 overflow-hidden rounded-full">
                <span className="bg-emerald-500" style={{ width: `${overview.positivePct}%` }} />
                <span className="bg-slate-300" style={{ width: `${overview.neutralPct}%` }} />
                <span className="bg-rose-500" style={{ width: `${overview.negativePct}%` }} />
              </div>
            </div>

            {overview.working.length > 0 && (
              <DriverList title="What's working" drivers={overview.working} color="text-emerald-700" valueKey="positivePct" />
            )}
            {overview.notWorking.length > 0 && (
              <DriverList title="What's not working" drivers={overview.notWorking} color="text-rose-700" valueKey="negativePct" />
            )}

            <Link
              href={`/?areaName=${encodeURIComponent(overview.areaName)}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
            >
              Open full dashboard
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5">
      <div className={`text-sm font-bold ${accent ?? "text-gray-900"}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function DriverList({
  title,
  drivers,
  color,
  valueKey,
}: {
  title: string;
  drivers: Driver[];
  color: string;
  valueKey: "positivePct" | "negativePct";
}) {
  return (
    <div className="mt-3">
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${color}`}>{title}</p>
      <ul className="space-y-1">
        {drivers.map((driver) => (
          <li key={driver.label} className="flex items-center justify-between text-xs text-gray-700">
            <span>{driver.label}</span>
            <span className="font-mono text-gray-500">{driver[valueKey] ?? 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
