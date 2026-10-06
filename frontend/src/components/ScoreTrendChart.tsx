"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Scan } from "@/lib/types";

/** Posture score over time for one account; expects scans newest-first as the API returns them. */
export function ScoreTrendChart({ scans }: { scans: Scan[] }) {
  const points = scans
    .filter((s) => s.status === "succeeded" && s.score !== null)
    .slice()
    .reverse()
    .map((s) => ({
      label: new Date(s.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      time: new Date(s.started_at).toLocaleString(),
      score: s.score,
    }));

  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-slate-500">The trend appears after two completed scans.</p>;
  }

  return (
    <div className="h-64 w-full" role="img" aria-label="Posture score trend">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value) => [value, "Score"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload.time ?? ""}
            contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e2e8f0" }}
          />
          <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
