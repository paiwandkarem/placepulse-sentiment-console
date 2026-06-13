import "server-only";
import {
  listPlaceCategories,
  placeDetail,
  placeReviews,
  placeThemes,
  placeWordTerms,
  searchPlaces,
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

export async function getPlacesDirectory(opts: {
  query?: string;
  suburb?: string;
  category?: string;
  sort?: "reviews" | "rating";
  page?: number;
}): Promise<PlacesDirectory> {
  const [results, categories] = await Promise.all([searchPlaces(opts), listPlaceCategories()]);
  return { ...results, categories };
}

export type PlaceProfile = {
  detail: PoiPlaceDetail;
  themes: PoiPlaceTheme[];
  reviews: PlaceReviewPage;
  words: PlaceWordTerm[];
};

export async function getPlaceProfile(placeId: string, reviewPage = 1): Promise<PlaceProfile | null> {
  const detail = await placeDetail(placeId);
  if (!detail) return null;

  const [themes, reviews, words] = await Promise.all([
    placeThemes(placeId, 12),
    placeReviews(placeId, { page: reviewPage, pageSize: 10 }),
    placeWordTerms(placeId, 40),
  ]);

  return { detail, themes, reviews, words };
}
