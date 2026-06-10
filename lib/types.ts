export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type BriefJobStatus = "queued" | "running" | "completed" | "failed";
export type EvalStatus = "pass" | "fail" | "warn";

export type ThemeSentiment = {
  theme: string;
  sentiment: Sentiment;
  reviewCount: number;
  pct?: number;
  score?: number;
  summary?: string;
};

export type WordCloudTerm = {
  text: string;
  value: number;
  sentiment?: Exclude<Sentiment, "mixed">;
};

export type WordCloudGroups = {
  positive: WordCloudTerm[];
  negative: WordCloudTerm[];
  neutral: WordCloudTerm[];
};

export type ReviewEvidence = {
  id?: string;
  text: string;
  rating?: number;
  sentiment: Exclude<Sentiment, "mixed">;
  theme?: string;
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
  startDate?: string;
  endDate?: string;
};

export type RequiredSentimentFilters = Required<Pick<SentimentFilters, "aggType" | "areaName" | "category" | "date">>;

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