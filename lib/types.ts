export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type BriefJobStatus = "running" | "completed" | "failed";
export type EvalStatus = "pass" | "fail" | "warn";

// The three concrete sentiment buckets the data is grouped into (no "mixed" in the source).
export type ReviewSentiment = "positive" | "negative" | "neutral";

// A theme's breakdown for a slice (from theme_sentiment_json). The source doesn't carry a
// single sentiment label. It carries the split across positive/negative/neutral, so we keep
// the percentages and let the UI derive a dominant label.
export type ThemeSentiment = {
  theme: string;
  reviews: number;
  mentions: number;
  positiveReviews: number;
  negativeReviews: number;
  neutralReviews: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  avgSentiment: number;
  avgSimilarity: number;
};

// Which side of the drivers card a theme falls on: overwhelmingly praised, overwhelmingly
// criticised, or genuinely split.
export type DriverBucket = "working" | "not_working" | "mixed";

// A theme classified into a bucket and ranked within it, with the same-period-last-year
// comparison merged in when a prior-year slice exists. The optional *LastYear / *Delta fields
// stay absent (hasYoy false) when there is no prior-year row to compare against.
export type EnrichedTheme = ThemeSentiment & {
  label: string;
  uiBucket: DriverBucket | null;
  uiRankInBucket: number | null;
  hasYoy: boolean;
  positivePctLastYear?: number;
  negativePctLastYear?: number;
  neutralPctLastYear?: number;
  positivePctDelta?: number;
  negativePctDelta?: number;
  neutralPctDelta?: number;
  reviewsTotalLastYear?: number;
};

// A common term lifted from review text (from word_cloud_json). The source key is `term`, and
// sentiment is carried over from the group the term belonged to.
export type WordCloudTerm = {
  term: string;
  mentions: number;
  reviews: number;
  sharePct: number;
  sentiment: ReviewSentiment;
};

export type WordCloudGroups = {
  positive: WordCloudTerm[];
  negative: WordCloudTerm[];
  neutral: WordCloudTerm[];
};

// A representative review quote (from top_reviews_json). Sentiment comes from the group it
// sits in; sentiment100 is the model's 0 to 100 score for the individual review.
export type ReviewEvidence = {
  id?: string;
  placeId?: string;
  text: string;
  rating?: number;
  sentiment: ReviewSentiment;
  sentiment100?: number;
  date?: string;
};

export type TopReviewGroups = {
  positive: ReviewEvidence[];
  negative: ReviewEvidence[];
  neutral: ReviewEvidence[];
};

export type SentimentRecord = {
  queryKey: string;
  aggType: string;
  date: string;
  areaName: string;
  category: string;
  poiCount: number;
  reviewedPoiCount: number;
  totalReviews: number;
  textSignalReviews: number;
  themeReviewCount: number;
  avgRating: number;
  starRatingSentiment100: number;
  reviewTextSentiment100: number;
  overallSatisfaction100: number;
  positiveReviews: number;
  negativeReviews: number;
  neutralReviews: number;
  unknownReviews: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  unknownPct: number;
  oneStarPct: number;
  twoStarPct: number;
  threeStarPct: number;
  fourStarPct: number;
  fiveStarPct: number;
  unratedPct: number;
  reviewCoveragePct: number;
  textSignalCoveragePct: number;
  themeCoveragePct: number;
  ratingTextConflictCount: number;
  ratingTextConflictPct: number;
  themes: ThemeSentiment[];
  wordCloud: WordCloudGroups;
  topReviews: TopReviewGroups;
};

export type SentimentFilters = {
  aggType?: string;
  areaName?: string;
  category?: string;
  date?: string;
};

// Category is optional: absent means the suburb-level overall aggregate (all categories rolled
// together). aggType, area and date are always resolved.
export type RequiredSentimentFilters = Required<Pick<SentimentFilters, "aggType" | "areaName" | "date">> &
  Pick<SentimentFilters, "category">;

export type CategorySentiment = {
  category: string;
  overallSatisfaction100: number;
  totalReviews: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  overallSatisfaction100LastYear?: number;
};

export type SentimentTrendPoint = {
  date: string;
  overallSatisfaction100: number;
  avgRating: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  totalReviews: number;
};

export type SentimentComparison = {
  base: SentimentRecord;
  comparison: SentimentRecord;
  delta: {
    overallSatisfaction100: number;
    avgRating: number;
    positivePct: number;
    negativePct: number;
    totalReviews: number;
  };
};

export type FilterCatalogue = {
  aggTypes: string[];
  areaNames: string[];
  categories: string[];
  dates: string[];
  minDate?: string;
  maxDate?: string;
};

export type SentimentDashboardContext = {
  filters: RequiredSentimentFilters;
  record: SentimentRecord;
  trend: SentimentTrendPoint[];
  availableFilters: FilterCatalogue;
  // Themes classified and ranked for the drivers card, with same-period-last-year deltas
  // merged in. Computed in the service so the client ships no bucketing logic.
  drivers: EnrichedTheme[];
  // Every category's sentiment for the area at the latest month; powers the category breakdown section and the rank chip.
  categoryBreakdown: CategorySentiment[];
};

export type BriefJob = {
  id: string;
  status: BriefJobStatus;
  title: string;
  filters: RequiredSentimentFilters;
  content?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type EvalCase = {
  id: string;
  name: string;
  description: string;
  status: EvalStatus;
  expected: string;
  actual?: string;
};