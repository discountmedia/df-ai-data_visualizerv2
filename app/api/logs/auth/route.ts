import { NextResponse } from "next/server";
import { logsConfigured, logsPublic } from "@/lib/logsAuth";
import { hasAllowlistedLogsAccess } from "@/lib/logsSession";

export const runtime = "nodejs";

const COOKIE = "df_logs_session";

/**
 * GET → { configured, authed } so the logs page knows what to show. Access is
 * granted either by a signed `/logs` link (df_logs_session) OR by an allowlisted
 * account's normal PRO app-session (df_pro_session) — see lib/logsSession. When
 * LOGS_PUBLIC is on (auth gate off), it's open to anyone.
 */
export async function GET() {
  if (logsPublic()) return NextResponse.json({ configured: true, authed: true });
  if (!logsConfigured()) return NextResponse.json({ configured: false, authed: false });
  const authed = await hasAllowlistedLogsAccess(Date.now());
  return NextResponse.json({ configured: true, authed });
}

/**
 * DELETE → log out of a signed-link logs session (clears df_logs_session).
 * Note: allowlisted access via the PRO app-session persists — that's the app
 * login itself, not a separate logs session.
 */
export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 0 });
  return res;
}
