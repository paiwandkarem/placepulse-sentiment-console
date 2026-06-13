import { notFound } from "next/navigation";
import { MapPin, Star } from "lucide-react";
import { getPlaceProfile } from "@/lib/services/placesService";
import { Pagination } from "@/components/places/Pagination";
import { Card } from "@/components/ui/Card";
import { SENTIMENT_TOKENS } from "@/lib/ui/sentiment";
import type { ReviewSentiment } from "@/lib/types";

// One place's profile: hero, description, theme breakdown, word cloud and paginated reviews. Shared
// by the full page (/places/[id]) and the intercepted slide-over (@modal), so both render identical
// content from the same query. It owns the data fetch and the not-found case.

function asSentiment(value: string): ReviewSentiment {
  return value === "positive" || value === "negative" ? value : "neutral";
}

function sentimentBarColor(value: number): string {
  if (value >= 66) return "bg-emerald-500";
  if (value >= 45) return "bg-amber-500";
  return "bg-rose-500";
}

export async function PlaceProfile({ placeId, reviewPage }: { placeId: string; reviewPage: number }) {
  const profile = await getPlaceProfile(placeId, reviewPage);
  if (!profile) notFound();
  const { detail, themes, reviews, words } = profile;

  const reviewPages = Math.max(1, Math.ceil(reviews.total / reviews.pageSize));
  const maxMentions = Math.max(1, ...words.map((word) => word.mentions));

  function reviewHref(page: number): string {
    const base = `/places/${encodeURIComponent(detail.placeId)}`;
    return page > 1 ? `${base}?rpage=${page}` : base;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-gray-900 lg:text-3xl">{detail.name || "Unnamed place"}</h1>
            {detail.permanentlyClosed && (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
                Closed
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-gray-600">
            {[detail.category, detail.suburb].filter(Boolean).join(" · ")}
          </p>
          {detail.address && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5" />
              {detail.address}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-3">
          <Stat label="Rating" value={detail.rating ? `${detail.rating.toFixed(1)} / 5` : "—"} icon />
          <Stat label="Reviews" value={detail.reviewsCount.toLocaleString()} />
          <Stat label="Themes" value={String(themes.length)} />
        </div>
      </div>

      {detail.description && (
        <Card className="mb-6">
          <p className="text-sm leading-relaxed text-gray-700">{detail.description}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card title="Theme breakdown" subtitle="What reviewers talk about, ranked by the place's own data.">
            {themes.length === 0 ? (
              <p className="text-sm text-gray-500">No themes available for this place.</p>
            ) : (
              <ul className="space-y-3">
                {themes.map((theme) => (
                  <li key={theme.theme}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800">{theme.theme}</span>
                      <span className="text-gray-500">{theme.reviewCount.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full ${sentimentBarColor(theme.avgSentiment100)}`}
                        style={{ width: `${Math.min(100, Math.max(4, theme.avgSentiment100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {words.length > 0 && (
            <Card title="Word cloud" subtitle="The most mentioned terms, coloured by tone.">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {words.map((word) => {
                  const token = SENTIMENT_TOKENS[asSentiment(word.sentiment)];
                  const size = 11 + Math.round((word.mentions / maxMentions) * 12);
                  return (
                    <span key={`${word.term}-${word.sentiment}`} className={token.text} style={{ fontSize: size }}>
                      {word.term}
                    </span>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card
            title="Reviews"
            subtitle={`${reviews.total.toLocaleString()} scored review${reviews.total === 1 ? "" : "s"} held for this place.`}
          >
            {reviews.reviews.length === 0 ? (
              <p className="text-sm text-gray-500">No reviews available for this place.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.reviews.map((review, index) => {
                  const token = SENTIMENT_TOKENS[asSentiment(review.sentiment)];
                  return (
                    <li key={index} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="mb-1.5 flex items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {review.rating ? review.rating.toFixed(1) : "—"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${token.soft}`}>
                          {token.label}
                        </span>
                        {review.date && <span>{review.date}</span>}
                      </div>
                      <p className="text-sm leading-relaxed text-gray-700">{review.text}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <Pagination
              page={reviewPage}
              totalPages={reviewPages}
              hrefFor={reviewHref}
              className="mt-5 border-t border-gray-100 pt-4"
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-center shadow-sm">
      <div className="inline-flex items-center gap-1 text-lg font-bold text-gray-900">
        {icon && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}
