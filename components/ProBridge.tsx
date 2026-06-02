"use client";

import { useEffect } from "react";

/**
 * Bridge to PRO — the parent system that will feed this app its data.
 *
 * Handshake (postMessage):
 *   1. App → PRO   `{ source: "DF_INVENTORY", type: "READY" }`   (on load: "send me the payload")
 *   2. PRO → App   `{ source: "PRO", type: "PAYLOAD", payload: {...} }`   (the requested data fields)
 *   3. App → PRO   `{ source: "DF_INVENTORY", type: "PAYLOAD_ACK", ok: true }`   (success confirmation)
 *
 * The payload shape is still being defined; for now we accept it, hand it off via
 * a `pro:payload` CustomEvent (so the data layer can consume it later), and
 * confirm receipt to PRO. Replace `isFromPro` / the ack with PRO's real contract.
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

      const payload = (event.data as { payload?: unknown }).payload ?? event.data;

      // Hand the payload to the data layer (wired up next).
      window.dispatchEvent(new CustomEvent("pro:payload", { detail: payload }));

      // Confirm success back to PRO.
      reply(event.source, event.origin, {
        source: APP_ID,
        type: "PAYLOAD_ACK",
        ok: true,
        receivedAt: new Date().toISOString(),
      });
    }

    window.addEventListener("message", onMessage);
    // Tell PRO we're loaded and ready to receive a payload.
    window.parent?.postMessage({ source: APP_ID, type: "READY" }, "*");

    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
