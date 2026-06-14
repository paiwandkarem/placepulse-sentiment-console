import { Defs, Document, LinearGradient, Page, Rect, StyleSheet, Stop, Svg, Text, View } from "@react-pdf/renderer";
import type { CategoryContent, CategoryMeta, CategoryRankRow } from "./schema";
import { FONT_MONO, FONT_SANS, PALETTE } from "./theme";

// The category deep-dive brief PDF: a ranking of Queensland suburbs for one category. Same editorial
// language and brand as the overview and comparison documents, but built around two ranked tables
// (the leaders and the laggards), a two-column read of what the leaders do well against the
// watch-outs, and numbered actions. The figures come from the category ranking; only the read and
// recommendations are drafted prose.

const PAGE_W = 595.28;
const PAGE_H = 841.89;

// The satisfaction figure's colour in the tables: emerald when healthy, amber when soft, rose when
// poor. Deterministic, mirroring the table colouring in the overview document.
function satColor(value: number): string {
  if (value >= 66) return PALETTE.positive;
  if (value >= 45) return PALETTE.amber;
  return PALETTE.negative;
}

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

  // Ranked table
  table: { borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: PALETTE.cream, paddingVertical: 6, paddingHorizontal: 8 },
  th: { fontSize: 7, fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  trow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: PALETTE.hairline },
  tRank: { width: 30, fontFamily: FONT_MONO, fontSize: 9, color: PALETTE.muted },
  tSuburb: { flex: 1, fontSize: 8.5, color: PALETTE.graphite },
  tNum: { width: 66, textAlign: "right", fontFamily: FONT_MONO, fontSize: 9 },

  // Two-column read
  twoCol: { flexDirection: "row", gap: 12, marginTop: 2 },
  col: { flex: 1, borderWidth: 0.7, borderColor: PALETTE.hairline, borderRadius: 8, padding: 11, backgroundColor: "#ffffff" },
  colTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 7 },
  listItem: { flexDirection: "row", gap: 6, marginBottom: 5 },
  listDot: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  listText: { flex: 1, fontSize: 9, color: PALETTE.slate, lineHeight: 1.4 },

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

function RankTable({ rows }: { rows: CategoryRankRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.thead}>
        <Text style={[styles.th, { width: 30 }]}>Rank</Text>
        <Text style={[styles.th, { flex: 1 }]}>Suburb</Text>
        <Text style={[styles.th, { width: 66, textAlign: "right" }]}>Satisfaction /100</Text>
        <Text style={[styles.th, { width: 66, textAlign: "right" }]}>Positive %</Text>
        <Text style={[styles.th, { width: 66, textAlign: "right" }]}>Reviews</Text>
      </View>
      {rows.map((row, index) => (
        <View key={row.areaName} style={styles.trow}>
          <Text style={styles.tRank}>{index + 1}</Text>
          <Text style={styles.tSuburb}>{row.areaName}</Text>
          <Text style={[styles.tNum, { color: satColor(row.satisfaction100), fontWeight: 700 }]}>{row.satisfaction100.toFixed(0)}</Text>
          <Text style={styles.tNum}>{row.positivePct.toFixed(0)}%</Text>
          <Text style={styles.tNum}>{row.totalReviews.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

export function CategoryDocument({ content, meta }: { content: CategoryContent; meta: CategoryMeta }) {
  const topSuburb = meta.topSuburbs[0];

  return (
    <Document title={`PlacePulse category deep-dive: ${meta.category}`} author="PlacePulse">
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
            <Text style={styles.coverKicker}>Category Deep-Dive Brief</Text>
            <Text style={styles.coverTitle}>{meta.category}</Text>
            <Text style={styles.coverSub}>{meta.period}</Text>
            <View style={styles.coverChips}>
              {topSuburb ? (
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>Top suburb: {topSuburb.areaName}</Text>
                  <Text style={styles.chipValue}>{topSuburb.satisfaction100.toFixed(0)}/100</Text>
                </View>
              ) : null}
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>Ranked</Text>
                <Text style={styles.chipValue}>{meta.suburbCount} suburbs ranked</Text>
              </View>
            </View>
          </View>
          <View />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text fixed style={styles.footerLeft} render={({ pageNumber }) => (pageNumber > 1 ? "PlacePulse category brief" : "")} />
        <Text fixed style={styles.footerRight} render={({ pageNumber, totalPages }) => (pageNumber > 1 ? `${pageNumber} / ${totalPages}` : "")} />

        <View style={styles.pull}>
          <Text style={styles.pullText}>{content.categoryRead}</Text>
          <Text style={styles.pullAttr}>The read</Text>
        </View>

        <Text style={styles.lede}>{content.lede}</Text>

        <View wrap={false}>
          <Section title="Top suburbs" subtitle="The highest-ranked suburbs for this category, by satisfaction out of 100." />
          <RankTable rows={meta.topSuburbs} />
        </View>

        <View wrap={false}>
          <Section title="Lowest-ranked suburbs" subtitle="The suburbs trailing the field for this category, where the work is." />
          <RankTable rows={meta.bottomSuburbs} />
        </View>

        <Section title="Executive summary" subtitle="How this category performs across the ranked suburbs, in a paragraph." />
        <Text style={styles.paragraph}>{content.executiveSummary}</Text>

        {(content.whatLeadersDoWell.length > 0 || content.watchOuts.length > 0) && (
          <View wrap={false}>
            <Section title="Leaders and watch-outs" subtitle="The patterns the top-ranked suburbs share, set against what drags the laggards down." />
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={[styles.colTitle, { color: PALETTE.brand }]}>What the leaders do well</Text>
                {content.whatLeadersDoWell.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <View style={[styles.listDot, { backgroundColor: PALETTE.positive }]} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.col}>
                <Text style={[styles.colTitle, { color: PALETTE.negative }]}>Watch-outs</Text>
                {content.watchOuts.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <View style={[styles.listDot, { backgroundColor: PALETTE.negative }]} />
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <Section title="What to do next" subtitle="Concrete actions for a team working this category, each following from the ranking." />
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
