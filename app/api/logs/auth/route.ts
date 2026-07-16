import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issueSession, verifySession } from "@/lib/authToken";
import { verifyCredentials, logsConfigured, logsMultiUser, logsSigningKey } from "@/lib/logsAuth";
import { safeLog } from "@/lib/apiLog";

export const runtime = "nodejs";

const COOKIE = "df_logs_session";
const TTL_SEC = 8 * 60 * 60; // a logs-admin session

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** GET → { configured, multiUser, authed } so the page knows what login to show. */
export async function GET() {
  if (!logsConfigured()) return NextResponse.json({ configured: false, multiUser: false, authed: false });
  const cookie = (await cookies()).get(COOKIE)?.value;
  const authed = !!cookie && (await verifySession(logsSigningKey(), cookie, Date.now())).ok;
  return NextResponse.json({ configured: true, multiUser: logsMultiUser(), authed });
}

/** POST { username?, password } → set the session cookie on success; log a denied attempt. */
export async function POST(req: Request) {
  if (!logsConfigured()) {
    return NextResponse.json({ ok: false, error: "Logs login is not configured (set LOGS_USERS or LOGS_PASSWORD)." }, { status: 503 });
  }

  let username = "";
  let password = "";
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    username = String(body?.username ?? "");
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const result = await verifyCredentials(username, password);
  if (!result.ok) {
    // Denied logs login → alert-level (drives the nav bubble).
    void safeLog({
      type: "auth",
      level: "alert",
      name: "logs.login.denied",
      message: username ? `Denied login for "${username}"` : "Denied login (no username)",
      ip: clientIp(req),
      path: "/api/logs/auth",
      method: "POST",
      userAgent: req.headers.get("user-agent"),
      account: username || null,
    });
    return NextResponse.json({ ok: false, error: "Incorrect username or password." }, { status: 401 });
  }

  const account = result.account ?? "logs-admin";
  const value = await issueSession(logsSigningKey(), account, TTL_SEC, Date.now());
  const res = NextResponse.json({ ok: true, account });
  res.cookies.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: TTL_SEC,
  });
  void safeLog({ type: "auth", level: "info", name: "logs.login.ok", ip: clientIp(req), path: "/api/logs/auth", method: "POST", account });
  return res;
}

/** DELETE → log out (clear the cookie). */
export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 0 });
  return res;
}
