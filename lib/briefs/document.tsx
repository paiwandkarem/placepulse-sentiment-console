import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BriefContent, BriefMeta } from "./schema";

// The PDF layout for a brief. Built with @react-pdf primitives (not HTML), rendered to a buffer on
// the server and uploaded to Blob. The factual header (meta) prints the real figures; the narrative
// sections (content) are the drafted, grounded prose. Helvetica is the built-in font, so there is no
// font registration or network fetch at render time.

const COLORS = {
  ink: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  brand: "#047857",
  rose: "#be123c",
};

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: COLORS.ink, lineHeight: 1.5 },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold", color: COLORS.brand, letterSpacing: 1 },
  metaLine: { fontSize: 9, color: COLORS.muted, marginTop: 2 },
  headline: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 10, lineHeight: 1.25 },
  metricsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  metric: { flex: 1, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, padding: 10 },
  metricValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  metricLabel: { fontSize: 8, color: COLORS.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  paragraph: { marginBottom: 6 },
  finding: { marginBottom: 8 },
  findingTitle: { fontFamily: "Helvetica-Bold" },
  twoCol: { flexDirection: "row", gap: 18, marginTop: 4 },
  col: { flex: 1 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: COLORS.muted, borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 8 },
});

function Bullet({ children, color }: { children: string; color?: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={[styles.bulletDot, color ? { color } : {}]}>-</Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function BriefDocument({ content, meta }: { content: BriefContent; meta: BriefMeta }) {
  return (
    <Document title={`PlacePulse brief: ${meta.areaName}`} author="PlacePulse">
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.brand}>PLACEPULSE SENTIMENT BRIEF</Text>
          <Text style={styles.metaLine}>
            {meta.areaName} ({meta.category}) | {meta.period}
          </Text>
        </View>

        <Text style={styles.headline}>{content.headline}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{meta.satisfaction100.toFixed(0)}/100</Text>
            <Text style={styles.metricLabel}>Satisfaction</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{meta.avgRating.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Avg rating</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{meta.totalReviews.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Reviews</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {meta.positivePct.toFixed(0)}% / {meta.negativePct.toFixed(0)}%
            </Text>
            <Text style={styles.metricLabel}>Positive / negative</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Executive summary</Text>
        <Text style={styles.paragraph}>{content.executiveSummary}</Text>

        <Text style={styles.sectionTitle}>Key findings</Text>
        {content.keyFindings.map((finding, index) => (
          <View key={index} style={styles.finding}>
            <Text style={styles.findingTitle}>{finding.title}</Text>
            <Text>{finding.detail}</Text>
          </View>
        ))}

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>What is working</Text>
            {content.whatIsWorking.map((item, index) => (
              <Bullet key={index} color={COLORS.brand}>
                {item}
              </Bullet>
            ))}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>What needs attention</Text>
            {content.whatNeedsAttention.map((item, index) => (
              <Bullet key={index} color={COLORS.rose}>
                {item}
              </Bullet>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recommended actions</Text>
        {content.recommendedActions.map((item, index) => (
          <Bullet key={index}>{item}</Bullet>
        ))}

        <Text style={styles.footer} fixed>
          Generated by PlacePulse from Queensland Google review data. Figures are drawn from the
          selected suburb and period.
        </Text>
      </Page>
    </Document>
  );
}
