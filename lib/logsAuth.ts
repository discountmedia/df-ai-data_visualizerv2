import { hmacHex, timingSafeEqualHex } from "./authToken";

/**
 * Logs-viewer credentials. Server-only.
 *
 * Multi-user via `LOGS_USERS` — comma-separated `username:password` pairs, e.g.
 *   LOGS_USERS="stephen:pass1,matt:pass2"
 * Each pair splits on the FIRST colon, so a password may contain colons; avoid
 * commas in passwords (they separate users). Usernames are case-insensitive.
 *
 * Falls back to a single shared password via `LOGS_PASSWORD` (username ignored)
 * when `LOGS_USERS` isn't set. Passwords are compared in constant time.
 */

export function logsUsers(): Map<string, string> {
  const raw = process.env.LOGS_USERS;
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const t = pair.trim();
    const idx = t.indexOf(":");
    if (idx < 1) continue; // need a non-empty username before the colon
    const user = t.slice(0, idx).trim().toLowerCase();
    const pass = t.slice(idx + 1); // keep verbatim (may contain ':')
    if (user) map.set(user, pass);
  }
  return map;
}

export function logsConfigured(): boolean {
  return !!process.env.LOGS_USERS || !!process.env.LOGS_PASSWORD;
}

/** True when named users are in use (login should show a username field). */
export function logsMultiUser(): boolean {
  return !!process.env.LOGS_USERS && logsUsers().size > 0;
}

/** Stable server-only key for signing the logs session cookie. */
export function logsSigningKey(): string {
  return process.env.LOGS_USERS || process.env.LOGS_PASSWORD || "";
}

const LABEL = "df-logs-login";
async function ctEqual(a: string, b: string): Promise<boolean> {
  // Compare via HMAC(value, label) so the compare is constant-time and length-safe.
  return timingSafeEqualHex(await hmacHex(a, LABEL), await hmacHex(b, LABEL));
}

export async function verifyCredentials(username: string, password: string): Promise<{ ok: boolean; account?: string }> {
  const users = logsUsers();
  if (users.size > 0) {
    const stored = users.get(username.trim().toLowerCase());
    if (stored == null) {
      await ctEqual("\0nouser", password); // equalize timing; never reveal user existence
      return { ok: false };
    }
    return { ok: await ctEqual(stored, password), account: username.trim() };
  }
  const single = process.env.LOGS_PASSWORD;
  if (single) {
    return { ok: await ctEqual(single, password), account: username.trim() || "logs-admin" };
  }
  return { ok: false };
}
