"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { AXIS, GRID, PALETTE, ChartTip } from "./chartTheme";
import { fmt, fmtMoney } from "@/lib/format";

export interface BarsDatum { name: string; [series: string]: number | string }

/**
 * One bar chart for all our cases: single-series (per-bar colours) or
 * multi-series grouped/stacked, vertical (category on X) or horizontal
 * (category on Y, better for long labels like rep / make names).
 */
export function CategoryBars({
  data, series, layout = "vertical", stacked, colors, money, legend, height,
}: {
  data: BarsDatum[];
  series: string[];
  /** "vertical" => horizontal bars (category on Y). "horizontal" => vertical bars. */
  layout?: "vertical" | "horizontal";
  stacked?: boolean;
  /** Array (by series/bar index) or map (series/name → hex). */
  colors?: string[] | Record<string, string>;
  money?: boolean;
  legend?: boolean;
  height?: number;
}) {
  const horizontalBars = layout === "vertical";
  const single = series.length === 1 && !stacked;
  const tickFmt = (v: number) => (money ? fmtMoney(v) : fmt(v));

  const seriesColor = (s: string, i: number) =>
    Array.isArray(colors) ? colors[i % colors.length]
      : (colors && colors[s]) || PALETTE[i % PALETTE.length];
  const cellColor = (name: string, idx: number) =>
    !Array.isArray(colors) && colors && colors[name] ? colors[name]
      : Array.isArray(colors) ? colors[idx % colors.length]
        : PALETTE[idx % PALETTE.length];

  return (
    <ResponsiveContainer width="100%" height={height ?? "100%"}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={!horizontalBars} vertical={horizontalBars} stroke={GRID} />
        {horizontalBars ? (
          <>
            <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} tickFormatter={tickFmt} />
            <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={11} width={130} tickLine={false} axisLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" stroke={AXIS} fontSize={11} tickLine={false} interval={0} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 48 : 24} />
            <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} tickFormatter={tickFmt} />
          </>
        )}
        <Tooltip content={<ChartTip money={money} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        {legend && <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="square" iconSize={9} />}
        {series.map((s, i) =>
          single ? (
            <Bar key={s} dataKey={s} name={s} radius={horizontalBars ? [0, 2, 2, 0] : [2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((d, idx) => <Cell key={idx} fill={cellColor(String(d.name), idx)} />)}
            </Bar>
          ) : (
            <Bar key={s} dataKey={s} name={s} stackId={stacked ? "s" : undefined}
              fill={seriesColor(s, i)} radius={horizontalBars ? [0, 2, 2, 0] : [2, 2, 0, 0]} isAnimationActive={false} />
          )
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
