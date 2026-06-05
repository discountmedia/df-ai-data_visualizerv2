"use client";

import { useRef, useState, type DragEvent } from "react";
import { useDashboard } from "./DashboardProvider";
import { cn } from "@/lib/format";

export function FileUpload() {
  const { loadFile, loadSample } = useDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 fade-up">
      <p className="eyebrow text-brand">Inventory Intelligence</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Load a fleet export to begin</h1>
      <p className="mt-2 text-sm text-ink-dim">
        Drop a messy .xlsx / .xls / .csv export. We parse it in the browser, then infer the schema with
        AI — you review and veto columns before any scoring runs.
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mt-6 flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed py-14 text-center transition-colors",
          dragging ? "border-brand bg-brand/5" : "border-line hover:border-ink-dim"
        )}
      >
        <span className="text-3xl text-ink-faint">↥</span>
        <p className="text-sm text-ink">Drag & drop, or <span className="text-brand">browse</span></p>
        <p className="text-[13px] text-ink-faint">.xlsx · .xls · .csv</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" /><span className="eyebrow">or</span><span className="h-px flex-1 bg-line" />
      </div>
      <button onClick={loadSample}
        className="mt-4 w-full border border-line py-2.5 text-[13px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
        Load messy sample data (multi-table)
      </button>
    </div>
  );
}
