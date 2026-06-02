import type { PivotSpec } from "./pivot";

/**
 * Client for the AI "find a connection" box: turns a plain-English question into
 * a PivotSpec the deterministic engine then computes. Mirrors the insights
 * client's NO_KEY-fallback contract so the panel degrades gracefully to the
 * manual builder when ANTHROPIC_API_KEY isn't set.
 */

export interface ConnectColumnInfo {
  name: string;
  role: string;
  type: string;
  samples: string[];
}

export interface ConnectRequest {
  question: string;
  source: string;
  columns: ConnectColumnInfo[];
}

export interface ConnectResponse {
  spec: PivotSpec | null;
  narrative?: string;
  source: "claude" | "none";
  note?: string;
  error?: string;
}

export async function fetchConnection(req: ConnectRequest): Promise<ConnectResponse> {
  try {
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 503 && data?.code === "NO_KEY") {
        return {
          spec: null,
          source: "none",
          note: "No ANTHROPIC_API_KEY set — build the connection manually below, or add the key in Vercel to ask in plain English.",
        };
      }
      throw new Error((data?.error as string) || `Connection planning failed (${res.status}).`);
    }
    const data = (await res.json()) as { spec: PivotSpec; narrative?: string };
    if (!data.spec?.dimension) {
      return { spec: null, source: "none", note: "The model couldn't map that to a chart — try rephrasing, or use the manual builder." };
    }
    return { spec: data.spec, narrative: data.narrative, source: "claude" };
  } catch (err) {
    return {
      spec: null,
      source: "none",
      error: (err instanceof Error ? err.message : "Connection request failed") + " — use the manual builder below.",
    };
  }
}
