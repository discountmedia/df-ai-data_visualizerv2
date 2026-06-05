"use client";

import type { TooltipProps } from "recharts";
import { fmt, fmtMoney } from "@/lib/format";

/** Shared recharts theme constants + tooltip, used by every viz primitive. */
export const AXIS = "#9a9aa0";
export const GRID = "#2a2a2e";
export const PALETTE = ["#ff2b2b", "#3aa0ff", "#3ddc84", "#ffc02e", "#b07cff", "#ff8a3d", "#9a9aa0"];

export function ChartTip({
  active, payload, label, money,
}: TooltipProps<number, string> & { money?: boolean }) {
  if (!active || !payload?.length) return null;
  const f = money ? fmtMoney : fmt;
  return (
    <div className="border border-line bg-panel-2 px-3 py-2 text-[13px] shadow-card">
      {label != null && label !== "" && <p className="mb-1 font-bold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.name)} className="flex items-center gap-2 text-ink-dim">
          <span className="inline-block h-2 w-2" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto tabular-nums text-ink">{f(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}
