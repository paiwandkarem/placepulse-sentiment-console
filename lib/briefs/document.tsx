import { Defs, Document, Image, LinearGradient, Page, Rect, StyleSheet, Stop, Svg, Text, View } from "@react-pdf/renderer";
import type { BriefChartData, BriefContent, BriefKeywords, BriefMeta, BriefQuote, BriefThemeRow } from "./schema";
import { DistributionBar, YoYBarsChart } from "./charts";
import { FONT_MONO, FONT_SANS, PALETTE, RISK_STYLE } from "./theme";

// The brief PDF: an editorial intelligence-brief layout (cover, KPI cards with a risk badge, a
// pull-quote, a theme table, customer quotes, numbered actions, page footers) rendered in the app's
// brand. The factual header, metrics, charts, table and quotes come from the data; only the narrative
// is drafted prose. Built with @react-pdf primitives and rendered to a buffer on the server.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - 96; // 48pt padding each side

const styles = StyleSheet.create({
  // Cover. The page carries a solid dark background as a floor, with the gradient drawn over it, so
  // it can never read as blank. The body uses flex:1 to fill the page rather than absolute insets,
  // which react-pdf does not stretch.
  cover: { position: "relative", flexDirection: "column", backgroundColor: "#0b1220", color: "#ffffff" },
  coverBody: { flex: 1, paddingHorizontal: 48, paddingVertical: 54, flexDirection: "column", justifyContent: "space-between" },
  wordmark: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmarkDot: { width: 16, height: 16, borderRadius: 5, backgroundColor: PALETTE.positive },
  wordmarkText: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#ffffff" },
  coverKicker: { fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: "#9ca3af", textTransform: "uppercase", marginBottom: 10 },
  coverTitle: { fontFamily: FONT_SANS, fontSize: 42, fontWeight: 700, color: "#ffffff", lineHeight: 1.05 },
  coverSub: { fontFamily: FONT_SANS, fontSize: 12, color: "#cbd5e1", marginTop: 10 },
  coverChips: { flexDirection: "row", gap: 10, marginTop: 22 },
  chip: { borderWidth: 0.7, borderColor: "rgba(255,255,255,0.22)", borderRadius: 7, paddingVertical: 8, paddingHorizontal: 11, minWidth: 96 },
  chipLabel: { fontFamily: FONT_SANS, fontSize: 7.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4 },
  chipValue: { fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500, color: "#ffffff", marginTop: 3 },
  // Match the static map's 520x240 aspect at the content width so the whole boundary shows uncropped.
  coverMap: { width: CONTENT_W, height: CONTENT_W * (240 / 520), borderRadius: 8, objectFit: "contain" },

  // Content page
  page: { backgroundColor: PALETTE.paper, paddingTop: 44, paddingBottom: 48, paddingHorizontal: 48, fontFamily: FONT_SANS, fontSize: 10, color: PALETTE.graphite, lineHeight: 1.55 },

  pull: { borderLeftWidth: 3, borderLeftColor: PALETTE.brand, backgroundColor: PALETTE.cream, borderRadius: 6, padding: 14, marginBottom: 14 },
  pullText: { fontFamily: FONT_SANS, fontSize: 12.5, color: PALETTE.ink, lineHeight: 1.45 },
  pullAttr: { fontFamily: FONT_MONO, fontSize: 7.5, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },

  lede: { fontSize: 11, color: PALETTE.slate, marginBottom: 16, lineHeight: 1.5 },

  sectionHead: { marginTop: 18, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.7, borderBottomColor: PALETTE.hairline },
  sectionTitle: { fontFamily: FONT_SANS, fontSize: 9, fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 1.4 },
  sectionSub: { fontFamily: FONT_SANS, fontSize: 8.5, color: PALETTE.faint, marginTop: 3, lineHeight: 1.4 },
  paragraph: { marginBottom: 6 },

  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: { flex: 1, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, padding: 10, backgroundColor: "#ffffff" },
  kpiLabel: { fontSize: 7.5, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontFamily: FONT_MONO, fontSize: 18, fontWeight: 500, color: PALETTE.ink, marginTop: 4 },
  kpiUnit: { fontFamily: FONT_MONO, fontSize: 10, color: PALETTE.muted },
  kpiSub: { fontSize: 8, color: PALETTE.muted, marginTop: 4 },

  badge: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginTop: 4 },
  badgeText: { fontFamily: FONT_SANS, fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },

  chartCard: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, backgroundColor: "#ffffff", padding: 12, marginTop: 4 },
  legendRow: { flexDirection: "row", gap: 14, marginTop: 7 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendSwatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 8, color: PALETTE.muted },

  finding: { marginBottom: 8 },
  findingTitle: { fontWeight: 600, color: PALETTE.ink },

  // Theme table
  table: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: PALETTE.cream, paddingVertical: 6, paddingHorizontal: 8 },
  th: { fontSize: 7, fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  trow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: PALETTE.hairline },
  tTheme: { flex: 1, fontSize: 8.5, color: PALETTE.graphite },
  tNum: { width: 46, textAlign: "right", fontFamily: FONT_MONO, fontSize: 8 },
  tBarCell: { width: 74, paddingHorizontal: 6 },
  tBarTrack: { height: 5, borderRadius: 3, backgroundColor: PALETTE.cream },
  tBarFill: { height: 5, borderRadius: 3 },

  // Voice of the customer
  excerpt: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderLeftWidth: 3, borderRadius: 6, padding: 10, marginBottom: 8, backgroundColor: "#ffffff" },
  excerptMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  excerptMetaText: { fontFamily: FONT_MONO, fontSize: 7.5, color: PALETTE.muted },
  excerptQuote: { fontSize: 9.5, color: PALETTE.slate, lineHeight: 1.45 },

  // Strengths and pressure points
  twoCol: { flexDirection: "row", gap: 12, marginTop: 2 },
  col: { flex: 1, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, padding: 11, backgroundColor: "#ffffff" },
  colTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 7 },

  // Driver chips
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  driverChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: "#ffffff" },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabelText: { fontSize: 8.5, color: PALETTE.graphite },

  // Actions
  actionCard: { flexDirection: "row", gap: 10, borderWidth: 0.7, borderColor: PALETTE.hairline, borderLeftWidth: 3, borderLeftColor: PALETTE.brand, borderRadius: 8, padding: 11, marginBottom: 7, backgroundColor: "#ffffff" },
  actionNum: { fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.brand, width: 16 },
  actionTitle: { fontWeight: 600, color: PALETTE.ink, marginBottom: 1 },

  footerLeft: { position: "absolute", bottom: 26, left: 48, fontFamily: FONT_SANS, fontSize: 7, color: PALETTE.faint, textTransform: "uppercase", letterSpacing: 1 },
  footerRight: { position: "absolute", bottom: 26, right: 48, fontFamily: FONT_MONO, fontSize: 7, color: PALETTE.muted },
});

