"use client";

import type { ReactNode } from "react";
import { openExternal } from "@/lib/openExternal";

/**
 * A link to an external site (product listing, walkaround video, etc.) that is
 * SAFE inside the chromeless FileMaker Web Viewer: clicking never navigates the
 * viewer away from the app (which would strand the user). Renders a real anchor
 * (keeps semantics + middle-click in a normal browser), but the click is handled
 * by openExternal() — see lib/openExternal.
 */
export function ExternalLink({ href, children, className, ariaLabel }: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={(e) => { e.preventDefault(); openExternal(href); }}
      className={className}
    >
      {children}
    </a>
  );
}
