"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  type TooltipProps,
} from "recharts";
import type { UnitRecord, SaleBucket } from "@/lib/types";
import { SALE_LABEL, SALE_HEX } from "@/lib/buckets";
import { fmt } from "@/lib/format";

const AXIS = "#9a9aa0";
const GRID = "#2a2a2e";

const SALE_ORDER: SaleBucket[] = ["paid_in_full", "down_payment", "govt_po", "rental", "other"];

function ChartTip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line bg-panel-2 px-3 py-2 text-[11px] shadow-card">
      {label != null && <p className="mb-1 font-bold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 text-ink-dim">
          <span className="inline-block h-2 w-2" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto tabular-nums text-ink">{fmt(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function Panel({ title, hint, ariaLabel, children }: { title: string; hint?: string; ariaLabel?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{title}</p>
        {hint && <span className="text-[10px] text-ink-faint">{hint}</span>}
      </div>
      <div className="mt-3 h-56 w-full" {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : null)}>{children}</div>
    </section>
  );
}

export function OverviewCharts({ units }: { units: UnitRecord[] }) {
  const saleData = useMemo(() => {
    const counts = new Map<SaleBucket, number>();
    for (const u of units) if (u.sale !== "unknown") counts.set(u.sale, (counts.get(u.sale) ?? 0) + 1);
    return SALE_ORDER.filter((b) => (counts.get(b) ?? 0) > 0).map((b) => ({
      name: SALE_LABEL[b],
      count: counts.get(b) ?? 0,
      fill: SALE_HEX[b],
    }));
  }, [units]);

  const brandData = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of units) if (u.make) m.set(u.make, (m.get(u.make) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [units]);

  const hasSale = saleData.length > 0;
  const hasBrand = brandData.length > 0;
  if (!hasSale && !hasBrand) return null;

  return (
    <section className="space-y-3">
      <p className="eyebrow">Charts</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {hasSale && (
          <Panel
            title="Sales by Payment Type"
            hint="committed units"
            ariaLabel={`Bar chart, sales by payment type, committed units: ${saleData.map((d) => `${d.name} ${d.count}`).join(", ")}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={saleData} margin={{ top: 4, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="name" stroke={AXIS} fontSize={11} tickLine={false} interval={0} />
                <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="Units" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {saleData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {hasBrand && (
          <Panel
            title="Inventory by Brand"
            hint="top makes · unit count"
            ariaLabel={`Bar chart, inventory by brand, top makes by unit count: ${brandData.map((d) => `${d.name} ${d.count}`).join(", ")}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" stroke={AXIS} fontSize={11} allowDecimals={false} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={11} width={96} tickLine={false} axisLine={false} interval={0} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="Units" radius={[0, 2, 2, 0]} fill="#3aa0ff" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}
      </div>
    </section>
  );
}