function toneColor(sentiment: BriefQuote["sentiment"]): string {
  if (sentiment === "positive") return PALETTE.positive;
  if (sentiment === "negative") return PALETTE.negative;
  return PALETTE.neutral;
}

function sentTableColor(value: number): string {
  if (value >= 66) return PALETTE.positive;
  if (value >= 45) return PALETTE.amber;
  return PALETTE.negative;
}

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

// Splits prose into tokens and colours the suburb's own positive and negative terms (from the word
// cloud) plus any figures, so paragraphs read with rhythm instead of as grey slabs. Returns nodes to
// drop inside a styled <Text>, so the surrounding text style is inherited.
function richTokens(text: string, keywords: BriefKeywords): React.ReactNode[] {
  const positive = new Set(keywords.positive.map((word) => word.toLowerCase()));
  const negative = new Set(keywords.negative.map((word) => word.toLowerCase()));
  return text.split(/(\s+)/).map((token, index) => {
    if (token === "" || /^\s+$/.test(token)) return token;
    const bare = token.toLowerCase().replace(/[^a-z0-9%/.]/g, "");
    if (/^\d[\d,]*(\.\d+)?(%|\/100|\/5)?$/.test(bare)) {
      return (
        <Text key={index} style={{ fontWeight: 700, color: PALETTE.ink }}>
          {token}
        </Text>
      );
    }
    if (positive.has(bare)) {
      return (
        <Text key={index} style={{ fontWeight: 600, color: PALETTE.brand }}>
          {token}
        </Text>
      );
    }
    if (negative.has(bare)) {
      return (
        <Text key={index} style={{ fontWeight: 600, color: PALETTE.negative }}>
          {token}
        </Text>
      );
    }
    return token;
  });
}

function DriverChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.driverChip}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={styles.chipLabelText}>{label}</Text>
    </View>
  );
}

// Real businesses in the suburb, rendered factually from the POI data (never model-authored), so the
// brief names actual venues without risking an invented place.
export type BriefPlace = { name: string; category: string; rating: number; reviewsCount: number };

