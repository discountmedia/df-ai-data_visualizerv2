"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 fade-up">
      <p className="eyebrow text-diag">Something broke while rendering</p>
      <h1 className="mt-2 text-lg font-bold text-ink">The dashboard hit an error</h1>
      <div className="mt-4 card border-diag/40 bg-diag/5 p-4">
        <p className="text-sm text-ink">{error.message || "Unknown error"}</p>
        {error.digest && <p className="mt-1 text-[11px] text-ink-faint">digest: {error.digest}</p>}
        {error.stack && (
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-dim">
            {error.stack}
          </pre>
        )}
      </div>
      <button onClick={reset}
        className="mt-4 border border-line px-4 py-1.5 text-xs uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
        Try again
      </button>
    </div>
  );
}
