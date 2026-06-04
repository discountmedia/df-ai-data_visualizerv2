"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import type { ColumnProfile, Row } from "@/lib/types";
import { computePivot, type PivotSpec, type MeasureKind } from "@/lib/pivot";
import { fetchConnection, type ConnectResponse } from "@/lib/connectClient";
import { fmt, fmtMoney, cn } from "@/lib/format";

const AXIS = "#9a9aa0";
const GRID = "#2a2a2e";
const PALETTE = ["#ff2b2b", "#3aa0ff", "#3ddc84", "#ffc02e", "#b07cff", "#ff8a3d", "#9a9aa0"];

const isMoneyCol = (col?: string | null) => !!col && /price|cost|sale|amount|revenue|\$/i.test(col);

interface Props {
  label: string;
  sourceKey: string;
  rows: Row[];
  /** All columns selectable as dimensions/measures for this source. */
  columns: ColumnProfile[];
  /** Sensible starting dimension (a column from the clicked category). */
  defaultDimension?: string;
  onClose?: () => void;
}

export function CategoryExplorer({ label, sourceKey, rows, columns, defaultDimension, onClose }: Props) {
  const numericColumns = useMemo(
    () => columns.filter((c) => c.detectedType === "number" || c.role === "metric"),
    [columns]
  );
  const firstDim = defaultDimension && columns.some((c) => c.name === defaultDimension)
    ? defaultDimension
    : columns[0]?.name ?? "";

  const [spec, setSpec] = useState<PivotSpec>({
    source: sourceKey, dimension: firstDim, breakdown: null, measure: { kind: "count" }, topN: 12,
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<ConnectResponse | null>(null);

  const result = useMemo(() => {
    if (!spec.dimension || !rows.length) return null;
    return computePivot(rows, spec);
  }, [rows, spec]);

  // Validate an AI-proposed spec against the columns we actually have.
  const adoptSpec = (proposed: PivotSpec) => {
    const has = (n?: string | null) => !!n && columns.some((c) => c.name === n);
    const dimension = has(proposed.dimension) ? proposed.dimension : firstDim;
    const breakdown = has(proposed.breakdown) ? proposed.breakdown : null;
    const kind: MeasureKind = ["count", "sum", "avg"].includes(proposed.measure?.kind) ? proposed.measure.kind : "count";
    const column = kind !== "count" && has(proposed.measure?.column) ? proposed.measure!.column! : null;
    setSpec({
      source: sourceKey, dimension, breakdown,
      measure: kind !== "count" && !column ? { kind: "count" } : { kind, column },
      topN: proposed.topN && proposed.topN > 0 ? Math.min(proposed.topN, 25) : 12,
      title: proposed.title,
    });
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true); setAi(null);
    const res = await fetchConnection({
      question: q,
      source: sourceKey,
      columns: columns.map((c) => ({
        name: c.name, role: c.role, type: c.detectedType, samples: c.sampleValues.slice(0, 5).map(String),
      })),
    });
    setAi(res);
    if (res.spec) adoptSpec(res.spec);
    setLoading(false);
  };

  const money = spec.measure.kind !== "count" && isMoneyCol(spec.measure.column);
  const fmtVal = (n: number) => (money ? fmtMoney(n) : fmt(Math.round(n * 100) / 100));

  const chartData = useMemo(
    () => (result ? result.rows.map((r) => ({ name: r.key, ...r.values })) : []),
    [result]
  );
  const grouped = !!spec.breakdown;

  return (
    <section className="mt-4 card border-brand/40 bg-panel-2/40 p-4 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow text-brand">Explore · {label}</p>
          <h2 className="mt-0.5 text-sm font-bold text-ink">Find a connection in this data</h2>
        </div>
        {onClose && <button onClick={onClose} className="text-[11px] uppercase tracking-wider text-ink-dim hover:text-ink">Close ✕</button>}
      </div>

      {/* AI-first: ask in plain English. */}
      <div className="mt-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask: which salesman sells the most of which make? · total sale price by location · …"
            className="flex-1 border border-line bg-ground px-3 py-2 text-xs text-ink placeholder:text-ink-dim focus:border-brand focus-visible:outline-none"
          />
          <button
            onClick={ask}
            disabled={loading || !question.trim()}
            className="bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Thinking…" : "Find it ↗"}
          </button>
        </div>
        {ai?.note && <p className="mt-2 text-[11px] text-working">{ai.note}</p>}
        {ai?.error && <p className="mt-2 text-[11px] text-diag">{ai.error}</p>}
        {ai?.narrative && ai.source === "claude" && (
          <p className="mt-2 border-l-2 border-brand/50 pl-2 text-[11px] leading-relaxed text-ink-dim">
            <span className="font-bold text-brand">AI</span> {ai.narrative}
          </p>
        )}
      </div>

      {/* Manual builder — also the fallback when there's no API key. */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label="Break down by">
          <Select value={spec.dimension} onChange={(v) => setSpec((s) => ({ ...s, dimension: v }))} options={columns.map((c) => c.name)} />
        </Field>
        <Field label="Split (series)">
          <Select value={spec.breakdown ?? ""} onChange={(v) => setSpec((s) => ({ ...s, breakdown: v || null }))} options={["", ...columns.map((c) => c.name)]} placeholderOption="None" />
        </Field>
        <Field label="Measure">
          <Select
            value={spec.measure.kind}
            onChange={(v) => setSpec((s) => ({ ...s, measure: { kind: v as MeasureKind, column: v === "count" ? null : s.measure.column ?? numericColumns[0]?.name ?? null } }))}
            options={["count", "sum", "avg"]}
          />
        </Field>
        <Field label="Of column">
          <Select
            value={spec.measure.column ?? ""}
            onChange={(v) => setSpec((s) => ({ ...s, measure: { ...s.measure, column: v || null } }))}
            options={["", ...numericColumns.map((c) => c.name)]}
            placeholderOption={numericColumns.length ? "—" : "no numeric cols"}
            disabled={spec.measure.kind === "count" || numericColumns.length === 0}
          />
        </Field>
      </div>

      {/* Result */}
      {!result || result.rows.length === 0 ? (
        <p className="mt-4 text-xs text-ink-faint">No values to chart for this selection.</p>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold text-ink">{spec.title || chartTitle(spec)}</p>
            <span className="text-[10px] text-ink-faint">{result.measureLabel} · {fmt(result.consideredRows)} rows</span>
          </div>
          <div className="mt-2 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} tickFormatter={(v) => (money ? fmtMoney(Number(v)) : fmt(Number(v)))} />
                <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={11} width={140} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ background: "#17171a", border: "1px solid #2a2a2e", fontSize: 11 }}
                  formatter={(v: number, n: string) => [fmtVal(Number(v)), n === "value" ? result.measureLabel : n]}
                />
                {grouped && <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="square" iconSize={9} />}
                {result.series.map((s, i) =>
                  grouped ? (
                    <Bar key={s} dataKey={s} name={s} fill={PALETTE[i % PALETTE.length]} isAnimationActive={false} radius={[0, 2, 2, 0]} />
                  ) : (
                    <Bar key={s} dataKey={s} name={result.measureLabel} isAnimationActive={false} radius={[0, 2, 2, 0]}>
                      {chartData.map((_, idx) => <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />)}
                    </Bar>
                  )
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranked table */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-line text-ink-dim">
                  <th className="px-2 py-1.5 font-normal">#</th>
                  <th className="px-2 py-1.5 font-normal">{spec.dimension}</th>
                  {grouped && result.series.map((s) => <th key={s} className="px-2 py-1.5 text-right font-normal">{s}</th>)}
                  <th className="px-2 py-1.5 text-right font-normal">{result.measureLabel}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={r.key} className="border-b border-line/40">
                    <td className="px-2 py-1.5 tabular-nums text-ink-faint">{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium text-ink">{r.key}</td>
                    {grouped && result.series.map((s) => (
                      <td key={s} className="px-2 py-1.5 text-right tabular-nums text-ink-dim">{r.values[s] ? fmtVal(r.values[s]) : "—"}</td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums font-bold text-ink">{fmtVal(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.note && <p className="mt-2 text-[10px] text-ink-faint">{result.note}</p>}
        </div>
      )}
    </section>
  );
}

function chartTitle(spec: PivotSpec): string {
  const m = spec.measure.kind === "count" ? "count" : `${spec.measure.kind} of ${spec.measure.column}`;
  return spec.breakdown
    ? `${m} by ${spec.dimension} × ${spec.breakdown}`
    : `${m} by ${spec.dimension}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Select({
  value, onChange, options, placeholderOption, disabled,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholderOption?: string; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "w-full border border-line bg-ground px-2 py-1.5 text-xs text-ink focus:border-brand focus-visible:outline-none",
        disabled && "opacity-40"
      )}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o === "" ? placeholderOption ?? "None" : o}</option>
      ))}
    </select>
  );
}
