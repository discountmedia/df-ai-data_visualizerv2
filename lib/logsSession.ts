import { cookies } from "next/headers";
import { verifySession } from "./authToken";
import { logsConfigured, logsSigningKey, isAllowedAccount } from "./logsAuth";

/**
 * Server-only: does the current request carry an allowlisted logs viewer?
 *
 * Accepts EITHER cookie, as long as its account is in LOGS_ACCOUNTS:
 *   - `df_logs_session` — issued by a signed `/logs?payload=&signature=` link, OR
 *   - `df_pro_session`  — the normal app login, so an allowlisted admin gets the
 *     Logs tab through their regular signed PRO link (no separate logs link needed).
 *
 * Both cookies are HMAC-signed with INVENTORY_ANALYSIS_SECRET (= logsSigningKey()),
 * so one key verifies both. Requires LOGS_ACCOUNTS + the secret (logsConfigured());
 * every call re-checks the allowlist, so removing a name revokes access at once.
 */
export async function hasAllowlistedLogsAccess(nowMs: number): Promise<boolean> {
  if (!logsConfigured()) return false;
  const store = await cookies();
  const key = logsSigningKey();
  for (const name of ["df_logs_session", "df_pro_session"]) {
    const cookie = store.get(name)?.value;
    if (!cookie) continue;
    const s = await verifySession(key, cookie, nowMs);
    if (s.ok && isAllowedAccount(s.account)) return true;
  }
  return false;
}
