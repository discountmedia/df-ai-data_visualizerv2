"use client";

import { useEffect, useRef, useState } from "react";
import type { InsightsResult } from "@/lib/types";
import { fetchInsights, type InsightsInput } from "@/lib/insightsClient";
import { AiInsightsBody, SourceBadge } from "./AiInsightsBody";

/**
 * Company-wide AI read shown as a focus-trapped modal — fired by the header's
 * "AI Analysis" button. It auto-runs on open (the click IS the opt-in) and reads
 * the whole company: all locations, work stage, sales team, and OCTANE.
 *
 * A11y mirrors UnitsDrawer: aria-modal + labelledby, Esc-closes, Tab is trapped
 * inside, and focus is restored to the opener on close (WCAG 2.4.3 / 2.1.2).
 */
export function AiAnalysisModal({
  title,
  input,
  onClose,
}: {
  title: string;
  input: InsightsInput;
  onClose: () => void;
}) {
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(1); // start at 1 → auto-run immediately on open
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Capture the opener and restore focus to it on close.
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    return () => triggerRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (nonce === 0) return;
    let cancelled = false;
    setLoading(true);
    fetchInsights(input).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ground/95 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="card my-auto w-full max-w-3xl p-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <p id="ai-modal-title" className="eyebrow flex items-center gap-2 text-brand">
              <span aria-hidden="true">✦</span> {title}
            </p>
            <p className="mt-1 text-[13px] text-ink-dim">
              Company-wide read across all locations, work stage, sales team, and OCTANE.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {result && <SourceBadge source={result.source} />}
            <button
              onClick={() => setNonce((n) => n + 1)}
              disabled={loading}
              className="border border-line px-3 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink disabled:opacity-40"
            >
              {loading ? "Reading…" : "Regenerate"}
            </button>
            <button
              onClick={onClose}
              autoFocus
              className="border border-line px-3 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="mt-4">
          {loading && !result ? (
            <p className="text-sm text-ink-dim">Reading the whole company…</p>
          ) : (
            <AiInsightsBody result={result} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
