import { Spinner } from "@/components/ui/Spinner";
import { MAP_STATUS_COPY } from "@/lib/map/config";

// The single loading / error / no-token overlay shared by both maps, so a map in a non-ready state
// looks and reads the same wherever it appears. Covers the map container; the map renders beneath.
export function MapStatusOverlay({ status }: { status: "loading" | "error" | "no-token" }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 text-sm text-gray-700">
      {status === "loading" ? (
        <Spinner />
      ) : (
        <span>{status === "error" ? MAP_STATUS_COPY.error : MAP_STATUS_COPY.noToken}</span>
      )}
    </div>
  );
}
