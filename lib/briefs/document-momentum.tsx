import { Defs, Document, LinearGradient, Page, Rect, StyleSheet, Stop, Svg, Text, View } from "@react-pdf/renderer";
import type { MomentumContent, MomentumMeta, MomentumMove } from "./schema";
import { YoYBarsChart } from "./charts";
import { FONT_MONO, FONT_SANS, PALETTE, RISK_STYLE } from "./theme";

// The momentum brief PDF: one suburb's year-on-year movement. Same editorial language and brand as
// the overview and comparison documents, but built around the trajectory: a satisfaction delta in
// points, year-on-year bars, and two columns of themes that rose and fell. The figures come from the
// suburb's dashboard context; only the read, summary and recommendations are drafted prose.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - 96;

// The satisfaction delta, formatted as a signed points figure ("+4 pts", "-3 pts") or "n/a" when the
// year-on-year baseline is missing. Kept here so the cover chip and the KPI card read identically.
function formatDeltaPts(deltaPp: number | null): string {
  if (deltaPp == null) return "n/a";
  const rounded = Math.round(deltaPp);
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded)} pts`;
}

const styles = StyleSheet.create({
  cover: { position: "relative", flexDirection: "column", backgroundColor: "#0b1220", color: "#ffffff" },
  coverBody: { flex: 1, paddingHorizontal: 48, paddingVertical: 54, flexDirection: "column", justifyContent: "space-between" },
  wordmark: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmarkDot: { width: 16, height: 16, borderRadius: 5, backgroundColor: PALETTE.positive },
  wordmarkText: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "#ffffff" },
  coverKicker: { fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: "#9ca3af", textTransform: "uppercase", marginBottom: 10 },
  coverTitle: { fontFamily: FONT_SANS, fontSize: 42, fontWeight: 700, color: "#ffffff", lineHeight: 1.05 },
  coverSub: { fontFamily: FONT_SANS, fontSize: 12, color: "#cbd5e1", marginTop: 10 },
  coverChips: { flexDirection: "row", gap: 10, marginTop: 22, flexWrap: "wrap" },
  chip: { borderWidth: 0.7, borderColor: "rgba(255,255,255,0.22)", borderRadius: 7, paddingVertical: 8, paddingHorizontal: 11, minWidth: 96 },
  chipLabel: { fontFamily: FONT_SANS, fontSize: 7.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.4 },
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

  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: { flex: 1, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, padding: 10, backgroundColor: "#ffffff" },
  kpiLabel: { fontSize: 7.5, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontFamily: FONT_MONO, fontSize: 18, fontWeight: 500, color: PALETTE.ink, marginTop: 4 },
  kpiUnit: { fontFamily: FONT_MONO, fontSize: 10, color: PALETTE.muted },
  kpiSub: { fontSize: 8, color: PALETTE.muted, marginTop: 4 },

  chartCard: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, backgroundColor: "#ffffff", padding: 12, marginTop: 4 },

  // Rising and falling columns
  twoCol: { flexDirection: "row", gap: 12, marginTop: 2 },
  col: { flex: 1, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, padding: 11, backgroundColor: "#ffffff" },
  colTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 7 },
  moveRow: { marginBottom: 7 },
  moveTheme: { fontSize: 9.5, fontWeight: 700, color: PALETTE.ink, marginBottom: 1 },
  moveDetail: { fontSize: 9, color: PALETTE.slate, lineHeight: 1.4 },
  moveFig: { fontFamily: FONT_MONO, fontSize: 8, color: PALETTE.muted, marginTop: 2 },
  moveEmpty: { fontSize: 9, color: PALETTE.faint, fontStyle: "italic" },

  // Actions
  actionCard: { flexDirection: "row", gap: 10, borderWidth: 0.7, borderColor: PALETTE.hairline, borderLeftWidth: 3, borderLeftColor: PALETTE.brand, borderRadius: 8, padding: 11, marginBottom: 7, backgroundColor: "#ffffff" },
  actionNum: { fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.brand, width: 16 },
  actionTitle: { fontWeight: 600, color: PALETTE.ink, marginBottom: 1 },

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

function Kpi({ label, value, unit, sub, valueColor }: { label: string; value: string; unit?: string; sub?: string; valueColor?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, valueColor ? { color: valueColor } : {}]}>
        {value}
        {unit ? <Text style={styles.kpiUnit}>{unit}</Text> : null}
      </Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// Builds a lookup from a theme label to its factual year-on-year figures, so each drafted move can
// show the real now-share and points change beside it. Keyed case-insensitively because the drafted
// theme and the data label may differ only in casing.
function figureMap(facts: MomentumMove[]): Map<string, MomentumMove> {
  return new Map(facts.map((fact) => [fact.label.toLowerCase().trim(), fact]));
}

// The factual line for a move: the current share and the points change, written with surrounding
// spaces so no figure ever sits glued to punctuation in these narrow columns.
function moveFigureLine(fact: MomentumMove): string {
  const sign = fact.deltaPp >= 0 ? "+" : "-";
  return `${fact.nowPct.toFixed(0)}% positive now, ${sign}${Math.abs(Math.round(fact.deltaPp))} pts year on year`;
}

function MoveList({ moves, facts, color }: { moves: MomentumContent["risers"]; facts: MomentumMove[]; color: string }) {
  if (moves.length === 0) {
    return <Text style={styles.moveEmpty}>Nothing moved materially.</Text>;
  }
  const lookup = figureMap(facts);
  return (
    <>
      {moves.map((move, index) => {
        const fact = lookup.get(move.theme.toLowerCase().trim());
        return (
          <View key={index} style={styles.moveRow}>
            <Text style={[styles.moveTheme, { color }]}>{move.theme}</Text>
            <Text style={styles.moveDetail}>{move.detail}</Text>
            {fact ? <Text style={styles.moveFig}>{moveFigureLine(fact)}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

export function MomentumDocument({ content, meta }: { content: MomentumContent; meta: MomentumMeta }) {
  const deltaText = formatDeltaPts(meta.satisfactionDeltaPp);
  const deltaColor =
    meta.satisfactionDeltaPp == null
      ? PALETTE.muted
      : meta.satisfactionDeltaPp >= 0
        ? PALETTE.positive
        : PALETTE.negative;
  const risk = RISK_STYLE[meta.satisfaction100 < 40 ? "critical" : meta.satisfaction100 < 55 ? "elevated" : meta.satisfaction100 < 70 ? "watch" : "healthy"];

  return (
    <Document title={`PlacePulse momentum brief: ${meta.areaName}`} author="PlacePulse">
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
            <Text style={styles.coverKicker}>Momentum Brief</Text>
            <Text style={styles.coverTitle}>{meta.areaName}</Text>
            <Text style={styles.coverSub}>
              {meta.category === "overall" ? "All categories" : meta.category} | {meta.period}
            </Text>
            <View style={styles.coverChips}>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>Satisfaction</Text>
                <Text style={styles.chipValue}>{meta.satisfaction100.toFixed(0)}/100</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>Year on year</Text>
                <Text style={styles.chipValue}>{deltaText}</Text>
              </View>
            </View>
          </View>
          <View />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text fixed style={styles.footerLeft} render={({ pageNumber }) => (pageNumber > 1 ? "PlacePulse momentum brief" : "")} />
        <Text fixed style={styles.footerRight} render={({ pageNumber, totalPages }) => (pageNumber > 1 ? `${pageNumber} / ${totalPages}` : "")} />

        <View style={styles.pull}>
          <Text style={styles.pullText}>{content.momentumRead}</Text>
          <Text style={styles.pullAttr}>The trajectory</Text>
        </View>

        <Text style={styles.lede}>{content.lede}</Text>

        <View style={styles.kpiRow}>
          <Kpi label="Satisfaction" value={meta.satisfaction100.toFixed(0)} unit="/100" sub={risk.label} />
          <Kpi label="Year on year" value={deltaText} valueColor={deltaColor} sub="vs last year" />
          <Kpi label="Avg rating" value={meta.avgRating.toFixed(1)} unit="/5" sub="Google reviews" />
          <Kpi label="Reviews" value={meta.totalReviews.toLocaleString()} sub="this period" />
        </View>

        <View wrap={false}>
          <Section title="Satisfaction over the past two years" subtitle="Monthly satisfaction, each calendar month aligned across the most recent years to show the trajectory." />
          <View style={styles.chartCard}>
            <YoYBarsChart trend={meta.trend} width={CONTENT_W - 24} />
          </View>
        </View>

        <Section title="Executive summary" subtitle="What moved most over the year and what it means for the suburb." />
        <Text style={styles.paragraph}>{content.executiveSummary}</Text>

        <View wrap={false}>
          <Section title="What rose and what fell" subtitle="Themes gaining ground year on year, set against those losing it." />
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={[styles.colTitle, { color: PALETTE.brand }]}>Rising</Text>
              <MoveList moves={content.risers} facts={meta.risers} color={PALETTE.brand} />
            </View>
            <View style={styles.col}>
              <Text style={[styles.colTitle, { color: PALETTE.negative }]}>Falling</Text>
              <MoveList moves={content.fallers} facts={meta.fallers} color={PALETTE.negative} />
            </View>
          </View>
        </View>

        <Section title="What to do next" subtitle="Concrete actions to protect the risers and arrest the fallers, each with a specific owner, threshold or timeframe." />
        {content.recommendedActions.map((item, index) => (
          <View key={index} style={styles.actionCard} wrap={false}>
            <Text style={styles.actionNum}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{item.action}</Text>
              <Text>{item.detail}</Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}
