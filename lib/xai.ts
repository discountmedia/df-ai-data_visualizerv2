import type { Insight } from "./types";
import { INSIGHTS_SYSTEM, parseJson } from "./anthropic";

/**
 * xAI (Grok) client — used as an independent SECOND OPINION alongside Claude.
 * xAI's API is OpenAI-compatible, so we POST to /chat/completions with fetch
 * (no SDK dependency). The model is configurable so the exact Grok version can
 * be set in Vercel without a code change.
 */

const XAI_URL = "https://api.x.ai/v1/chat/completions";
// Set XAI_MODEL in Vercel to the exact string (e.g. "grok-4.3" or "grok-4.20-0309-reasoning").
export const XAI_MODEL = process.env.XAI_MODEL || "grok-4.20-0309-reasoning";

export function hasXai(): boolean {
  return !!process.env.XAI_API_KEY;
}

export async function xaiChat(system: string, userContent: string, maxTokens = 2000): Promise<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY not set.");
  const res = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`xAI ${res.status} (model "${XAI_MODEL}"): ${txt.slice(0, 240)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("xAI returned no content.");
  return content;
}

export async function generateInsightsXai(input: unknown): Promise<{ summary: string; insights: Insight[]; model: string }> {
  const text = await xaiChat(INSIGHTS_SYSTEM, JSON.stringify(input), 3000);
  const parsed = parseJson(text);
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const insights: Insight[] = Array.isArray(parsed.insights)
    ? parsed.insights
        .filter((i: unknown): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i: Record<string, unknown>): Insight => ({
          title: String(i.title ?? "").trim(),
          body: String(i.body ?? "").trim(),
          severity: i.severity === "act" ? "act" : i.severity === "watch" ? "watch" : "info",
        }))
        .filter((i) => i.title || i.body)
    : [];
  return { summary, insights, model: XAI_MODEL };
}
