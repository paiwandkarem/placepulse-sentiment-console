"use client";

import { useCallback, useState } from "react";
import { SentimentDrivers } from "@/components/dashboard/SentimentDrivers";
import { SentimentReviewsSheet } from "@/components/dashboard/SentimentReviewsSheet";
import type { EnrichedTheme, ReviewSentiment, TopReviewGroups } from "@/lib/types";

// Pairs the drivers card with the reviews drawer and owns the open/close state between them.
// Clicking "Read example reviews" inside the card opens the drawer on the matching side.
export function SentimentDriversSection({
  drivers,
  reviews,
  areaLabel,
}: {
  drivers: EnrichedTheme[];
  reviews: TopReviewGroups;
  areaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<ReviewSentiment>("positive");

  const onReadReviews = useCallback((next: ReviewSentiment) => {
    setSide(next);
    setOpen(true);
  }, []);

  return (
    <>
      <SentimentDrivers drivers={drivers} onReadReviews={onReadReviews} />
      <SentimentReviewsSheet
        open={open}
        onClose={() => setOpen(false)}
        reviews={reviews}
        defaultTab={side}
        areaLabel={areaLabel}
      />
    </>
  );
}
