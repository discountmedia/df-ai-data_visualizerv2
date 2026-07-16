import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/authToken";
import { logsConfigured, logsSigningKey } from "@/lib/logsAuth";
import { queryLogs, LOG_SORT_COLUMNS, type LogSortKey, type LogType } from "@/lib/logStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "df_logs_session";
const PAGE_SIZE = 50;
const TYPES: (LogType | "all")[] = ["all", "auth", "performance", "error", "system"];

/** GET → paginated, sorted, filtered log rows. Requires the logs session cookie. */
export async function GET(req: Request) {
  if (!logsConfigured()) return NextResponse.json({ error: "Logs login is not configured.", configured: false }, { status: 503 });

  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie || !(await verifySession(logsSigningKey(), cookie, Date.now())).ok) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") ?? "all";
  const type = (TYPES.includes(typeParam as LogType) ? typeParam : "all") as LogType | "all";
  const q = url.searchParams.get("q") ?? undefined;
  const sortParam = url.searchParams.get("sort") ?? "ts";
  const sort = (sortParam in LOG_SORT_COLUMNS ? sortParam : "ts") as LogSortKey;
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(0, Number(url.searchParams.get("page") ?? "0") || 0);

  try {
    const { rows, total } = await queryLogs({ type, q, sort, order, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    return NextResponse.json({ rows, total, page, pageSize: PAGE_SIZE, configured: true });
  } catch (err) {
    // Almost always a missing/invalid DATABASE_URL — surface it clearly.
    const message = err instanceof Error ? err.message : "Could not read logs.";
    return NextResponse.json({ error: message, configured: false }, { status: 503 });
  }
}
