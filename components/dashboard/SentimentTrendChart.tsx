"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import type { SentimentTrendPoint } from "@/lib/types";

// Recharts measures the DOM to size itself, so the chart has to run on the client. The data
// it plots is still computed and passed down from the server — only the rendering is client
// side. The Y axis is pinned to 0–100 because overall satisfaction is a 0–100 score, which
// keeps the scale stable as the user changes filters.
export function SentimentTrendChart({ trend }: { trend: SentimentTrendPoint[] }) {
  return (
    <Card className="h-[360px]">
      <h2 className="text-lg font-semibold">Sentiment trend</h2>
      <div className="mt-4 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="overallSatisfaction100" stroke="currentColor" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
