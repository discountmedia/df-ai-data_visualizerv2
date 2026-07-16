"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { cn, fmt } from "@/lib/format";
import { Pager } from "@/components/ui/Pager";
import { SortHeader } from "@/components/ui/SortHeader";

/**
 * Password-gated log viewer. Renders a login panel until the logs session
 * cookie is set, then the sortable/searchable/paginated tables. Used by both the
 * standalone /logs route and the dashboard "Logs" tab. Server types are NOT
 * imported here (that would pull the Neon driver into the client bundle) — the
 * row shape is mirrored locally.
 */

type LogRow = {
  id: string; ts: string; type: string; level: string; name: string;
  message: string | null; ip: string | null; method: string | null; path: string | null;
  user_agent: string | null; filemaker_ua: boolean; duration_ms: number | null; account: string | null;
  meta: Record<string, unknown> | null;
};
type SortKey = "ts" | "type" | "level" | "name" | "ip" | "path" | "duration_ms";
const TABS = [
  { id: "all", label: "All" },
  { id: "auth", label: "Auth & Access" },
  { id: "performance", label: "Performance" },
  { id: "error", label: "Errors" },
  { id: "system", label: "System" },
] as const;

const LEVEL_CLASS: Record<string, string> = {
  alert: "text-brand border-brand/50",
  error: "text-diag border-diag/50",
  warn: "text-working border-working/50",
  info: "text-ink-dim border-line",
};

function markSeen() {
  try {
    localStorage.setItem("df_logs_seen", new Date().toISOString());
    window.dispatchEvent(new Event("logs:seen"));
  } catch { /* storage unavailable */ }
}