export function BriefDocument({
  content,
  meta,
  charts,
  themeRows,
  quotes,
  keywords,
  places,
  mapDataUri,
}: {
  content: BriefContent;
  meta: BriefMeta;
  charts: BriefChartData;
  themeRows: BriefThemeRow[];
  quotes: BriefQuote[];
  keywords: BriefKeywords;
  places: BriefPlace[];
  mapDataUri: string | null;
}) {
  const risk = RISK_STYLE[meta.riskTier];

  return (
    <Document title={`PlacePulse brief: ${meta.areaName}`} author="PlacePulse">
      {/* Cover. The gradient is a fixed background so it is out of the flow and does not push the
          content onto a second page; the body then fills the page over it. */}
      <Page size="A4" style={styles.cover}>
        <View fixed style={{ position: "absolute", top: 0, left: 0, width: PAGE_W, height: PAGE_H }}>
          <Svg width={PAGE_W} height={PAGE_H}>
            <Defs>
              <LinearGradient id="cover" x1="0" y1="0" x2="0.4" y2="1">
                <Stop offset="0" stopColor="#0b1220" />
                <Stop offset="1" stopColor="#064e3b" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill="url(#cover)" />
          </Svg>
        </View>

        <View style={styles.coverBody}>
          <View style={styles.wordmark}>
            <View style={styles.wordmarkDot} />
            <Text style={styles.wordmarkText}>PlacePulse</Text>
          </View>

          <View>
            <Text style={styles.coverKicker}>Sentiment Intelligence Brief</Text>
            <Text style={styles.coverTitle}>{meta.areaName}</Text>
            <Text style={styles.coverSub}>
              {meta.category === "overall" ? "All categories" : meta.category} | {meta.period}
            </Text>
            <View style={styles.coverChips}>
              <Chip label="Satisfaction" value={`${meta.satisfaction100.toFixed(0)}/100`} />
              <Chip label="Avg rating" value={`${meta.avgRating.toFixed(1)}/5`} />
              <Chip label="Reviews" value={meta.totalReviews.toLocaleString()} />
              <Chip label="Status" value={risk.label} />
            </View>
          </View>

          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {mapDataUri ? <Image style={styles.coverMap} src={mapDataUri} /> : <View />}
        </View>
      </Page>

      {/* Content */}
      <Page size="A4" style={styles.page}>
        <Text fixed style={styles.footerLeft} render={({ pageNumber }) => (pageNumber > 1 ? "PlacePulse sentiment brief" : "")} />
        <Text fixed style={styles.footerRight} render={({ pageNumber, totalPages }) => (pageNumber > 1 ? `${pageNumber} / ${totalPages}` : "")} />

        <View style={styles.pull}>
          <Text style={styles.pullText}>{richTokens(content.riskRead, keywords)}</Text>
          <Text style={styles.pullAttr}>Operator risk signal</Text>
        </View>

        <Text style={styles.lede}>{richTokens(content.lede, keywords)}</Text>

        <View style={styles.kpiRow}>
          <Kpi label="Satisfaction" value={meta.satisfaction100.toFixed(0)} unit="/100" badge={<RiskBadge label={risk.label} color={risk.color} soft={risk.soft} />} />
          <Kpi label="Avg rating" value={meta.avgRating.toFixed(1)} unit="/5" sub="Google reviews" />
          <Kpi label="Reviews" value={meta.totalReviews.toLocaleString()} sub="this period" />
          <Kpi label="Themes tracked" value={String(meta.themesTracked)} sub="standardised" />
        </View>

        <Section title="Executive summary" subtitle="The headline read: where the suburb stands, the direction of travel, and the main strength and risk." />
        <Text style={styles.paragraph}>{richTokens(content.executiveSummary, keywords)}</Text>

        <View wrap={false}>
          <Section title="How has sentiment moved over time?" subtitle="Monthly satisfaction, each calendar month aligned across the most recent years to show the trajectory." />
          <View style={styles.chartCard}>
            <YoYBarsChart trend={charts.trend} width={CONTENT_W - 24} />
          </View>
        </View>

        <View wrap={false}>
          <Section title="Review sentiment split" subtitle="The share of reviews that read as positive, neutral or negative in the latest month." />
          <View style={styles.chartCard}>
            <DistributionBar distribution={charts.distribution} width={CONTENT_W - 24} />
            <View style={styles.legendRow}>
              <Legend color={PALETTE.positive} label={`Positive ${charts.distribution.positive.toFixed(0)}%`} />
              <Legend color={PALETTE.neutral} label={`Neutral ${charts.distribution.neutral.toFixed(0)}%`} />
              <Legend color={PALETTE.negative} label={`Negative ${charts.distribution.negative.toFixed(0)}%`} />
            </View>
          </View>
        </View>

        {themeRows.length > 0 && (
          <View wrap={false}>
            <Section title="Theme breakdown" subtitle="What customers talk about, ranked by review volume, with each theme's positive and negative counts." />
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { flex: 1 }]}>Theme</Text>
                <Text style={[styles.th, { width: 46, textAlign: "right" }]}>Reviews</Text>
                <Text style={[styles.th, { width: 46, textAlign: "right" }]}>Score</Text>
                <Text style={[styles.th, { width: 74, paddingHorizontal: 6 }]}>Volume</Text>
                <Text style={[styles.th, { width: 46, textAlign: "right" }]}>Pos</Text>
                <Text style={[styles.th, { width: 46, textAlign: "right" }]}>Neg</Text>
              </View>
              {themeRows.map((row, index) => (
                <View key={index} style={styles.trow}>
                  <Text style={styles.tTheme}>{row.label}</Text>
                  <Text style={styles.tNum}>{row.reviews.toLocaleString()}</Text>
                  <Text style={[styles.tNum, { color: sentTableColor(row.sentiment100) }]}>{row.sentiment100.toFixed(0)}</Text>
                  <View style={styles.tBarCell}>
                    <View style={styles.tBarTrack}>
                      <View style={[styles.tBarFill, { width: `${row.volumePct}%`, backgroundColor: sentTableColor(row.sentiment100) }]} />
                    </View>
                  </View>
                  <Text style={[styles.tNum, { color: PALETTE.positive }]}>+{row.positiveCount.toLocaleString()}</Text>
                  <Text style={[styles.tNum, { color: PALETTE.negative }]}>-{row.negativeCount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(content.whatIsWorking.length > 0 || content.whatNeedsAttention.length > 0) && (
          <View wrap={false}>
            <Section title="Strengths and pressure points" subtitle="The themes working in the suburb's favour, and the ones dragging sentiment down." />
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={[styles.colTitle, { color: PALETTE.brand }]}>What is working</Text>
                <View style={styles.chipWrap}>
                  {content.whatIsWorking.map((item, index) => (
                    <DriverChip key={index} label={item} color={PALETTE.positive} />
                  ))}
                </View>
              </View>
              <View style={styles.col}>
                <Text style={[styles.colTitle, { color: PALETTE.negative }]}>What needs attention</Text>
                <View style={styles.chipWrap}>
                  {content.whatNeedsAttention.map((item, index) => (
                    <DriverChip key={index} label={item} color={PALETTE.negative} />
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {quotes.length > 0 && (
          <>
            <Section title="Voice of the customer" subtitle="Real review excerpts behind the numbers, chosen to match the themes above. Negatives first, as the most actionable." />
            {quotes.map((quote, index) => (
              <View key={index} style={[styles.excerpt, { borderLeftColor: toneColor(quote.sentiment) }]} wrap={false}>
                <View style={styles.excerptMeta}>
                  <Text style={[styles.excerptMetaText, { color: toneColor(quote.sentiment) }]}>
                    {quote.rating != null ? `${quote.rating.toFixed(1)} stars  ` : ""}
                    {quote.sentiment.toUpperCase()}
                    {quote.sentiment100 != null ? `  ${quote.sentiment100.toFixed(0)}/100` : ""}
                  </Text>
                </View>
                <Text style={styles.excerptQuote}>&quot;{richTokens(quote.text, keywords)}&quot;</Text>
              </View>
            ))}
          </>
        )}

        {places.length > 0 && (
          <View wrap={false}>
            <Section title="Most-reviewed places" subtitle="The businesses drawing the most Google reviews in this suburb, with their rating and review volume. Read straight from the place data, not generated." />
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { flex: 1 }]}>Place</Text>
                <Text style={[styles.th, { width: 110 }]}>Category</Text>
                <Text style={[styles.th, { width: 44, textAlign: "right" }]}>Rating</Text>
                <Text style={[styles.th, { width: 52, textAlign: "right" }]}>Reviews</Text>
              </View>
              {places.map((place, index) => (
                <View key={index} style={styles.trow}>
                  <Text style={styles.tTheme}>{place.name}</Text>
                  <Text style={{ width: 110, fontSize: 8, color: PALETTE.muted }}>{place.category}</Text>
                  <Text style={styles.tNum}>{place.rating ? place.rating.toFixed(1) : "-"}</Text>
                  <Text style={[styles.tNum, { width: 52 }]}>{place.reviewsCount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Section title="What to do next" subtitle="Concrete actions that follow from the findings, each with a specific owner, threshold or timeframe." />
        {content.recommendedActions.map((item, index) => (
          <View key={index} style={styles.actionCard} wrap={false}>
            <Text style={styles.actionNum}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{item.action}</Text>
              <Text>{richTokens(item.detail, keywords)}</Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function Kpi({ label, value, unit, sub, badge }: { label: string; value: string; unit?: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>
        {value}
        {unit ? <Text style={styles.kpiUnit}>{unit}</Text> : null}
      </Text>
      {badge ?? (sub ? <Text style={styles.kpiSub}>{sub}</Text> : null)}
    </View>
  );
}

function RiskBadge({ label, color, soft }: { label: string; color: string; soft: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: soft }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}
