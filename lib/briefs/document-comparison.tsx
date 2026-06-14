import { Defs, Document, LinearGradient, Page, Rect, StyleSheet, Stop, Svg, Text, View } from "@react-pdf/renderer";
import type { ComparisonContent, ComparisonMeta, ComparisonSuburb } from "./schema";
import { MultiSeriesTrendChart } from "./charts";
import { FONT_MONO, FONT_SANS, PALETTE, RISK_STYLE } from "./theme";

// The comparison brief PDF: a head-to-head of two or three suburbs. Same editorial language and brand
// as the overview document, but built around side-by-side columns, a comparison table with the leader
// of each metric marked, and a multi-suburb trend chart. The figures come from each suburb's
// dashboard context; only the verdict and recommendations are drafted prose.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - 96;

// One hue per suburb, reusing the year-on-year palette so the document stays on-brand.
const SUBURB_COLORS = PALETTE.years;

const styles = StyleSheet.create({
  cover: { position: "relative", flexDirection: "column", backgroundColor: "#0b1220", color: "#ffffff" },
  coverBody: { flex: 1, paddingHorizontal: 48, paddingVertical: 54, flexDirection: "column", justifyContent: "space-between" },
  wordmark: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmarkDot: { width: 16, height: 16, borderRadius: 5, backgroundColor: PALETTE.positive },
  wordmarkText: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#ffffff" },
  coverKicker: { fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: "#9ca3af", textTransform: "uppercase", marginBottom: 10 },
  coverTitle: { fontFamily: FONT_SANS, fontSize: 34, fontWeight: 700, color: "#ffffff", lineHeight: 1.08 },
  coverSub: { fontFamily: FONT_SANS, fontSize: 12, color: "#cbd5e1", marginTop: 10 },
  coverChips: { flexDirection: "row", gap: 10, marginTop: 24, flexWrap: "wrap" },
  chip: { borderWidth: 0.7, borderColor: "rgba(255,255,255,0.22)", borderRadius: 7, paddingVertical: 8, paddingHorizontal: 11, minWidth: 120 },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 5 },
  chipLabel: { fontFamily: FONT_SANS, fontSize: 7.5, color: "#cbd5e1", letterSpacing: 0.3 },
  chipValue: { fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500, color: "#ffffff", marginTop: 3 },

  page: { backgroundColor: PALETTE.paper, paddingTop: 44, paddingBottom: 48, paddingHorizontal: 48, fontFamily: FONT_SANS, fontSize: 10, color: PALETTE.graphite, lineHeight: 1.55 },

  pull: { borderLeftWidth: 3, borderLeftColor: PALETTE.brand, backgroundColor: PALETTE.cream, borderRadius: 6, padding: 14, marginBottom: 14 },
  pullText: { fontFamily: FONT_SANS, fontSize: 12.5, color: PALETTE.ink, lineHeight: 1.45 },
  pullAttr: { fontFamily: FONT_MONO, fontSize: 7.5, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
  lede: { fontSize: 11, color: PALETTE.slate, marginBottom: 16, lineHeight: 1.5 },

  sectionHead: { marginTop: 18, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.7, borderBottomColor: PALETTE.hairline },
  sectionTitle: { fontFamily: FONT_SANS, fontSize: 9, fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 1.4 },
  sectionSub: { fontFamily: FONT_SANS, fontSize: 8.5, color: PALETTE.faint, marginTop: 3, lineHeight: 1.4 },
  paragraph: { marginBottom: 6 },

  // Side-by-side suburb columns
  colRow: { flexDirection: "row", gap: 8 },
  col: { flex: 1, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, padding: 11, backgroundColor: "#ffffff" },
  colHead: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  colDot: { width: 9, height: 9, borderRadius: 3 },
  colName: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: 700, color: PALETTE.ink },
  colBig: { fontFamily: FONT_MONO, fontSize: 24, fontWeight: 500, color: PALETTE.ink },
  colBigUnit: { fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.muted },
  badge: { alignSelf: "flex-start", borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginTop: 4, marginBottom: 6 },
  badgeText: { fontFamily: FONT_SANS, fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  colMeta: { fontSize: 8.5, color: PALETTE.muted, marginTop: 2 },

  chartCard: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, backgroundColor: "#ffffff", padding: 12, marginTop: 4 },

  // Comparison table
  table: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: PALETTE.cream, paddingVertical: 6, paddingHorizontal: 8 },
  th: { fontSize: 7, fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  trow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: PALETTE.hairline },
  tMetric: { flex: 1, fontSize: 8.5, color: PALETTE.graphite },
  tCell: { flex: 1, textAlign: "center", fontFamily: FONT_MONO, fontSize: 9 },
  tCellLead: { fontWeight: 700, color: PALETTE.brand },

  // Lists
  leadRow: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
  leadDim: { width: 88, fontSize: 9, fontWeight: 700, color: PALETTE.ink },
  leadBody: { flex: 1, fontSize: 9, color: PALETTE.slate },
  leadLeader: { fontWeight: 700, color: PALETTE.brand },
  gap: { flexDirection: "row", gap: 6, marginBottom: 4 },
  gapDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: PALETTE.brand, marginTop: 5 },
  gapText: { flex: 1, fontSize: 9.5, color: PALETTE.slate },

  recCard: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderLeftWidth: 3, borderRadius: 8, padding: 11, marginBottom: 7, backgroundColor: "#ffffff" },
  recName: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, color: PALETTE.ink, marginBottom: 2 },
  recStanding: { fontSize: 9, color: PALETTE.muted, marginBottom: 4 },

  footerLeft: { position: "absolute", bottom: 26, left: 48, fontFamily: FONT_SANS, fontSize: 7, color: PALETTE.faint, textTransform: "uppercase", letterSpacing: 1 },
  footerRight: { position: "absolute", bottom: 26, right: 48, fontFamily: FONT_MONO, fontSize: 7, color: PALETTE.muted },
});

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

