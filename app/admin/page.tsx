"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Admin panel — open to anyone for now (no auth yet). Uploads the daily report
 * to Neon via /api/upload, and shows who last uploaded + when, plus recent
 * history. Also keeps a "Load test data" button that seeds from the bundled
 * test spreadsheet so the table can be populated without a real export.
 */

interface UploadRow {
  id: number;
  uploaded_by: string;
  uploaded_at: string;
  filename: string | null;
  source: string;
  total_rows: number;
  inserted: number;
  updated: number;
  skipped: number;
}

interface AuditState {
  last: UploadRow | null;
  recent: UploadRow[];
  storedRows: number;
}

const TEST_DATA_URL = "/CURATEDV2-TESTING.xlsx";

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminPage() {
  const [audit, setAudit] = useState<AuditState | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadedBy, setUploadedBy] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/upload", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load history.");
      setAudit(json);
      setAuditError(null);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Failed to load history.");
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const send = useCallback(
    async (file: File, source: "upload" | "test-data") => {
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("uploaded_by", uploadedBy.trim());
        fd.append("source", source);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed.");
        setResult(
          `${json.inserted} new · ${json.updated} updated · ${json.unchanged} unchanged (ignored)` +
            (json.skippedNoId ? ` · ${json.skippedNoId} rows had no inventory id` : "")
        );
        if (fileRef.current) fileRef.current.value = "";
        await loadAudit();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [uploadedBy, loadAudit]
  );

  const onUpload = useCallback(() => {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setError("Choose a .csv or .xlsx file first.");
      return;
    }
    void send(f, "upload");
  }, [send]);

  const onLoadTest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(TEST_DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not fetch the bundled test file.");
      const blob = await res.blob();
      const file = new File([blob], "CURATEDV2-TESTING.xlsx", { type: blob.type });
      await send(file, "test-data");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load test data.");
      setBusy(false);
    }
  }, [send]);

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-5 py-10">
      <div className="top-rule mb-6 w-12" aria-hidden />
      <p className="eyebrow">Admin</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-[var(--ink)]">
        Inventory data uploads
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--ink-dim)]">
        Upload the daily report (.csv or .xlsx). Rows are keyed by inventory id;
        unchanged rows are ignored, changed rows are updated, new rows added.
        Data is stored persistently in Neon.
      </p>

      {/* Last upload summary */}
      <section className="card mt-8 p-5" aria-labelledby="last-upload-h">
        <h2 id="last-upload-h" className="eyebrow mb-3">
          Last upload
        </h2>
        {auditError ? (
          <p className="text-sm text-[rgb(var(--diag))]">{auditError}</p>
        ) : audit?.last ? (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span className="text-[var(--ink)]">
              <span aria-hidden>● </span>
              {audit.last.uploaded_by}
            </span>
            <span className="text-[var(--ink-dim)]">{fmtWhen(audit.last.uploaded_at)}</span>
            <span className="text-[var(--ink-faint)]">
              {audit.last.inserted} new · {audit.last.updated} updated · {audit.last.skipped} unchanged
              {audit.last.source === "test-data" ? " · test data" : ""}
            </span>
            <span className="text-[var(--ink-faint)]">{audit.storedRows} rows stored</span>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-faint)]">No uploads yet.</p>
        )}
      </section>

      {/* Upload controls */}
      <section className="card mt-5 p-5" aria-labelledby="upload-h">
        <h2 id="upload-h" className="eyebrow mb-4">
          Upload report
        </h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--ink-dim)]">Your name (optional)</span>
            <input
              type="text"
              value={uploadedBy}
              onChange={(e) => setUploadedBy(e.target.value)}
              placeholder="Admin"
              aria-label="Your name"
              className="w-full max-w-xs rounded border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
            />
          </label>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            aria-label="Report file"
            className="block w-full max-w-md text-sm text-[var(--ink-dim)] file:mr-3 file:rounded file:border file:border-[var(--line)] file:bg-[var(--panel-2)] file:px-3 file:py-2 file:text-[var(--ink)]"
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onUpload}
              disabled={busy}
              className="rounded bg-[rgb(var(--brand-strong))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <span aria-hidden>↥ </span>
              {busy ? "Working…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={onLoadTest}
              disabled={busy}
              className="rounded border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-50"
            >
              <span aria-hidden>⚡ </span>
              Load test data
            </button>
          </div>

          {result && (
            <p className="text-sm text-[rgb(var(--ready))]">
              <span aria-hidden>✓ </span>
              {result}
            </p>
          )}
          {error && <p className="text-sm text-[rgb(var(--diag))]">{error}</p>}
        </div>
      </section>

      {/* Recent uploads */}
      <section className="card mt-5 p-5" aria-labelledby="recent-h">
        <h2 id="recent-h" className="eyebrow mb-3">
          Recent uploads
        </h2>
        {audit?.recent?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[var(--ink-faint)]">
                  <th className="py-2 pr-4 font-normal">When</th>
                  <th className="py-2 pr-4 font-normal">By</th>
                  <th className="py-2 pr-4 font-normal">File</th>
                  <th className="py-2 pr-4 font-normal text-right">New</th>
                  <th className="py-2 pr-4 font-normal text-right">Updated</th>
                  <th className="py-2 pr-4 font-normal text-right">Unchanged</th>
                </tr>
              </thead>
              <tbody>
                {audit.recent.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--line)]">
                    <td className="py-2 pr-4 text-[var(--ink-dim)]">{fmtWhen(u.uploaded_at)}</td>
                    <td className="py-2 pr-4 text-[var(--ink)]">{u.uploaded_by}</td>
                    <td className="py-2 pr-4 text-[var(--ink-faint)]">
                      {u.filename || "—"}
                      {u.source === "test-data" ? " (test)" : ""}
                    </td>
                    <td className="py-2 pr-4 text-right text-[var(--ink)]">{u.inserted}</td>
                    <td className="py-2 pr-4 text-right text-[var(--ink)]">{u.updated}</td>
                    <td className="py-2 pr-4 text-right text-[var(--ink-faint)]">{u.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-faint)]">Nothing uploaded yet.</p>
        )}
      </section>
    </main>
  );
}
