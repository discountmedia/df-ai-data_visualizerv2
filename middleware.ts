import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { verifyProToken, issueSession, verifySession } from "@/lib/authToken";
import { logsAccounts, isAllowedAccount } from "@/lib/logsAuth";

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
const LOGS_COOKIE = "df_logs_session";
const LOGS_TTL_SEC = 8 * 60 * 60; // a logs-admin session

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
// Any case-insensitive "filemaker" substring — covers filemaker, filemaker19,
// filemaker_19, "filemaker 19", "FileMaker/19.6", etc. Legit Web Viewer traffic
// is embedded Chromium and never contains it, so a hit is a security signal.
const FILEMAKER_UA = /filemaker/i;

type LogLevel = "info" | "warn" | "error" | "alert";

function logAccess(req: NextRequest, ev: NextFetchEvent, name: string, baseLevel: LogLevel, message: string, extra?: Record<string, unknown>): void {
  const ua = req.headers.get("user-agent") || "";
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const isFileMakerUa = FILEMAKER_UA.test(ua);
  // A FileMaker UA always alerts (drives the nav bubble); otherwise use the level
  // the caller chose — signature/HMAC rejections come in at 'alert', benign
  // denials (no token, expired, bots) at 'warn' so they don't spam the bubble.
  const level: LogLevel = isFileMakerUa && baseLevel !== "alert" ? "alert" : baseLevel;
  // Capture ALL request headers EXCEPT the ones that carry secrets (the session
  // cookie / auth header) — logging those would persist credentials.
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key === "cookie" || key === "authorization") return;
    headers[key] = value;
  });
  const entry = {
    type: "auth" as const,
    level,
    name,
    message,
    ip,
    method: req.method,
    path: req.nextUrl.pathname,
    userAgent: ua,
    filemakerUa: isFileMakerUa,
    meta: { headers, ...(extra ?? {}) },
  };
  // Console (Vercel runtime logs) as a fallback signal.
  if (level === "alert") console.warn(`[auth-gate][ALERT] ${name} — ` + JSON.stringify(entry));
  else console.log("[auth-gate] " + JSON.stringify(entry));
  // Persist to the log store. Edge can't reach Neon directly, so POST the Node
  // ingest route in the background (never blocks or fails the response).
  const secret = process.env.INVENTORY_ANALYSIS_SECRET;
  ev.waitUntil(
    fetch(`${req.nextUrl.origin}/api/logs/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-log-key": secret } : {}) },
      body: JSON.stringify(entry),
      keepalive: true,
    })
      .then(() => undefined)
      .catch(() => undefined)
  );
}

function denied(reason: string): NextResponse {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Access denied</title></head><body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0b0c;color:#e5e5e7;display:grid;place-items:center;min-height:100vh"><div style="text-align:center;max-width:30rem;padding:2rem"><div style="color:#ff2b2b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.72rem">Access denied</div><h1 style="font-size:1.15rem;font-weight:600;margin:.6rem 0 .5rem">Open this dashboard from Discount Forklift PRO</h1><p style="color:#84848c;font-size:.9rem;line-height:1.5">This tool is served through PRO with a signed, time-limited link. Direct access isn't permitted.</p></div></body></html>`;
  return new NextResponse(body, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "x-auth-gate": reason },
  });
}

/**
 * Logs-viewer access control — the SAME signed-token method as the FileMaker
 * gate, plus an account allowlist (LOGS_ACCOUNTS). Every attempt is logged:
 *   • logs.access.granted     (valid token + allowlisted account) — info
 *   • logs.access.denied      (valid signature, account NOT allowlisted) — alert
 *   • logs.signature.rejected (bad HMAC / wrong project / undecodable) — alert
 *   • logs.token.denied       (stale/expired or half-present token) — warn
 * On success, issues the df_logs_session cookie and strips the token from the URL.
 */
