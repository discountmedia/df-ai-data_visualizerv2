import { NextResponse, type NextRequest } from "next/server";
import { verifyProToken, issueSession, verifySession } from "@/lib/authToken";

/**
 * Hosted-mode auth gate for the PRO (FileMaker) Web Viewer.
 *
 * Flow per request:
 *   1. Valid session cookie present → allow.
 *   2. Fresh signed URL (`?payload=&signature=`) → verify (HMAC-SHA256, 60s
 *      freshness, project match). On success: issue an HttpOnly session cookie
 *      and redirect to the same path with the token stripped from the URL.
 *   3. Otherwise → 401 (this app is only meant to be opened from inside PRO).
 *
 * The gate is a stateless HMAC check + self-signed cookie — no database. Runs on
 * the Edge runtime, so it uses only Web Crypto (see lib/authToken).
 *
 * Enablement (see gateEnabled):
 *   • AUTH_GATE = "off" → always off. "on" → on iff a secret is set.
 *   • Otherwise: on in production when INVENTORY_ANALYSIS_SECRET is set; off in
 *     dev, and off (fail-open, with a warning) if no secret is configured — so a
 *     missing env var can't brick the app, mirroring the rest of the app's
 *     graceful degradation. Set AUTH_GATE=on locally to test the gate.
 */

const COOKIE = "df_pro_session";
const SESSION_TTL_SEC = 12 * 60 * 60; // a work session

function gateEnabled(): boolean {
  const secret = process.env.INVENTORY_ANALYSIS_SECRET;
  const flag = process.env.AUTH_GATE;
  if (flag === "off") return false;
  if (flag === "on") {
    if (!secret) console.warn("[auth-gate] AUTH_GATE=on but INVENTORY_ANALYSIS_SECRET is unset — gate stays OFF.");
    return !!secret;
  }
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[auth-gate] INVENTORY_ANALYSIS_SECRET is unset in production — gate is OFF (app is unprotected).");
    }
    return false;
  }
  return process.env.NODE_ENV === "production";
}

/**
 * Access log for every gated request. Emits one structured line per request with
 * the User-Agent, client IP, and gate outcome. Legitimate traffic is the Web
 * Viewer's embedded Chromium/Edge browser, whose UA does NOT contain "filemaker".
 * FileMaker's *native* HTTP client (Insert from URL / server-side scripts / Data
 * API) is what sends a "FileMaker" UA — so a request bearing one means the app is
 * being hit outside the Web Viewer render path, a potential security signal. We
 * expect zero of these; each is logged at ALERT level so it stands out / can be
 * alerted on. Lines go to the platform's runtime (Vercel) logs.
 *
 * We deliberately do NOT log the full header set — it carries the session cookie.
 */
function logAccess(req: NextRequest, outcome: string): void {
  const ua = req.headers.get("user-agent") || "";
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const isFileMakerUa = /filemaker/i.test(ua); // per contract; extend if FM ever sends "FMPro"/"FMWeb"
  const entry = {
    tag: "auth-gate",
    outcome,
    method: req.method,
    path: req.nextUrl.pathname,
    ip,
    ua,
    filemakerUa: isFileMakerUa,
  };
  if (isFileMakerUa) {
    console.warn("[auth-gate][ALERT] FileMaker user-agent detected — " + JSON.stringify(entry));
  } else {
    console.log("[auth-gate] " + JSON.stringify(entry));
  }
}

function denied(reason: string): NextResponse {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Access denied</title></head><body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0b0c;color:#e5e5e7;display:grid;place-items:center;min-height:100vh"><div style="text-align:center;max-width:30rem;padding:2rem"><div style="color:#ff2b2b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.72rem">Access denied</div><h1 style="font-size:1.15rem;font-weight:600;margin:.6rem 0 .5rem">Open this dashboard from Discount Forklift PRO</h1><p style="color:#84848c;font-size:.9rem;line-height:1.5">This tool is served through PRO with a signed, time-limited link. Direct access isn't permitted.</p></div></body></html>`;
  return new NextResponse(body, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "x-auth-gate": reason },
  });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (!gateEnabled()) return NextResponse.next();

  const secret = process.env.INVENTORY_ANALYSIS_SECRET as string;
  const now = Date.now();

  // 1. Existing valid session → allow.
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && (await verifySession(secret, cookie, now)).ok) {
    logAccess(req, "allow:cookie");
    return NextResponse.next();
  }

  // 2. Fresh signed URL → verify, then set the session cookie and strip the token.
  const payload = req.nextUrl.searchParams.get("payload");
  const signature = req.nextUrl.searchParams.get("signature");
  if (payload || signature) {
    const res = await verifyProToken(secret, payload, signature, now);
    if (!res.ok) {
      logAccess(req, "deny:" + (res.reason ?? "invalid token"));
      return denied(res.reason ?? "invalid token");
    }
    const url = req.nextUrl.clone();
    url.searchParams.delete("payload");
    url.searchParams.delete("signature");
    const response = NextResponse.redirect(url);
    const value = await issueSession(secret, res.account ?? "", SESSION_TTL_SEC, now);
    response.cookies.set(COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    });
    logAccess(req, "allow:token" + (res.account ? " account=" + res.account : ""));
    return response;
  }

  // 3. No session, no token.
  logAccess(req, "deny:no token");
  return denied("no token");
}

// Gate pages + API, but let Next's build assets and the favicon/logo load freely
// (they carry no data; the sensitive data arrives via the PRO push, not the bundle).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
