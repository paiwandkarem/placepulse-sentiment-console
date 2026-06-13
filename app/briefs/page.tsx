import type { Metadata } from "next";
import { listAvailableFilters } from "@/lib/services/sentimentService";
import { listBriefJobs } from "@/lib/briefs/repository";
import { BriefsView } from "@/components/briefs/BriefsView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Briefs | PlacePulse",
  description: "Generate and view executive sentiment briefs for Queensland suburbs.",
};

// The list reflects jobs that change in the background, so this page is always rendered fresh rather
// than cached. The client view then polls while any brief is still generating.
export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const [catalogue, briefs] = await Promise.all([listAvailableFilters(), listBriefJobs()]);

  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <div className="mb-6">
        <PageHeader
          title="Briefs"
          subtitle="Generate an executive PDF brief for a suburb. The figures are drawn from the data; the summary, findings and recommendations are written from those figures."
        />
      </div>

      <BriefsView
        areaNames={catalogue.areaNames}
        categories={catalogue.categories}
        initialBriefs={briefs}
      />
    </div>
  );
}
