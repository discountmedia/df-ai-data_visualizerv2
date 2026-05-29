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
  Legend,
  type TooltipProps,
} from "recharts";
import type { UnitRecord, WorkBucket, SaleBucket } from "@/lib/types";
import { WORK_LABEL, WORK_HEX, SALE_LABEL, SALE_HEX } from "@/lib/buckets";
import { fmt } from "@/lib/format";

const AXIS = "#9a9aa0";
const GRID = "#2a2a2e";

const WORK_ORDER: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];
const SALE_ORDER: SaleBucket[] = ["paid_in_full", "down_payment", "govt_po", "rental", "other"];
const STACK_BUCKETS: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent"];

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

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{title}</p>
        {hint && <span className="text-[10px] text-ink-faint">{hint}</span>}
      </div>
      <div className="mt-3 h-56 w-full">{children}</div>
    </section>
  );
}

export function OverviewCharts({ units }: { units: UnitRecord[] }) {
  const workData = useMemo(() => {
    const counts = new Map<WorkBucket, number>();
    for (const u of units) counts.set(u.work, (counts.get(u.work) ?? 0) + 1);
    return WORK_ORDER.filter((b) => (counts.get(b) ?? 0) > 0).map((b) => ({
      name: WORK_LABEL[b],
      count: counts.get(b) ?? 0,
      fill: WORK_HEX[b],
    }));
  }, [units]);

  const saleData = useMemo(() => {
    const counts = new Map<SaleBucket, number>();
    for (const u of units) if (u.sale !== "unknown") counts.set(u.sale, (counts.get(u.sale) ?? 0) + 1);
    return SALE_ORDER.filter((b) => (counts.get(b) ?? 0) > 0).map((b) => ({
      name: SALE_LABEL[b],
      count: counts.get(b) ?? 0,
      fill: SALE_HEX[b],
    }));
  }, [units]);

  const locData = useMemo(() => {
    type LocRow = { name: string; total: number } & Record<WorkBucket, number>;
    const byLoc = new Map<string, LocRow>();
    const seed = (name: string): LocRow => {
      const r = { name, total: 0 } as LocRow;
      for (const b of STACK_BUCKETS) r[b] = 0;
      return r;
    };
    for (const u of units) {
      if (!STACK_BUCKETS.includes(u.work)) continue;
      const key = u.location ?? "Unassigned";
      const row = byLoc.get(key) ?? seed(key);
      row[u.work] += 1;
      row.total += 1;
      byLoc.set(key, row);
    }
    return Array.from(byLoc.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [units]);

  const hasWork = workData.length > 0;
  const hasSale = saleData.length > 0;
  const hasLoc = locData.length > 0;
  if (!hasWork && !hasSale && !hasLoc) return null;

  return (
    <section className="space-y-3">
      <p className="eyebrow">Charts</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {hasWork && (
          <Panel title="Work-Stage Mix" hint="units per stage">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" stroke={AXIS} fontSize={11} allowDecimals={false} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={11} width={92} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="Units" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                  {workData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {hasSale && (
          <Panel title="Sales by Payment Type" hint="committed units">
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

      </div>

      {hasLoc && (
        <Panel title="Work Stage by Location" hint="top locations · stacked">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={locData} margin={{ top: 4, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" stroke={AXIS} fontSize={11} tickLine={false} interval={0} />
              <YAxis stroke={AXIS} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="square" iconSize={9} />
              {STACK_BUCKETS.map((b) => (
                <Bar key={b} dataKey={b} name={WORK_LABEL[b]} stackId="s" fill={WORK_HEX[b]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}
    </section>
  );
}
