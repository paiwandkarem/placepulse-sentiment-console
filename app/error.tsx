"use client";

import { useEffect } from "react";

// Route-level error boundary. Render-time faults that are not handled as expected empty states
// (a Neon outage, a SQL fault, a schema drift) land here instead of Next's default screen. The
// error is logged so failures stay observable, and the user gets a styled retry.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        The dashboard could not load. This is usually temporary. Try again, and if it keeps happening the data
        service may be unavailable.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
