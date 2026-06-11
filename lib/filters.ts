// The dashboard is monthly-only. The category control chooses which aggregate to read: a specific
// category reads the per-category monthly rows; "Overall" (no category) reads the suburb-level
// monthly rows, which roll every category up into one sentiment picture for the suburb. The
// agg_type must always agree with whether a category is present, so this helper is the single
// source of truth for that mapping.

export const MONTHLY_CATEGORY_AGG = "mthly_catg_suburb";
export const MONTHLY_OVERALL_AGG = "mthly_suburb";

export function aggTypeForCategory(category: string | null | undefined): string {
  return category ? MONTHLY_CATEGORY_AGG : MONTHLY_OVERALL_AGG;
}
