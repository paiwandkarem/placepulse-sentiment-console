import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlaceProfile } from "@/lib/services/placesService";
import { PlaceProfile } from "@/components/places/PlaceProfile";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPlaceProfile(decodeURIComponent(id));
  return { title: profile ? `${profile.detail.name} | PlacePulse` : "Place | PlacePulse" };
}

// The canonical place page: a direct visit, refresh, share, or assistant deep-link lands here as a
// full page. Navigating from the explorer intercepts this route and shows the same PlaceProfile in a
// slide-over instead (see app/places/@modal/(.)[id]).
export default async function PlacePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const reviewPage = Math.max(1, Number(first(sp.rpage) ?? "1") || 1);

  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <Link href="/places" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        All places
      </Link>
      <PlaceProfile placeId={decodeURIComponent(id)} reviewPage={reviewPage} />
    </div>
  );
}
