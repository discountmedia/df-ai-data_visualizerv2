/**
 * PRO (FileMaker Web Viewer) bridge — installed as a PRE-HYDRATION inline script
 * in the document (see app/layout.tsx), so the global functions FileMaker calls
 * by name exist as early as possible — before React hydrates. This closes any
 * hydration-timing gap: FileMaker polls `fileMakerReady()` and pushes only after
 * our ready ping, and the functions are present from initial page parse.
 *
 * The bridge is deliberately tiny and framework-free: on receipt it BUFFERS the
 * payload on `window.__proPayload` and dispatches a `pro:payload` event. The
 * React layer (DashboardProvider) consumes the buffer on mount AND listens for
 * the event, so a push is handled whether it arrives before or after mount.
 *
 * This mirrors the contract in the lead dev's guide exactly:
 *   • fileMakerReceive(jsonString) — FileMaker calls this; reply exactly once.
 *   • fileMakerSend(requestId, responseAction, responseMessage) — the receipt,
 *     via FileMaker.PerformScriptWithOption('Inventory Analysis Return', json,'5').
 *   • fileMakerReady() — health-check ping (requestId "health_check").
 * All values are strings. We add NO retry loop (the FileMaker side owns retries).
 *
 * The 401 "access denied" page does NOT use this full bridge — it uses a separate
 * minimal clone, PRO_BLOCKED_SCRIPT (below), that runs only fileMakerReady() +
 * fileMakerBlocked() and nothing else.
 *
 * Kept as plain ES5 (var/function) because it runs verbatim (not transpiled).
 */

declare global {
  interface Window {
    fileMakerReceive?: (jsonString: string) => void;
    fileMakerSend?: (requestId: string, responseAction: string, responseMessage: string) => void;
    fileMakerReady?: () => void;
    fileMakerBlocked?: () => void;
    FileMaker?: {
      PerformScriptWithOption?: (scriptName: string, scriptParameter: string, scriptOption: string) => void;
    };
    /** Buffer for a PRO push that arrives before the React consumer mounts. */
    __proPayload?: { requestId?: string; inventoryCsvData: string; staffCsvData: string };
    __dfBridgeInstalled?: boolean;
  }
}

export const PRO_BRIDGE_SCRIPT = `(function () {
  if (window.__dfBridgeInstalled) return;
  window.__dfBridgeInstalled = true;
  var CALLBACK_SCRIPT = "Inventory Analysis Return";
  var CALLBACK_OPTION = "5";
  function bridgePresent() {
    return typeof window.FileMaker !== "undefined" && window.FileMaker &&
      typeof window.FileMaker.PerformScriptWithOption === "function";
  }
  function fileMakerSend(requestId, responseAction, responseMessage) {
    var responseJson = JSON.stringify({
      requestId: requestId, responseAction: responseAction, responseMessage: responseMessage
    });
    if (bridgePresent()) {
      window.FileMaker.PerformScriptWithOption(CALLBACK_SCRIPT, responseJson, CALLBACK_OPTION);
    } else if (window.console) {
      console.warn("[ProBridge] FileMaker bridge not available; receipt dropped:", responseJson);
    }
  }
  function fileMakerReceive(jsonString) {
    var requestId = ""; var alreadySent = false;
    try {
      var d = JSON.parse(jsonString);
      requestId = d.requestId || "";
      var inventoryCsvData = d.inventoryCsvData || "";
      var staffCsvData = d.staffCsvData || "";
      if (inventoryCsvData === "" || staffCsvData === "") {
        fileMakerSend(requestId, "error", "Both inventory and staff CSV datasets are required to proceed.");
        return;
      }
      fileMakerSend(requestId, "success", "Inventory and staff data received successfully.");
      alreadySent = true;
      var detail = { requestId: requestId, inventoryCsvData: inventoryCsvData, staffCsvData: staffCsvData };
      window.__proPayload = detail;
      window.dispatchEvent(new CustomEvent("pro:payload", { detail: detail }));
    } catch (e) {
      if (!alreadySent) {
        fileMakerSend(requestId, "error", "The request could not be parsed: " + ((e && e.message) || "Unknown error occurred."));
      }
    }
  }
  function fileMakerReady() {
    if (bridgePresent()) {
      window.FileMaker.PerformScriptWithOption(CALLBACK_SCRIPT, JSON.stringify({
        requestId: "health_check", responseAction: "ready",
        responseMessage: "The JavaScript engine is loaded and ready."
      }), CALLBACK_OPTION);
    }
  }
  window.fileMakerReceive = fileMakerReceive;
  window.fileMakerSend = fileMakerSend;
  window.fileMakerReady = fileMakerReady;
  fileMakerReady();
})();`;

/**
 * 401 "access denied" page ONLY — a minimal, standalone clone of the bridge that
 * installs and runs JUST fileMakerReady() + fileMakerBlocked() and nothing else
 * (no receive / send / buffer / pro:payload). Injected by middleware.ts into the
 * denied page so that on a blocked load FileMaker gets the ready ping AND the
 * "blocked" signal (per the lead dev), and its handler can respond. No-op in a
 * normal browser (no window.FileMaker).
 *
 * ⚠️ This reintroduces a FileMaker callback on the 401 page. An earlier "error"
 * signal here crashed the FileMaker app, so this relies on the FileMaker side now
 * handling responseAction "blocked"/"ready" from this page WITHOUT crashing.
 */
export const PRO_BLOCKED_SCRIPT = `(function () {
  var CALLBACK_SCRIPT = "Inventory Analysis Return";
  var CALLBACK_OPTION = "5";
  function bridgePresent() {
    return typeof window.FileMaker !== "undefined" && window.FileMaker &&
      typeof window.FileMaker.PerformScriptWithOption === "function";
  }
  function fileMakerReady() {
    if (bridgePresent()) {
      window.FileMaker.PerformScriptWithOption(CALLBACK_SCRIPT, JSON.stringify({
        requestId: "health_check", responseAction: "ready",
        responseMessage: "The JavaScript engine is loaded and ready."
      }), CALLBACK_OPTION);
    }
  }
  function fileMakerBlocked() {
    if (bridgePresent()) {
      window.FileMaker.PerformScriptWithOption(CALLBACK_SCRIPT, JSON.stringify({
        requestId: "health_check", responseAction: "blocked",
        responseMessage: "Access was blocked; the page will not initialize."
      }), CALLBACK_OPTION);
    }
  }
  window.fileMakerReady = fileMakerReady;
  window.fileMakerBlocked = fileMakerBlocked;
  fileMakerReady();
  fileMakerBlocked();
})();`;
