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
          className="mt-4 border border-line px-4 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Production idle state: the app is loaded and ready, waiting for PRO
 * (FileMaker) to push the inventory + staff data. `onSimulate`, when provided
 * (dev only), reprojects the bundled export into the PRO contract and pushes it
 * through the real bridge path so the flow can be exercised without FileMaker.
 */
export function WaitingState({ onSimulate }: { onSimulate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-rent"
            style={{ animation: "fade-up 900ms ease-in-out infinite alternate", animationDelay: `${i * 160}ms` }} />
        ))}
      </div>
      <div>
        <p className="eyebrow">Waiting for PRO</p>
        <p className="mt-2 max-w-sm text-[13px] text-ink-faint">
          Connected and ready to receive. Inventory data will appear here as soon as PRO sends it.
        </p>
      </div>
      {onSimulate && (
        <button onClick={onSimulate}
          className="mt-1 border border-line px-4 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
          Simulate PRO push (test data)
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, className }: { title: string; hint?: string; className?: string }) {
  return (
    <div className={cn("py-16 text-center", className)}>
      <p className="eyebrow">{title}</p>
      {hint && <p className="mt-2 text-[13px] text-ink-faint">{hint}</p>}
    </div>
  );
}
