import { NextResponse } from "next/server";
import { safeLog } from "@/lib/apiLog";
import type { LogEntry } from "@/lib/logStore";

export const runtime = "nodejs";

/**
 * Internal log sink. The Edge middleware can't write to Neon directly, so it
 * POSTs access events here (via `ev.waitUntil`). Guarded by a shared key header
 * when `INVENTORY_ANALYSIS_SECRET` is set (it always is in prod); open in local
 * dev where the secret is unset. Never throws back to the caller.
 */
export async function POST(req: Request) {
  const secret = process.env.INVENTORY_ANALYSIS_SECRET;
  if (secret && req.headers.get("x-log-key") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const entry = (await req.json()) as LogEntry;
    if (!entry || typeof entry.type !== "string" || typeof entry.name !== "string") {
      return NextResponse.json({ ok: false, error: "bad entry" }, { status: 400 });
    }
    await safeLog(entry);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
