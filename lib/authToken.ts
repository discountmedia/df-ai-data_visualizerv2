/**
 * Hosted-mode auth for the PRO (FileMaker) Web Viewer — the "doorman" that
 * proves a page load came from a FileMaker client holding our file.
 *
 * FileMaker appends `?payload=<base64url>&signature=<hex>` to our URL:
 *   payload text = "inventory-analysis|<utcMillis>|<account>"  (base64url-encoded)
 *   signature    = HMAC-SHA256(base64urlPayload, SHARED_SECRET) as lowercase hex
 *
 * We recompute the signature over the EXACT payload param, constant-time compare,
 * then check the project and a 60-second freshness window (covers only the gap
 * between FileMaker building the token and the first page load). See the lead
 * dev's guide, "The Auth Token (Hosted URL)".
 *
 * Everything here uses ONLY Web Crypto / TextEncoder / atob / btoa, so it runs
 * identically in Next middleware (Edge runtime) and in Node 18+. Functions take
 * the secret as an argument (never read process.env here) so they stay pure and
 * testable against the guide's reference vector.
 */

export const PRO_PROJECT = "inventory-analysis";
export const TOKEN_FRESHNESS_MS = 60_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** HMAC-SHA256(message) with the secret, as lowercase hex. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Length-checked, constant-time compare of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlEncode(str: string): string {
  const bytes = enc.encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeUtf8(s: string): string {
  return dec.decode(b64urlToBytes(s));
}

export interface TokenResult {
  ok: boolean;
  account?: string;
  reason?: string;
}

/**
 * Verify a signed-URL token. Mirrors the guide's server check: recompute the
 * signature over the exact payload param, constant-time compare, then (only
 * after the signature passes) decode + check project and freshness.
 */
export async function verifyProToken(
  secret: string,
  payloadParam: string | null,
  signatureParam: string | null,
  nowMs: number
): Promise<TokenResult> {
  if (!secret) return { ok: false, reason: "no secret configured" };
  if (!payloadParam || !signatureParam) return { ok: false, reason: "missing token" };

  const expected = await hmacHex(secret, payloadParam);
  if (!timingSafeEqualHex(signatureParam, expected)) return { ok: false, reason: "bad signature" };

  let decoded: string;
  try {
    decoded = b64urlDecodeUtf8(payloadParam);
  } catch {
    return { ok: false, reason: "undecodable payload" };
  }
  const parts = decoded.split("|");
  const project = parts[0];
  const timestamp = Number(parts[1]);
  const account = parts.slice(2).join("|"); // account is pipe-safe (comes last)

  if (project !== PRO_PROJECT) return { ok: false, reason: "wrong project" };
  if (!Number.isFinite(timestamp) || Math.abs(nowMs - timestamp) > TOKEN_FRESHNESS_MS) {
    return { ok: false, reason: "stale token" };
  }
  return { ok: true, account };
}

/* ---------------------------------------------------------------------------
 * Session cookie — self-signed and stateless (no DB). The URL token is only
 * fresh for 60s (first load); once verified we issue this cookie so subsequent
 * asset/API/page requests in the same session pass without a fresh token.
 * ------------------------------------------------------------------------- */

interface SessionClaims {
  account: string;
  exp: number; // epoch ms
}

/** `<base64url(JSON claims)>.<hex HMAC of that base64url>`. */
export async function issueSession(
  secret: string,
  account: string,
  ttlSec: number,
  nowMs: number
): Promise<string> {
  const claims: SessionClaims = { account, exp: nowMs + ttlSec * 1000 };
  const payload = b64urlEncode(JSON.stringify(claims));
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(secret: string, value: string | undefined, nowMs: number): Promise<TokenResult> {
  if (!secret || !value) return { ok: false, reason: "no session" };
  const dot = value.indexOf(".");
  if (dot < 1) return { ok: false, reason: "malformed session" };
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmacHex(secret, payload);
  if (!timingSafeEqualHex(sig, expected)) return { ok: false, reason: "bad session signature" };
  try {
    const claims = JSON.parse(b64urlDecodeUtf8(payload)) as SessionClaims;
    if (typeof claims.exp !== "number" || nowMs > claims.exp) return { ok: false, reason: "expired session" };
    return { ok: true, account: claims.account };
  } catch {
    return { ok: false, reason: "undecodable session" };
  }
}
