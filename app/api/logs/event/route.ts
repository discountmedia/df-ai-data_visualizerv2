import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/authToken";
import { logsSigningKey, logsConfigured, isAllowedAccount, logsPublic } from "@/lib/logsAuth";
import { safeLog } from "@/lib/apiLog";

export const runtime = "nodejs";

// System events the client is allowed to record. Server code calls safeLog
// directly and isn't limited to this list.
const CLIENT_EVENTS = new Set(["pro.push.received", "pro.push.error"]);

/** Only an authenticated app user (FileMaker session or logs session) may post;
 *  open in local dev. Keeps the gate-exempt endpoint from being a public writer. */
async function authorized(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  if (logsPublic()) return true; // logs opened to anyone (testing) → allow client events too
  const store = await cookies();
  const now = Date.now();
  const proSecret = process.env.INVENTORY_ANALYSIS_SECRET;
  const proCookie = store.get("df_pro_session")?.value;
  if (proSecret && proCookie && (await verifySession(proSecret, proCookie, now)).ok) return true;
  const logsCookie = store.get("df_logs_session")?.value;
  if (logsConfigured() && logsCookie) {
    const s = await verifySession(logsSigningKey(), logsCookie, now);
    if (s.ok && isAllowedAccount(s.account)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  if (!(await authorized())) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = (await req.json()) as { name?: string; message?: string; meta?: Record<string, unknown> };
    const name = String(body?.name ?? "");
    if (!CLIENT_EVENTS.has(name)) return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
    await safeLog({
      type: "system",
      level: name.endsWith(".error") ? "error" : "info",
      name,
      message: body.message ? String(body.message).slice(0, 500) : null,
      meta: body.meta && typeof body.meta === "object" ? body.meta : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