async function handleLogsAccess(req: NextRequest, ev: NextFetchEvent): Promise<NextResponse> {
  const payload = req.nextUrl.searchParams.get("payload");
  const signature = req.nextUrl.searchParams.get("signature");
  // No token on the URL → let the page load; it checks the cookie and shows the
  // access screen when there's no valid session.
  if (!payload && !signature) return NextResponse.next();

  const secret = process.env.INVENTORY_ANALYSIS_SECRET;
  if (!secret || logsAccounts().size === 0) return NextResponse.next(); // logs auth not configured

  const now = Date.now();
  const res = await verifyProToken(secret, payload, signature, now);
  if (!res.ok) {
    const forged =
      res.reason === "bad signature" || res.reason === "wrong project" || res.reason === "undecodable payload";
    if (forged) {
      // Tampered/forged logs token → ALWAYS refuse (never fall through to a cookie).
      logAccess(req, ev, "logs.signature.rejected", "alert", `logs forged token refused: ${res.reason}`, {
        rxPayload: payload,
        rxSignature: signature,
      });
      return denied(res.reason ?? "bad signature");
    }
    // Stale / half-present → the page will fall back to any valid logs cookie.
    logAccess(req, ev, "logs.token.denied", "warn", `logs token not usable: ${res.reason ?? "invalid token"}`);
    return NextResponse.next();
  }
  if (!isAllowedAccount(res.account)) {
    logAccess(req, ev, "logs.access.denied", "alert", `logs access denied: account "${res.account ?? ""}" not in allowlist`);
    return NextResponse.next();
  }
  // Granted → issue the logs session cookie and strip the token from the URL.
  const url = req.nextUrl.clone();
  url.searchParams.delete("payload");
  url.searchParams.delete("signature");
  const response = NextResponse.redirect(url);
  const value = await issueSession(secret, res.account ?? "", LOGS_TTL_SEC, now);
  response.cookies.set(LOGS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: LOGS_TTL_SEC,
  });
  logAccess(req, ev, "logs.access.granted", "info", `logs access granted (account=${res.account})`);
  return response;
}

async function gate(req: NextRequest, ev: NextFetchEvent): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  // Logs APIs check the df_logs_session cookie themselves; never gate/loop them
  // (the /api/logs/ingest write would otherwise log itself).
  if (pathname.startsWith("/api/logs")) return NextResponse.next();
  // Logs viewer: its own signed-token access control (account allowlist),
  // independent of the FileMaker gate.
  if (pathname.startsWith("/logs")) return handleLogsAccess(req, ev);

  if (!gateEnabled()) return NextResponse.next();

  const secret = process.env.INVENTORY_ANALYSIS_SECRET as string;
  const now = Date.now();

  // 1. A token on the URL MUST be validated FIRST — a forged / bad-signature
  //    token is rejected outright, even if the browser also carries a valid
  //    session cookie. A cookie must never let a tampered token through.
  const payload = req.nextUrl.searchParams.get("payload");
  const signature = req.nextUrl.searchParams.get("signature");
  if (payload || signature) {
    const res = await verifyProToken(secret, payload, signature, now);
    if (res.ok) {
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
      logAccess(req, ev, "gate.allow", "info", "allow: signed URL" + (res.account ? ` (account=${res.account})` : ""));
      return response;
    }
    // Token present but not valid.
    const forged =
      res.reason === "bad signature" || res.reason === "wrong project" || res.reason === "undecodable payload";
    if (forged) {
      // Tampered/forged token → ALWAYS refuse; never fall back to a cookie.
      // Capture the exact payload+signature received so a rejection can be
      // diagnosed (intact-but-wrong-secret vs mangled-in-transit).
      logAccess(req, ev, "gate.signature.rejected", "alert", `forged token refused: ${res.reason}`, {
        rxPayload: payload,
        rxSignature: signature,
      });
      return denied(res.reason ?? "bad signature");
    }
    // Genuinely-signed but stale (or half-present) token: log it, then fall
    // through so a still-valid session cookie can carry the request (e.g. a
    // refresh that re-loads an older signed URL). No cookie → denied below.
    logAccess(req, ev, "gate.deny", "warn", `token not usable: ${res.reason ?? "invalid token"}`);
  }

  // 2. Fall back to an existing valid session cookie. A present cookie whose
  //    HMAC fails (not mere expiry) is a tampered/forged session → alert.
  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie) {
    const sess = await verifySession(secret, cookie, now);
    if (sess.ok) {
      logAccess(req, ev, "gate.allow", "info", "allow: valid session cookie");
      return NextResponse.next();
    }
    if (sess.reason === "bad session signature") {
      logAccess(req, ev, "session.signature.rejected", "alert", "df_pro_session HMAC signature rejected (tampered/forged cookie)");
    }
  }

  // 3. No valid token, no valid session.
  logAccess(req, ev, "gate.deny", "warn", "no valid token or session");
  return denied("no token");
}

// Single choke point: stamp Cache-Control: no-store on EVERY response the gate
// produces — including the 307 token-strip redirect and the 401 denied() page,
// which short-circuit before Next's config headers() layer and would otherwise
// ship with no cache header. Immutable /_next assets are excluded by
// config.matcher and never reach here, so they stay cacheable.
export async function middleware(req: NextRequest, ev: NextFetchEvent): Promise<NextResponse> {
  const res = await gate(req, ev);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// Gate pages + API, but let Next's build assets and the favicon/logo load freely
// (they carry no data; the sensitive data arrives via the PRO push, not the bundle).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
