import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/authToken";
import { logsConfigured, logsSigningKey, isAllowedAccount, logsPublic } from "@/lib/logsAuth";

export const runtime = "nodejs";

const COOKIE = "df_logs_session";

/**
 * GET → { configured, authed } so the logs page knows what to show. There is no
 * password login: access is granted by opening a signed URL whose account is in
 * LOGS_ACCOUNTS (verified in middleware → handleLogsAccess, which sets the
 * df_logs_session cookie). This endpoint only reports the current state.
 */
export async function GET() {
  // LOGS_PUBLIC=true → logs are open to anyone (testing only; no signed link).
  if (logsPublic()) return NextResponse.json({ configured: true, authed: true });
  if (!logsConfigured()) return NextResponse.json({ configured: false, authed: false });
  const cookie = (await cookies()).get(COOKIE)?.value;
  let authed = false;
  if (cookie) {
    const sess = await verifySession(logsSigningKey(), cookie, Date.now());
    authed = sess.ok && isAllowedAccount(sess.account); // re-check the allowlist every time
  }
  return NextResponse.json({ configured: true, authed });
}

/** DELETE → log out (clear the cookie). */
export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 0 });
  return res;
}
