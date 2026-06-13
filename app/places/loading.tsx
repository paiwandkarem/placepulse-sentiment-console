import { Spinner } from "@/components/ui/Spinner";

// Streamed while the explorer shell (the category list) loads; the map then hydrates client-side.
export default function Loading() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-gray-50">
      <Spinner />
    </div>
  );
}