export function LogsView() {
  const [phase, setPhase] = useState<"checking" | "login" | "ready" | "unconfigured">("checking");
  const [multiUser, setMultiUser] = useState(false);
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Query state
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("ts");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<LogRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial auth check.
  useEffect(() => {
    fetch("/api/logs/auth")
      .then((r) => r.json())
      .then((d: { configured: boolean; authed: boolean; multiUser?: boolean }) => {
        setMultiUser(!!d.multiUser);
        if (!d.configured) setPhase("unconfigured");
        else setPhase(d.authed ? "ready" : "login");
      })
      .catch(() => setPhase("login"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, sort, order: asc ? "asc" : "desc", page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/logs?${params}`);
      if (res.status === 401) { setPhase("login"); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not load logs."); setRows([]); setTotal(0); return; }
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 50);
    } catch {
      setError("Network error loading logs.");
    } finally {
      setLoading(false);
    }
  }, [type, sort, asc, q, page]);

  // Reload on query change when authed; clear the alert bubble on view.
  useEffect(() => {
    if (phase !== "ready") return;
    markSeen();
    const t = setTimeout(load, q ? 250 : 0); // small debounce for search
    return () => clearTimeout(t);
  }, [phase, load, q]);

  useEffect(() => { setPage(0); }, [type, sort, asc, q]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/logs/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: pw }),
      });
      const data = await res.json();
      if (res.ok) { setPw(""); setUsername(""); setPhase("ready"); }
      else if (res.status === 503) { setPhase("unconfigured"); }
      else setLoginError(data.error ?? "Incorrect password.");
    } catch {
      setLoginError("Network error.");
    }
  }

  async function logout() {
    await fetch("/api/logs/auth", { method: "DELETE" }).catch(() => {});
    setPhase("login");
    setRows([]);
  }

  function onSort(k: SortKey) {
    if (k === sort) setAsc(!asc);
    else { setSort(k); setAsc(false); }
  }

  if (phase === "checking") {
    return <div className="py-16 text-center"><p className="eyebrow">Loading…</p></div>;
  }

  if (phase === "unconfigured") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="eyebrow text-working">Logs not configured</p>
        <p className="mt-2 text-[13px] text-ink-faint">
          Set <code className="text-ink-dim">LOGS_PASSWORD</code> and <code className="text-ink-dim">DATABASE_URL</code> in the
          environment to enable the logs viewer.
        </p>
      </div>
    );
  }

  if (phase === "login") {
    return (
      <form onSubmit={submitLogin} className="mx-auto mt-10 max-w-sm">
        <div className="card p-6">
          <p className="eyebrow text-brand">Logs</p>
          <h1 className="mt-1 text-xl font-bold text-ink">{multiUser ? "Sign in to view logs" : "Enter the logs password"}</h1>
          {multiUser && (
            <input
              type="text"
              aria-label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="mt-4 w-full border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-brand"
              placeholder="Username"
            />
          )}
          <input
            type="password"
            aria-label="Logs password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus={!multiUser}
            autoComplete="current-password"
            className="mt-3 w-full border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-brand"
            placeholder="Password"
          />
          {loginError && <p className="mt-2 text-[13px] text-diag">{loginError}</p>}
          <button
            type="submit"
            className="mt-4 w-full bg-brand-strong px-3 py-2 text-[13px] font-bold uppercase tracking-wider text-white hover:opacity-90"
          >
            Unlock
          </button>
        </div>
      </form>
    );
  }

  // phase === "ready"
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-brand">Logs</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Access, performance &amp; system events</h1>
        </div>
        <button onClick={logout} className="border border-line px-2.5 py-1 text-[13px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
          Log out
        </button>
      </div>

      {/* Type sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            aria-pressed={type === t.id}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors",
              type === t.id ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-72">
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">⌕</span>
          <input
            aria-label="Search logs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, message, IP, path, UA…"
            className="w-full border border-line bg-panel-2 py-1.5 pl-7 pr-7 text-[13px] text-ink placeholder:text-ink-dim focus:border-brand"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint hover:text-ink">✕</button>
          )}
        </div>
        <button onClick={load} className="border border-line px-2.5 py-1 text-[13px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
          ↻ Refresh
        </button>
      </div>

      {error && <div className="card border-diag/40 bg-diag/5 p-3 text-[13px] text-diag">{error}</div>}

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink-dim">
                <th scope="col" className="px-2 py-2"><span className="sr-only">Expand row</span></th>
                <SortHeader label="Time" k="ts" cur={sort} asc={asc} onSort={onSort} />
                <SortHeader label="Type" k="type" cur={sort} asc={asc} onSort={onSort} />
                <SortHeader label="Level" k="level" cur={sort} asc={asc} onSort={onSort} />
                <SortHeader label="Name" k="name" cur={sort} asc={asc} onSort={onSort} />
                <th scope="col" className="px-3 py-2 font-normal">Detail</th>
                <SortHeader label="IP" k="ip" cur={sort} asc={asc} onSort={onSort} />
                <SortHeader label="Path" k="path" cur={sort} asc={asc} onSort={onSort} />
                <SortHeader label="Dur" k="duration_ms" cur={sort} asc={asc} onSort={onSort} num />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-[12px] text-ink-faint">{loading ? "Loading…" : "No log entries."}</td></tr>
              ) : (
                rows.map((r) => {
                  const open = openId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className={cn("border-b border-line/40 hover:bg-panel-2", r.level === "alert" && "border-l-2 border-l-brand bg-brand/5")}>
                        <td className="px-2 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : r.id)}
                            aria-expanded={open}
                            aria-label={open ? "Hide details" : "Show details"}
                            className="text-ink-faint hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                          >
                            {open ? "▾" : "▸"}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-dim">{new Date(r.ts).toLocaleString()}</td>
                        <td className="px-3 py-2 text-ink-dim">{r.type}</td>
                        <td className="px-3 py-2">
                          <span className={cn("border px-1.5 py-0.5 text-[11px] uppercase tracking-wide", LEVEL_CLASS[r.level] ?? LEVEL_CLASS.info)}>{r.level}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-ink">{r.name}</td>
                        <td className="max-w-[280px] truncate px-3 py-2 text-ink-dim" title={[r.message, r.user_agent].filter(Boolean).join(" · ") || undefined}>
                          {r.message ?? ""}
                          {r.filemaker_ua && <span className="ml-1 text-brand" title="FileMaker user-agent">⚠ FileMaker UA</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-dim">{r.ip ?? "—"}</td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-ink-dim" title={r.path ?? undefined}>{r.path ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-dim">{r.duration_ms != null ? `${fmt(r.duration_ms)}ms` : "—"}</td>
                      </tr>
                      {open && (
                        <tr className="border-b border-line/40 bg-ground/40">
                          <td colSpan={9} className="px-3 py-3">
                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[12px] leading-relaxed text-ink-dim">
{JSON.stringify(
  { id: r.id, ts: r.ts, type: r.type, level: r.level, name: r.name, message: r.message, ip: r.ip, method: r.method, path: r.path, user_agent: r.user_agent, filemaker_ua: r.filemaker_ua, duration_ms: r.duration_ms, account: r.account, meta: r.meta },
  null,
  2
)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pager
          page={clampedPage}
          pageCount={pageCount}
          start={clampedPage * pageSize}
          shown={rows.length}
          total={total}
          onPage={setPage}
        />
      </section>
    </div>
  );
}
