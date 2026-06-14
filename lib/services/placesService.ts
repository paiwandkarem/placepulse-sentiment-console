import "server-only";
import { unstable_cache } from "next/cache";
import {
  listPlaceCategories,
  placeDetail,
  placePoints,
  placeReviews,
  placeThemes,
  placeWordTerms,
  searchPlaces,
  type PlacePoint,
  type PlaceReviewPage,
  type PlaceSearchResult,
  type PlaceWordTerm,
  type PoiPlaceDetail,
  type PoiPlaceTheme,
} from "@/lib/repositories/poiRepository";

// Composition layer for the Places explorer, mirroring sentimentService: the surfaces talk to this,
// and it orchestrates the repository reads. The directory is one search; a place profile bundles the
// detail, theme breakdown, first page of reviews and top terms in one round of parallel reads.

export type PlacesDirectory = PlaceSearchResult & { categories: string[] };

// The category list is an expensive group-by that only changes on a re-import, yet every directory
// load needs it. Cache it independently with a long TTL, the same way the dashboard caches its filter
// catalogue, so it is computed roughly once an hour rather than per request.
const cachedPlaceCategories = unstable_cache(listPlaceCategories, ["place-categories"], { revalidate: 3600 });

async function placeCategories(): Promise<string[]> {
  try {
    return await cachedPlaceCategories();
  } catch (error) {
    // No incremental cache outside a Next request (e.g. a script); fall back to the uncached query.
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return listPlaceCategories();
    }
    throw error;
  }
}

export async function getPlaceCategories(): Promise<string[]> {
  return placeCategories();
}

export async function getPlacesDirectory(opts: {
  query?: string;
  suburb?: string;
  category?: string;
  sort?: "reviews" | "rating";
  page?: number;
}): Promise<PlacesDirectory> {
  const [results, categories] = await Promise.all([searchPlaces(opts), placeCategories()]);
  return { ...results, categories };
}

export async function getPlacePoints(opts: {
  query?: string;
  suburb?: string;
  category?: string;
}): Promise<PlacePoint[]> {
  return placePoints(opts);
}

export type PlaceProfile = {
  detail: PoiPlaceDetail;
  themes: PoiPlaceTheme[];
  reviews: PlaceReviewPage;
  words: PlaceWordTerm[];
};

async function loadPlaceProfile(placeId: string, reviewPage: number): Promise<PlaceProfile | null> {
  const detail = await placeDetail(placeId);
  if (!detail) return null;

  const [themes, reviews, words] = await Promise.all([
    placeThemes(placeId, 12),
    placeReviews(placeId, { page: reviewPage, pageSize: 10 }),
    placeWordTerms(placeId, 40),
  ]);

  return { detail, themes, reviews, words };
}

// A place profile is four queries against review data that barely changes intra-day, and the same
// place is opened, closed and reopened constantly in the explorer — so cache it per place + review
// page. Repeat opens are then instant and never re-hit Neon (faster slide-overs, lower DB load).
const cachedPlaceProfile = unstable_cache(loadPlaceProfile, ["place-profile"], { revalidate: 600 });

export async function getPlaceProfile(placeId: string, reviewPage = 1): Promise<PlaceProfile | null> {
  return cachedPlaceProfile(placeId, reviewPage);
}
