"use client";

import {
  ResponsiveContainer, ScatterChart, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Scatter, Legend,
} from "recharts";
import { AXIS, GRID, PALETTE } from "./chartTheme";
import { toNumber } from "@/lib/pivot";
import { fmt, fmtMoney } from "@/lib/format";
import type { Row } from "@/lib/types";

/** Scatter of two numeric columns from raw rows, optionally coloured by a category. */
export function ScatterPanel({
  rows, x, y, colorBy, money, height,
}: {
  rows: Row[]; x: string; y: string; colorBy?: string;
  money?: { x?: boolean; y?: boolean }; height?: number;
}) {
  const groups = new Map<string, { x: number; y: number }[]>();
  for (const r of rows) {
    const xv = toNumber(r[x]); const yv = toNumber(r[y]);
    if (Number.isNaN(xv) || Number.isNaN(yv)) continue;
    const key = colorBy ? (r[colorBy] != null && r[colorBy] !== "" ? String(r[colorBy]) : "—") : "all";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push({ x: xv, y: yv });
  }
  const series = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 7);
  const total = series.reduce((s, [, pts]) => s + pts.length, 0);
  if (total === 0) return <p className="text-[13px] text-ink-faint">No numeric pairs to plot for {x} × {y}.</p>;

  const xf = (v: number) => (money?.x ? fmtMoney(v) : fmt(v));
  const yf = (v: number) => (money?.y ? fmtMoney(v) : fmt(v));
  return (
    <ResponsiveContainer width="100%" height={height ?? "100%"}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name={x} stroke={AXIS} fontSize={11} tickLine={false} tickFormatter={xf}
          label={{ value: x, position: "insideBottom", offset: -8, fill: AXIS, fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name={y} stroke={AXIS} fontSize={11} tickLine={false} width={64} tickFormatter={yf} />
        <ZAxis range={[34, 34]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ background: "#17171a", border: "1px solid #2a2a2e", fontSize: 11 }}
          formatter={(v: number, n: string) => [n === "y" ? yf(v) : n === "x" ? xf(v) : v, n === "y" ? y : n === "x" ? x : n]} />
        {colorBy && series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="circle" iconSize={8} />}
        {series.map(([key, pts], i) => (
          <Scatter key={key} name={key} data={pts} fill={PALETTE[i % PALETTE.length]} isAnimationActive={false} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
