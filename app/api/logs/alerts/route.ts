import { NextResponse } from "next/server";
import { alertCountSince } from "@/lib/logStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?since=<ISO> → { count } of alert-level events (FileMaker-UA hits + denied
 * logs logins) since that time. Drives the nav bubble, so it must be reachable
 * before the logs login — it returns only a count, nothing sensitive, and stays
 * quiet (count 0) if logging isn't configured.
 */
export async function GET(req: Request) {
  try {
    const since = new URL(req.url).searchParams.get("since");
    const count = await alertCountSince(since && !Number.isNaN(Date.parse(since)) ? since : null);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0, configured: false });
  }
}
