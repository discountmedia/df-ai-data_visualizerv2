"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * Click-to-copy hover affordance. Right-click is disabled in the production Web
 * Viewer (a shipped deterrent), so this is the only way for users to copy
 * serials, listing/video URLs, rep email/phone, customer names, etc. Renders the
 * display content with a hover/focus-revealed copy control and a ✓ on success.
 *
 * Real <button> with an aria-label so it's keyboard- and screen-reader-usable.
 * If `value` is empty it renders children (or nothing) with no affordance.
 */
export function CopyText({ value, children, label, className, buttonClassName }: {
  value: string | null | undefined;
  children?: ReactNode;
  /** Appended to the aria-label, e.g. label="serial 030H" → "Copy serial 030H". */
  label?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = value == null ? "" : String(value).trim();

  const copy = useCallback(async () => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts / older WebView2 builds.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — no-op rather than throw inside the viewer */
    }
  }, [text]);

  // Nothing to copy → render the display content untouched.
  if (!text) return <>{children ?? null}</>;

  return (
    <span className={cn("group/copy inline-flex items-center gap-1", className)}>
      <span>{children ?? text}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy${label ? ` ${label}` : ""}`}
        className={cn(
          "shrink-0 text-[11px] uppercase tracking-wide text-ink-faint opacity-0 transition-opacity",
          "hover:text-ink focus-visible:opacity-100 group-hover/copy:opacity-100",
          copied && "opacity-100 text-ready",
          buttonClassName,
        )}
      >
        <span aria-hidden="true">{copied ? "✓" : "copy"}</span>
      </button>
    </span>
  );
}
