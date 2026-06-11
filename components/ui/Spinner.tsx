// Compact concentric-arc spinner for inline waits (filter changes, on-demand fetches). The
// full-screen first paint uses streamed skeletons instead; this is for client interactions
// where the layout already exists and only the data is refreshing.

const SIZES = { sm: 16, md: 22, lg: 32 } as const;

export function Spinner({ size = "md", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const px = SIZES[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
      className={`animate-spin text-emerald-600 ${className}`}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
