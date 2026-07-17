"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Full-screen modal shell for the KPI / coverage drill-downs. Owns the a11y:
 * aria-modal + labelled title, Tab/Shift+Tab focus trap, Esc-closes, and focus
 * restored to the opener on close (WCAG 2.4.3 / 2.1.2). One drawer is open at a
 * time. The body is a flex child so a `fill` DataTable stretches to height.
 */
export function Drawer({ title, subtitle, onClose, children }: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    return () => triggerRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) { e.preventDefault(); last.focus(); }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <p id="drawer-title" className="eyebrow text-brand">{title}</p>
            {subtitle != null && <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>}
          </div>
          <button
            autoFocus
            onClick={onClose}
            className="shrink-0 border border-line px-3 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink"
          >
            ✕ Close
          </button>
        </div>
        <div className="min-h-0 flex-1 pt-3">{children}</div>
      </div>
    </div>
  );
}
