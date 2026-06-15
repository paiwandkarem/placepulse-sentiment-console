import Link from "next/link";
import { MapPin } from "lucide-react";

// Shown when getPlaceProfile calls notFound() for an unknown place id, instead of falling through to
// the generic error boundary. Friendly, on-brand, and points back to the explorer.
export default function PlaceNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
        <MapPin className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-gray-900">Place not found</h1>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        We could not find a place with that id. It may have been removed, or the link may be out of date.
      </p>
      <Link
        href="/places"
        className="mt-5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
      >
        Back to places
      </Link>
    </div>
  );
}
