"use client";

import { useEffect } from "react";

/**
 * Bridge to PRO — the parent system that PUSHES this app its data.
 *
 * Hard constraint: this app can NEVER pull / request data from PRO. Its only two
 * outbound signals are (1) it is ready to receive, and (2) whether it received
 * the pushed data successfully or not. PRO drives; the app only listens + acks.
 *
 * Handshake (postMessage):
 *   1. App → PRO   `{ source: "DF_INVENTORY", type: "READY" }`   (ready to receive — NOT a request)
 *   2. PRO → App   `{ source: "PRO", type: "PAYLOAD", payload: {...} }`   (PRO pushes the data)
 *   3. App → PRO   `{ source: "DF_INVENTORY", type: "PAYLOAD_ACK", ok: true|false }`   (received ok / not)
 *
 * The payload shape is still being defined; on receipt we hand it off via a
 * `pro:payload` CustomEvent (for the data layer) and ack success — or ack failure
 * if it's missing/unusable. Lock `isFromPro` / origins to PRO's real contract.
 */

const APP_ID = "DF_INVENTORY";

// TODO: lock this to PRO's real origin(s) once known (e.g. ["https://pro.example.com"]).
const ALLOWED_ORIGINS: string[] | "*" = "*";

function isFromPro(data: unknown): data is { source?: string; type?: string; payload?: unknown } {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d.source === "PRO" || d.type === "PAYLOAD" || "payload" in d;
}

export function ProBridge() {
  useEffect(() => {
    function reply(to: MessageEventSource | null, origin: string, msg: Record<string, unknown>) {
      const target = ALLOWED_ORIGINS === "*" ? "*" : origin;
      try {
        (to as Window | null)?.postMessage(msg, target);
      } catch {
        window.parent?.postMessage(msg, "*");
      }
    }

    function onMessage(event: MessageEvent) {
      if (ALLOWED_ORIGINS !== "*" && !ALLOWED_ORIGINS.includes(event.origin)) return;
      if (!isFromPro(event.data)) return;

      // We never request data — we only confirm whether PRO's pushed payload
      // arrived usable (ok:true) or not (ok:false).
      try {
        const payload = (event.data as { payload?: unknown }).payload ?? event.data;
        const empty = payload == null || (typeof payload === "object" && Object.keys(payload as object).length === 0);
        if (empty) throw new Error("Empty or missing payload");

        // Hand the payload to the data layer (wired up next).
        window.dispatchEvent(new CustomEvent("pro:payload", { detail: payload }));

        reply(event.source, event.origin, {
          source: APP_ID, type: "PAYLOAD_ACK", ok: true, receivedAt: new Date().toISOString(),
        });
      } catch (err) {
        reply(event.source, event.origin, {
          source: APP_ID, type: "PAYLOAD_ACK", ok: false,
          error: err instanceof Error ? err.message : "Failed to receive payload",
          receivedAt: new Date().toISOString(),
        });
      }
    }

    window.addEventListener("message", onMessage);
    // Tell PRO we're loaded and ready to receive a payload.
    window.parent?.postMessage({ source: APP_ID, type: "READY" }, "*");

    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
