import { cn } from "@/lib/format";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-brand"
            style={{ animation: "fade-up 700ms ease-in-out infinite alternate", animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mx-auto max-w-xl border-diag/40 bg-diag/5 p-6 text-center">
      <p className="eyebrow text-diag">Error</p>
      <p className="mt-2 text-sm text-ink">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-4 border border-line px-4 py-1.5 text-xs uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cn("py-16 text-center", className)}>
      <p className="eyebrow">{title}</p>
      {hint && <p className="mt-2 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
