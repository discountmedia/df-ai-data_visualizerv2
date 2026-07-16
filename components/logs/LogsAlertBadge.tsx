"use client";

import { useEffect, useState } from "react";

/**
 * Red notification bubble for the Logs tab. Polls the alert count (FileMaker-UA
 * hits + denied logs logins) since the last time the logs were viewed — tracked
 * in localStorage and reset via the `logs:seen` event that LogsView fires. Shows
 * nothing when the count is zero. Fails silent if logging isn't configured.
 */
export function LogsAlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function check() {
      let since: string | null = null;
      try { since = localStorage.getItem("df_logs_seen"); } catch { /* ignore */ }
      try {
        const res = await fetch(`/api/logs/alerts${since ? `?since=${encodeURIComponent(since)}` : ""}`);
        const data = await res.json();
        if (alive) setCount(typeof data.count === "number" ? data.count : 0);
      } catch { /* leave count as-is */ }
    }
    check();
    const id = setInterval(check, 30_000);
    const onSeen = () => setCount(0);
    window.addEventListener("logs:seen", onSeen);
    return () => { alive = false; clearInterval(id); window.removeEventListener("logs:seen", onSeen); };
  }, []);

  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unseen log alert${count === 1 ? "" : "s"}`}
      className="ml-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-brand-strong px-1 text-[10px] font-bold leading-none text-white"
      style={{ height: 16 }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
