import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { getPlacesDirectory } from "@/lib/services/placesService";
import { PlacesControls } from "@/components/places/PlacesControls";
import { Card } from "@/components/ui/Card";
import type { PoiPlace } from "@/lib/repositories/poiRepository";

export const metadata: Metadata = {
  title: "Places | PlacePulse",
  description: "Explore Queensland businesses by name, suburb and category, with ratings and review volume.",
};

// The directory reads from a 27M-row dataset and its filters live in the URL, so it always renders
// fresh rather than being cached.
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlacesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = first(params.q) ?? "";
  const suburb = first(params.suburb) ?? "";
  const category = first(params.category) ?? "";
  const sort: "reviews" | "rating" = first(params.sort) === "rating" ? "rating" : "reviews";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const directory = await getPlacesDirectory({
    query: query || undefined,
    suburb: suburb || undefined,
    category: category || undefined,
    sort,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(directory.total / directory.pageSize));

  // Build a directory URL that keeps the current filters and only changes the page.
  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (suburb) next.set("suburb", suburb);
    if (category) next.set("category", category);
    if (sort !== "reviews") next.set("sort", sort);
    if (targetPage > 1) next.set("page", String(targetPage));
    const qs = next.toString();
    return qs ? `/places?${qs}` : "/places";
  }

  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">Places</h1>
        <p className="mt-1 text-sm font-semibold text-gray-600">
          Explore Queensland businesses by name, suburb and category. Open the detail page for a
          place&apos;s themes, reviews and word cloud.
        </p>
      </header>

      <PlacesControls categories={directory.categories} selected={{ query, suburb, category, sort }} />

      <p className="mt-6 mb-3 text-sm text-gray-500">
        {directory.total.toLocaleString()} place{directory.total === 1 ? "" : "s"}
        {category ? ` in ${category}` : ""}
        {suburb ? ` · ${suburb}` : ""}
      </p>

      {directory.places.length === 0 ? (
        <Card title="No places match this search">
          <p className="text-sm text-gray-600">Try a different name, suburb or category.</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {directory.places.map((place) => (
            <PlaceCard key={place.placeId} place={place} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-between">
          <PageLink href={pageHref(page - 1)} disabled={page <= 1} direction="prev" />
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          <PageLink href={pageHref(page + 1)} disabled={page >= totalPages} direction="next" />
        </nav>
      )}
    </div>
  );
}

function PlaceCard({ place }: { place: PoiPlace }) {
  return (
    <li>
      <Link
        href={`/places/${encodeURIComponent(place.placeId)}`}
        className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
      >
        <h2 className="text-sm font-semibold text-gray-900">{place.name || "Unnamed place"}</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {[place.category, place.suburb].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {place.rating ? place.rating.toFixed(1) : "—"}
          </span>
          <span>{place.reviewsCount.toLocaleString()} reviews</span>
        </div>
      </Link>
    </li>
  );
}

function PageLink({ href, disabled, direction }: { href: string; disabled: boolean; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "Previous" : "Next";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const content = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
      {direction === "prev" && <Icon className="h-4 w-4" />}
      {label}
      {direction === "next" && <Icon className="h-4 w-4" />}
    </span>
  );
  if (disabled) {
    return <span className="pointer-events-none opacity-40">{content}</span>;
  }
  return (
    <Link href={href} className="hover:[&>span]:bg-gray-50">
      {content}
    </Link>
  );
}
