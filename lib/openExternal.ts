/**
 * Open an external URL from inside the chromeless FileMaker Web Viewer WITHOUT
 * navigating the viewer away from the app.
 *
 * The problem: a plain `<a target="_blank">` in the Web Viewer (no tabs, no back
 * button) navigates IN PLACE to the external site, replacing our React app — the
 * user is then stranded with no way back except closing the whole viewer, and our
 * in-app Back/Forward can't help (it only moves our own tab/drawer state, and our
 * JS no longer runs once the frame is on another origin).
 *
 * The fix: use `window.open(_blank)`. In a webview that doesn't support new
 * windows it returns null (a harmless no-op) instead of replacing our page, so the
 * app is never lost. If it's blocked, we copy the URL so the user can paste it
 * into a real browser. Callers should `preventDefault()` the anchor and call this.
 *
 * Cleanest future path: set FM_OPEN_URL_SCRIPT to a FileMaker "Open URL" script
 * name (the lead dev adds one); then we hand the URL to FileMaker over the bridge
 * and it opens in the system browser. Left empty until that script exists.
 */
const FM_OPEN_URL_SCRIPT = ""; // e.g. "Open URL" — enable once the lead dev adds it

type FMHost = { PerformScriptWithOption?: (script: string, param: string, option: string) => void };

export function openExternal(url: string | null | undefined): void {
  const href = (url ?? "").trim();
  if (!href || typeof window === "undefined") return;

  // 1. Preferred (when wired): hand off to FileMaker to open in the system browser.
  const fm = (window as unknown as { FileMaker?: FMHost }).FileMaker;
  if (FM_OPEN_URL_SCRIPT && fm?.PerformScriptWithOption) {
    try { fm.PerformScriptWithOption(FM_OPEN_URL_SCRIPT, href, "0"); return; } catch { /* fall through */ }
  }

  // 2. Open in a new window/context. Never navigates the current (app) frame in
  //    place — worst case it returns null and nothing happens.
  try {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w) { try { w.opener = null; } catch { /* ignore */ } return; }
  } catch { /* fall through */ }

  // 3. Last resort: copy the URL so the user isn't stuck (right-click is disabled).
  try { navigator.clipboard?.writeText(href); } catch { /* ignore */ }
}
