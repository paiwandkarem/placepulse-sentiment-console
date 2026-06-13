// Loading placeholder. Size it via className (e.g. "h-40 w-full") at the call site so the
// skeleton matches the shape of whatever it stands in for.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}
