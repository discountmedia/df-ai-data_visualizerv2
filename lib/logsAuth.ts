/**
 * Logs-viewer access control. Server + Edge safe (env only — no DB, no bcrypt).
 *
 * Access uses the SAME signed-token method as the FileMaker gate: a URL carrying
 *   ?payload=<base64url(inventory-analysis|<utcMillis>|<account>)>&signature=<hmac>
 * signed with INVENTORY_ANALYSIS_SECRET. The token is verified (verifyProToken in
 * lib/authToken), and the ACCOUNT must be in the LOGS_ACCOUNTS allowlist. There
 * are no usernames/passwords.
 *
 *   LOGS_ACCOUNTS = comma-separated account names, e.g. "matt" or "matt,stephen".
 *   Case-insensitive. Requires INVENTORY_ANALYSIS_SECRET to be set (to verify).
 *
 * The df_logs_session cookie issued after a valid token is signed with the same
 * shared secret; every request re-checks the account is still allowlisted, so
 * removing a name from LOGS_ACCOUNTS revokes existing sessions.
 */

export function logsAccounts(): Set<string> {
  const set = new Set<string>();
  for (const a of (process.env.LOGS_ACCOUNTS || "").split(",")) {
    const t = a.trim().toLowerCase();
    if (t) set.add(t);
  }
  return set;
}

export function isAllowedAccount(account: string | null | undefined): boolean {
  if (!account) return false;
  return logsAccounts().has(account.trim().toLowerCase());
}

/**
 * Is the logs viewer open to anyone (no signed link, no LOGS_ACCOUNTS allowlist)?
 *
 *   LOGS_PUBLIC=true  → always public.
 *   LOGS_PUBLIC=false → always gated.
 *   unset → follows the FileMaker gate: public whenever the gate is OFF (by any
 *           means — AUTH_GATE=off, or no secret set), since the whole app is
 *           already open then. It RE-SECURES automatically the moment the gate is
 *           turned on (AUTH_GATE=on + secret) for go-live.
 *
 * ⚠️ Public mode exposes IPs / user-agents / request headers / access events.
 * Still needs DATABASE_URL for there to be logs to read.
 */
export function logsPublic(): boolean {
  const flag = (process.env.LOGS_PUBLIC || "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return !gateOn();
}

/**
 * Mirror of middleware.ts → gateEnabled() (env-only, kept in sync deliberately):
 * is the FileMaker auth gate actually enforcing? Used to decide whether logs are
 * public by default.
 */
function gateOn(): boolean {
  const secret = process.env.INVENTORY_ANALYSIS_SECRET;
  const flag = (process.env.AUTH_GATE || "").trim().toLowerCase();
  if (flag === "off") return false;
  if (flag === "on") return !!secret;
  if (!secret) return false; // fail-open (matches the gate)
  return process.env.NODE_ENV === "production";
}

/** Logs auth needs both an allowlist AND the shared secret (to verify tokens). */
export function logsConfigured(): boolean {
  return logsAccounts().size > 0 && !!process.env.INVENTORY_ANALYSIS_SECRET;
}

/** The logs session cookie is signed with the shared secret. */
export function logsSigningKey(): string {
  return process.env.INVENTORY_ANALYSIS_SECRET || "";
}