// The leader index for a metric, by whether higher or lower is better. Returns -1 on a tie so no cell
// is falsely highlighted.
function leaderIndex(values: number[], higherIsBetter: boolean): number {
  let best = values[0];
  let index = 0;
  for (let i = 1; i < values.length; i += 1) {
    if ((higherIsBetter && values[i] > best) || (!higherIsBetter && values[i] < best)) {
      best = values[i];
      index = i;
    }
  }
  const ties = values.filter((value) => value === best).length;
  return ties > 1 ? -1 : index;
}

export function ComparisonDocument({ content, meta }: { content: ComparisonContent; meta: ComparisonMeta }) {
  const suburbs = meta.suburbs;
  const colorFor = (index: number) => SUBURB_COLORS[index % SUBURB_COLORS.length];
  const titleNames = suburbs.map((s) => s.areaName).join(" vs ");

  const rows: { label: string; values: number[]; format: (value: number) => string; higher: boolean }[] = [
    { label: "Satisfaction /100", values: suburbs.map((s) => s.satisfaction100), format: (v) => v.toFixed(0), higher: true },
    { label: "Avg rating /5", values: suburbs.map((s) => s.avgRating), format: (v) => v.toFixed(1), higher: true },
    { label: "Reviews", values: suburbs.map((s) => s.totalReviews), format: (v) => v.toLocaleString(), higher: true },
    { label: "Positive %", values: suburbs.map((s) => s.positivePct), format: (v) => `${v.toFixed(0)}%`, higher: true },
    { label: "Negative %", values: suburbs.map((s) => s.negativePct), format: (v) => `${v.toFixed(0)}%`, higher: false },
  ];

  const trendSeries = suburbs.map((s, index) => ({ label: s.areaName, color: colorFor(index), points: s.trend }));

  return (
    <Document title={`PlacePulse comparison: ${titleNames}`} author="PlacePulse">
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
            <Text style={styles.coverKicker}>Suburb Comparison Brief</Text>
            <Text style={styles.coverTitle}>{titleNames}</Text>
            <Text style={styles.coverSub}>
              {meta.category === "overall" ? "All categories" : meta.category} | {meta.period}
            </Text>
            <View style={styles.coverChips}>
              {suburbs.map((s, index) => (
                <View key={s.areaName} style={styles.chip}>
                  <View style={[styles.chipDot, { backgroundColor: colorFor(index) }]} />
                  <Text style={styles.chipLabel}>{s.areaName}</Text>
                  <Text style={styles.chipValue}>{s.satisfaction100.toFixed(0)}/100</Text>
                </View>
              ))}
            </View>
          </View>
          <View />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text fixed style={styles.footerLeft} render={({ pageNumber }) => (pageNumber > 1 ? "PlacePulse comparison brief" : "")} />
        <Text fixed style={styles.footerRight} render={({ pageNumber, totalPages }) => (pageNumber > 1 ? `${pageNumber} / ${totalPages}` : "")} />

        <View style={styles.pull}>
          <Text style={styles.pullText}>{content.verdict}</Text>
          <Text style={styles.pullAttr}>The verdict</Text>
        </View>

        <Text style={styles.lede}>{content.lede}</Text>

        <View style={styles.colRow} wrap={false}>
          {suburbs.map((s, index) => (
            <SuburbColumn key={s.areaName} suburb={s} color={colorFor(index)} />
          ))}
        </View>

        <View wrap={false}>
          <Section title="Head to head" subtitle="The numbers side by side. The leader of each metric is marked in emerald." />
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 1 }]}>Metric</Text>
              {suburbs.map((s) => (
                <Text key={s.areaName} style={[styles.th, { flex: 1, textAlign: "center" }]}>
                  {s.areaName}
                </Text>
              ))}
            </View>
            {rows.map((row) => {
              const lead = leaderIndex(row.values, row.higher);
              return (
                <View key={row.label} style={styles.trow}>
                  <Text style={styles.tMetric}>{row.label}</Text>
                  {row.values.map((value, index) => (
                    <Text key={index} style={[styles.tCell, index === lead ? styles.tCellLead : {}]}>
                      {row.format(value)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </View>

        <View wrap={false}>
          <Section title="Satisfaction over time" subtitle="Monthly satisfaction for each suburb across the most recent months." />
          <View style={styles.chartCard}>
            <MultiSeriesTrendChart series={trendSeries} width={CONTENT_W - 24} />
          </View>
        </View>

        <Section title="Executive summary" subtitle="The comparison in a paragraph: where each suburb stands on the figures that matter." />
        <Text style={styles.paragraph}>{content.executiveSummary}</Text>

        <View wrap={false}>
          <Section title="Where each leads" subtitle="Who comes out ahead on each dimension, and the figures behind it." />
          {content.whereEachLeads.map((lead, index) => (
            <View key={index} style={styles.leadRow}>
              <Text style={styles.leadDim}>{lead.dimension}</Text>
              <Text style={styles.leadBody}>
                <Text style={styles.leadLeader}>{lead.leader}</Text>
                {"  "}
                {lead.detail}
              </Text>
            </View>
          ))}
        </View>

        {content.decisiveGaps.length > 0 && (
          <View wrap={false}>
            <Section title="The decisive gaps" subtitle="The differences most likely to change a decision." />
            {content.decisiveGaps.map((gap, index) => (
              <View key={index} style={styles.gap}>
                <View style={styles.gapDot} />
                <Text style={styles.gapText}>{gap}</Text>
              </View>
            ))}
          </View>
        )}

        <Section title="What each should do" subtitle="A standing and a concrete recommendation for each suburb." />
        {content.perSuburb.map((entry, index) => {
          const suburbIndex = suburbs.findIndex((s) => s.areaName === entry.areaName);
          const color = colorFor(suburbIndex >= 0 ? suburbIndex : index);
          return (
            <View key={index} style={[styles.recCard, { borderLeftColor: color }]} wrap={false}>
              <Text style={styles.recName}>{entry.areaName}</Text>
              <Text style={styles.recStanding}>{entry.standing}</Text>
              <Text>{entry.recommendation}</Text>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

function SuburbColumn({ suburb, color }: { suburb: ComparisonSuburb; color: string }) {
  const risk = RISK_STYLE[suburb.riskTier];
  return (
    <View style={styles.col}>
      <View style={styles.colHead}>
        <View style={[styles.colDot, { backgroundColor: color }]} />
        <Text style={styles.colName}>{suburb.areaName}</Text>
      </View>
      <Text style={styles.colBig}>
        {suburb.satisfaction100.toFixed(0)}
        <Text style={styles.colBigUnit}>/100</Text>
      </Text>
      <View style={[styles.badge, { backgroundColor: risk.soft }]}>
        <Text style={[styles.badgeText, { color: risk.color }]}>{risk.label}</Text>
      </View>
      <Text style={styles.colMeta}>{suburb.avgRating.toFixed(1)} / 5 average rating</Text>
      <Text style={styles.colMeta}>{suburb.totalReviews.toLocaleString()} reviews</Text>
      <Text style={styles.colMeta}>
        {suburb.positivePct.toFixed(0)}% positive, {suburb.negativePct.toFixed(0)}% negative
      </Text>
      {suburb.topStrength ? (
        <Text style={[styles.colMeta, { marginTop: 5, color: PALETTE.brand }]}>
          Leads on {suburb.topStrength.label} ({suburb.topStrength.pct.toFixed(0)}% positive)
        </Text>
      ) : null}
      {suburb.topWeakness ? (
        <Text style={[styles.colMeta, { color: PALETTE.negative }]}>
          Weakest on {suburb.topWeakness.label} ({suburb.topWeakness.pct.toFixed(0)}% negative)
        </Text>
      ) : null}
    </View>
  );
}
