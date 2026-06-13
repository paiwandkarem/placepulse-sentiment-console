"use client";

import { useEffect } from "react";

// Last-resort boundary for failures in the root layout itself. It must render its own html and
// body because it replaces the whole document when it fires.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#111827",
        }}
      >
        <div role="alert" style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>The application failed to load. Please try again.</p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.25rem",
              background: "#111827",
              color: "#fff",
              border: 0,
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
