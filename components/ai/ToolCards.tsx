import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { PlaceImage } from "@/components/ui/PlaceImage";
import { placeStaticMapUrl } from "@/lib/map/staticMap";

// Generative UI for the assistant: a handful of its grounded tool results render as rich cards
// instead of plain JSON, so an answer comes with a sentiment card, a trend sparkline, place cards
// with a locator map, or a side-by-side comparison. The data is exactly what the tool already
// returned (the audit timeline beneath still shows the raw figures), so nothing here is invented.
// Components are SVG/CSS only and the place locators are static map images, so the dock stays light.

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function SentimentSplit({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
      <span className="bg-emerald-500" style={{ width: `${positive}%` }} />
      <span className="bg-slate-300" style={{ width: `${neutral}%` }} />
      <span className="bg-rose-500" style={{ width: `${negative}%` }} />
    </div>
  );
}

function MiniKpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2 py-1">
      <div className={`text-sm font-bold ${accent ?? "text-gray-900"}`}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-600">{label}</div>
    </div>
  );
}

type SuburbShape = {
  found?: boolean;
  suburb?: string;
  category?: string;
  overallSatisfaction100?: number;
  avgRating?: number;
  totalReviews?: number;
  positivePct?: number;
  negativePct?: number;
  neutralPct?: number;
};

function SuburbStat({ data }: { data: SuburbShape }) {
  const positive = num(data.positivePct);
  const negative = num(data.negativePct);
  const neutral = num(data.neutralPct);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-bold text-gray-900">{data.suburb}</p>
        <span className="shrink-0 text-base font-extrabold text-gray-900">
          {num(data.overallSatisfaction100)}
          <span className="text-[11px] font-medium text-gray-500">/100</span>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <MiniKpi label="Rating" value={`${num(data.avgRating).toFixed(2)}`} />
        <MiniKpi label="Reviews" value={num(data.totalReviews).toLocaleString()} />
        <MiniKpi label="Positive" value={`${positive}%`} accent="text-emerald-600" />
      </div>
      <SentimentSplit positive={positive} neutral={neutral} negative={negative} />
    </div>
  );
}

function SuburbSentimentCard({ output }: { output: SuburbShape }) {
  if (!output || output.found === false || !output.suburb) return null;
  const category = output.category && output.category !== "overall" ? ` · ${output.category}` : "";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Suburb sentiment{category}
      </p>
      <SuburbStat data={output} />
      <Link
        href={`/?areaName=${encodeURIComponent(output.suburb)}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
      >
        Open dashboard
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function TrendSparkline({ output }: { output: { suburb?: string; points?: { date: string; satisfaction100: number }[] } }) {
  const points = (output?.points ?? []).filter((point) => Number.isFinite(point?.satisfaction100));
  if (points.length < 2) return null;
  const width = 320;
  const height = 56;
  const pad = 6;
  const xAt = (index: number) => pad + (index / (points.length - 1)) * (width - 2 * pad);
  const yAt = (value: number) => height - pad - (clamp(value, 0, 100) / 100) * (height - 2 * pad);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(point.satisfaction100).toFixed(1)}`)
    .join(" ");
  const latest = points[points.length - 1].satisfaction100;
  const first = points[0].satisfaction100;
  const up = latest >= first;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Trend{output.suburb ? ` · ${output.suburb}` : ""}
        </p>
        <span className={`text-xs font-bold ${up ? "text-emerald-600" : "text-rose-600"}`}>{Math.round(latest)}/100</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 w-full" role="img" aria-label="Satisfaction trend over time">
        <path d={path} fill="none" stroke={up ? "#10b981" : "#f43f5e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

type PlaceShape = {
  placeId?: string;
  name?: string;
  category?: string;
  rating?: number;
  reviewsCount?: number;
  lat?: number;
  lon?: number;
};

function PlacesListCard({ output }: { output: { suburb?: string; count?: number; places?: PlaceShape[] } }) {
  const places = (output?.places ?? []).filter((place) => place?.placeId);
  if (places.length === 0) return null;
  const shown = places.slice(0, 5);
  const extra = (output.count ?? places.length) - shown.length;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Places{output.suburb ? ` in ${output.suburb}` : ""}
      </p>
      {shown.map((place) => (
        <Link
          key={place.placeId}
          href={`/places/${encodeURIComponent(String(place.placeId))}`}
          className="flex gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition-colors hover:bg-gray-50"
        >
          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200">
            <PlaceImage
              src={placeStaticMapUrl(num(place.lat), num(place.lon), { width: 160, height: 112 })}
              alt={`Map of ${place.name ?? "place"}`}
              sizes="80px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{place.name || "Unnamed place"}</p>
            {place.category && <p className="truncate text-xs text-gray-500">{place.category}</p>}
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {num(place.rating).toFixed(1)}
              <span className="text-gray-500">· {num(place.reviewsCount).toLocaleString()} reviews</span>
            </p>
          </div>
        </Link>
      ))}
      {extra > 0 && <p className="text-[11px] text-gray-500">+{extra.toLocaleString()} more</p>}
    </div>
  );
}

function CompareCard({ output }: { output: { found?: boolean; category?: string; a?: SuburbShape; b?: SuburbShape; delta?: { overallSatisfaction100?: number } } }) {
  if (!output || output.found === false || !output.a || !output.b) return null;
  const category = output.category && output.category !== "overall" ? ` · ${output.category}` : "";
  const delta = num(output.delta?.overallSatisfaction100);
  const leads = delta === 0 ? null : delta > 0 ? output.a.suburb : output.b.suburb;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Comparison{category}</p>
      <div className="grid grid-cols-2 gap-3">
        <SuburbStat data={output.a} />
        <SuburbStat data={output.b} />
      </div>
      {leads && (
        <p className="mt-2 text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{leads}</span> leads by {Math.abs(delta)} points.
        </p>
      )}
    </div>
  );
}

// Map a tool name to its card. Returns null for tools without a rich view (they keep the timeline).
export function renderToolCard(name: string, output: unknown): React.ReactNode | null {
  if (output == null || typeof output !== "object") return null;
  switch (name) {
    case "suburbSentiment":
      return <SuburbSentimentCard output={output as SuburbShape} />;
    case "sentimentTrend":
      return <TrendSparkline output={output as { suburb?: string; points?: { date: string; satisfaction100: number }[] }} />;
    case "placesInSuburb":
      return <PlacesListCard output={output as { suburb?: string; count?: number; places?: PlaceShape[] }} />;
    case "compareSuburbs":
      return <CompareCard output={output as { found?: boolean; category?: string; a?: SuburbShape; b?: SuburbShape; delta?: { overallSatisfaction100?: number } }} />;
    default:
      return null;
  }
}
