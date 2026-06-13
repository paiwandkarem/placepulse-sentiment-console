import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Star } from "lucide-react";
import { getPlaceProfile } from "@/lib/services/placesService";
import { Card } from "@/components/ui/Card";
import { SENTIMENT_TOKENS } from "@/lib/ui/sentiment";
import type { ReviewSentiment } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asSentiment(value: string): ReviewSentiment {
  return value === "positive" || value === "negative" ? value : "neutral";
}

// Theme sentiment runs 0 to 100; colour it the way the rest of the app does.
function sentimentBarColor(value: number): string {
  if (value >= 66) return "bg-emerald-500";
  if (value >= 45) return "bg-amber-500";
  return "bg-rose-500";
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPlaceProfile(decodeURIComponent(id));
  return { title: profile ? `${profile.detail.name} | PlacePulse` : "Place | PlacePulse" };
}

export default async function PlacePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const reviewPage = Math.max(1, Number(first(sp.rpage) ?? "1") || 1);

  const profile = await getPlaceProfile(decodeURIComponent(id), reviewPage);
  if (!profile) notFound();
  const { detail, themes, reviews, words } = profile;

  const reviewPages = Math.max(1, Math.ceil(reviews.total / reviews.pageSize));
  const maxMentions = Math.max(1, ...words.map((word) => word.mentions));

  function reviewHref(page: number): string {
    const base = `/places/${encodeURIComponent(detail.placeId)}`;
    return page > 1 ? `${base}?rpage=${page}` : base;
  }

  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <Link href="/places" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        All places
      </Link>

      {/* Hero */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900">{detail.name || "Unnamed place"}</h1>
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
        {/* Themes + words */}
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

        {/* Reviews */}
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

            {reviewPages > 1 && (
              <nav className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                <PageLink href={reviewHref(reviewPage - 1)} disabled={reviewPage <= 1} direction="prev" />
                <span className="text-sm text-gray-500">
                  Page {reviewPage} of {reviewPages.toLocaleString()}
                </span>
                <PageLink href={reviewHref(reviewPage + 1)} disabled={reviewPage >= reviewPages} direction="next" />
              </nav>
            )}
          </Card>
        </div>
      </div>
    </div>
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

function PageLink({ href, disabled, direction }: { href: string; disabled: boolean; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "Previous" : "Next";
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const content = (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
      {direction === "prev" && <Icon className="h-4 w-4" />}
      {label}
      {direction === "next" && <Icon className="h-4 w-4" />}
    </span>
  );
  if (disabled) return <span className="pointer-events-none opacity-40">{content}</span>;
  return <Link href={href}>{content}</Link>;
}
