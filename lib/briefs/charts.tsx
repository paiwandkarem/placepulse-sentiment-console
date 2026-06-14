import { Line, Rect, Svg, Text } from "@react-pdf/renderer";
import type { BriefChartData } from "./schema";
import { FONT_SANS, PALETTE } from "./theme";

// Deterministic charts for the brief PDF, drawn with @react-pdf SVG primitives. The year-on-year
// grouped bars mirror the dashboard's over-time chart; the split bar uses the sentiment palette.
// Every value comes from the data.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GRID = [0, 25, 50, 75, 100];

function clamp100(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// Year-on-year grouped bars: each calendar month sits side by side across the most recent years,
// newest year in brand emerald, exactly as the dashboard renders it.
export function YoYBarsChart({ trend, width = 499 }: { trend: BriefChartData["trend"]; width?: number }) {
  if (trend.length < 2) return null;
  const height = 150;
  const padL = 20;
  const padR = 8;
  const padT = 10;
  const padB = 38;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const byDate = new Map(trend.map((point) => [point.date, point.value]));
  const years = [...new Set(trend.map((point) => point.date.slice(0, 4)))].sort().slice(-3);
  const colors = PALETTE.years.slice(PALETTE.years.length - years.length);

  const groupW = chartW / 12;
  const innerPad = groupW * 0.16;
  const barW = (groupW - innerPad * 2) / years.length;

  const bars: React.ReactElement[] = [];
  MONTHS.forEach((_, monthIndex) => {
    const mm = String(monthIndex + 1).padStart(2, "0");
    years.forEach((year, yearIndex) => {
      const value = byDate.get(`${year}-${mm}-01`);
      if (value == null) return;
      const barHeight = (clamp100(value) / 100) * chartH;
      const x = padL + monthIndex * groupW + innerPad + yearIndex * barW;
      const y = padT + chartH - barHeight;
      bars.push(
        <Rect key={`${monthIndex}-${yearIndex}`} x={x + 0.4} y={y} width={Math.max(1, barW - 0.8)} height={barHeight} fill={colors[yearIndex]} rx={1.2} />,
      );
    });
  });

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {GRID.map((value) => {
        const y = padT + (1 - value / 100) * chartH;
        return <Line key={`grid${value}`} x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={PALETTE.hairline} strokeWidth={0.5} />;
      })}
      {GRID.map((value) => {
        const y = padT + (1 - value / 100) * chartH;
        return (
          <Text key={`gridlabel${value}`} x={padL - 4} y={y + 2} fill={PALETTE.faint} textAnchor="end" style={{ fontSize: 6, fontFamily: FONT_SANS }}>
            {String(value)}
          </Text>
        );
      })}
      {bars}
      {MONTHS.map((month, index) => (
        <Text key={`m${index}`} x={padL + index * groupW + groupW / 2} y={padT + chartH + 12} fill={PALETTE.muted} textAnchor="middle" style={{ fontSize: 6, fontFamily: FONT_SANS }}>
          {month}
        </Text>
      ))}
      {years.map((year, index) => {
        const swatchX = padL + index * 56;
        const legendY = height - 8;
        return [
          <Rect key={`ls${index}`} x={swatchX} y={legendY - 6} width={8} height={8} fill={colors[index]} rx={1.5} />,
          <Text key={`lt${index}`} x={swatchX + 12} y={legendY + 1} fill={PALETTE.muted} style={{ fontSize: 7, fontFamily: FONT_SANS }}>
            {year}
          </Text>,
        ];
      })}
    </Svg>
  );
}

// Grouped bars comparing several suburbs' satisfaction over the most recent months, one colour per
// suburb. The same grouped-bar idiom as the year-on-year chart, but the groups are months and the
// series are suburbs, so two or three trajectories read side by side.
export function MultiSeriesTrendChart({
  series,
  width = 499,
}: {
  series: { label: string; color: string; points: { date: string; value: number }[] }[];
  width?: number;
}) {
  const months = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort().slice(-12);
  if (months.length === 0 || series.length === 0) return null;
  const height = 172;
  const padL = 20;
  const padR = 8;
  const padT = 10;
  const padB = 58;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maps = series.map((s) => new Map(s.points.map((point) => [point.date, point.value])));
  const groupW = chartW / months.length;
  const innerPad = groupW * 0.16;
  const barW = (groupW - innerPad * 2) / series.length;
  const monthLabel = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(2, 4)}`;

  const bars: React.ReactElement[] = [];
  months.forEach((date, monthIndex) => {
    series.forEach((s, seriesIndex) => {
      const value = maps[seriesIndex].get(date);
      if (value == null) return;
      const barHeight = (clamp100(value) / 100) * chartH;
      const x = padL + monthIndex * groupW + innerPad + seriesIndex * barW;
      const y = padT + chartH - barHeight;
      bars.push(<Rect key={`${monthIndex}-${seriesIndex}`} x={x + 0.3} y={y} width={Math.max(1, barW - 0.6)} height={barHeight} fill={s.color} rx={1} />);
    });
  });

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {GRID.map((value) => {
        const y = padT + (1 - value / 100) * chartH;
        return <Line key={`grid${value}`} x1={padL} y1={y} x2={padL + chartW} y2={y} stroke={PALETTE.hairline} strokeWidth={0.5} />;
      })}
      {GRID.map((value) => {
        const y = padT + (1 - value / 100) * chartH;
        return (
          <Text key={`gl${value}`} x={padL - 4} y={y + 2} fill={PALETTE.faint} textAnchor="end" style={{ fontSize: 6, fontFamily: FONT_SANS }}>
            {String(value)}
          </Text>
        );
      })}
      {bars}
      {months.map((date, index) =>
        index % 2 === 0 || months.length <= 6 ? (
          <Text key={`m${index}`} x={padL + index * groupW + groupW / 2} y={padT + chartH + 12} fill={PALETTE.muted} textAnchor="middle" style={{ fontSize: 5.5, fontFamily: FONT_SANS }}>
            {monthLabel(date)}
          </Text>
        ) : null,
      )}
      {series.map((s, index) => {
        const swatchX = padL + index * 118;
        const legendY = height - 8;
        return [
          <Rect key={`ls${index}`} x={swatchX} y={legendY - 6} width={8} height={8} fill={s.color} rx={1.5} />,
          <Text key={`lt${index}`} x={swatchX + 12} y={legendY + 1} fill={PALETTE.muted} style={{ fontSize: 7, fontFamily: FONT_SANS }}>
            {s.label}
          </Text>,
        ];
      })}
    </Svg>
  );
}

export function DistributionBar({ distribution, width = 499 }: { distribution: BriefChartData["distribution"]; width?: number }) {
  const total = Math.max(1, distribution.positive + distribution.negative + distribution.neutral);
  const height = 14;
  const segments = [
    { value: distribution.positive, color: PALETTE.positive },
    { value: distribution.neutral, color: PALETTE.neutral },
    { value: distribution.negative, color: PALETTE.negative },
  ];

  let cursor = 0;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {segments.map((segment, index) => {
        const segmentWidth = (segment.value / total) * width;
        const x = cursor;
        cursor += segmentWidth;
        return <Rect key={index} x={x} y={0} width={Math.max(0, segmentWidth)} height={height} fill={segment.color} />;
      })}
    </Svg>
  );
}
