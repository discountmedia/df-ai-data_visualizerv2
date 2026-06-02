"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body style={{ background: "#0a0a0b", color: "#f2f2f3", fontFamily: "ui-monospace, monospace", padding: 24 }}>
        <p style={{ color: "#ff3b46", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Fatal render error (layout)</p>
        <p style={{ marginTop: 8, fontSize: 14 }}>{error.message || "Unknown error"}</p>
        {error.digest && <p style={{ marginTop: 4, fontSize: 11, color: "#5e5e66" }}>digest: {error.digest}</p>}
        {error.stack && (
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, color: "#9a9aa0", maxHeight: 300, overflow: "auto" }}>
            {error.stack}
          </pre>
        )}
        <button onClick={reset} style={{ marginTop: 16, border: "1px solid #2a2a2e", padding: "6px 16px", background: "transparent", color: "#9a9aa0", fontSize: 12 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
