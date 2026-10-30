"use client";

import { Bar, BarChart, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type MonthRow = { m: string; target: number; booked: number | null; forecast: number | null };

export function RevenueChart({ data }: { data: MonthRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
        <ReferenceArea x1="Jan" x2="Mar" fill="#ee8022" fillOpacity={0.06} ifOverflow="extendDomain" />
        <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a857b" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: "#8a857b" }} tickFormatter={(v) => `₹${v}`} width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={{ color: "#fff" }}
          labelStyle={{ color: "#bdb7ad" }}
          cursor={{ fill: "#efece6" }}
          formatter={(v, n) => (v == null ? [] : [`₹${Number(v).toFixed(1)} Cr`, n])}
        />
        <Bar isAnimationActive={false} dataKey="booked" name="Booked" fill="#151515" radius={[4, 4, 0, 0]} />
        <Bar isAnimationActive={false} dataKey="forecast" name="Forecast (weighted)" fill="#ee8022" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
        <Line isAnimationActive={false} type="stepAfter" dataKey="target" name="Target" stroke="#8a857b" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  background: "#151515",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
  padding: "6px 10px",
};

export function ImpactBars({ data }: { data: { m: string; design: number; bd: number; screens: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
        <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a857b" }} />
        <YAxis hide />
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#bdb7ad" }} cursor={{ fill: "#efece6" }} formatter={(v, n) => [`${v} h`, n]} />
        <Bar isAnimationActive={false} dataKey="design" name="Design" stackId="a" fill="#151515" />
        <Bar isAnimationActive={false} dataKey="bd" name="BD / sales" stackId="a" fill="#8a857b" />
        <Bar isAnimationActive={false} dataKey="screens" name="Screens" stackId="a" fill="#ee8022" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
