"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { AXIS, PALETTE, ChartTip } from "./chartTheme";

export interface DonutDatum { name: string; value: number; fill?: string }

export function DonutChart({
  data, money, height,
}: { data: DonutDatum[]; money?: boolean; height?: number }) {
  const shown = data.filter((d) => d.value > 0);
  if (shown.length === 0) return <p className="text-xs text-ink-faint">No data.</p>;
  return (
    <ResponsiveContainer width="100%" height={height ?? "100%"}>
      <PieChart>
        <Pie data={shown} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="#121214" isAnimationActive={false}>
          {shown.map((d, i) => <Cell key={i} fill={d.fill ?? PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip content={<ChartTip money={money} />} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="square" iconSize={9} />
      </PieChart>
    </ResponsiveContainer>
  );
}
