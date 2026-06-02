import { INSIGHTS_SYSTEM, parseJson } from "./anthropic";
import type { Insight, SecondOpinion } from "./types";

/**
 * Independent SECOND OPINIONS on the insights report from OpenAI-compatible
 * providers (xAI/Grok, OpenAI/GPT). Each runs the same prompt as Claude; the
 * UI shows them side by side so divergence is visible. A provider is only used
 * when its key is set, and any failure is isolated (never blocks the report).
 */

interface Provider {
  name: SecondOpinion["source"];
  url: string;
  key: string | undefined;
  model: string;
  jsonMode?: boolean;
}

function providers(): Provider[] {
  return [
    { name: "grok", url: "https://api.x.ai/v1/chat/completions", key: process.env.XAI_API_KEY, model: process.env.XAI_MODEL || "grok-4.20-0309-reasoning" },
    { name: "openai", url: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-4o", jsonMode: true },
  ];
}

async function callProvider(p: Provider, input: unknown): Promise<SecondOpinion> {
  const body: Record<string, unknown> = {
    model: p.model,
    messages: [
      { role: "system", content: INSIGHTS_SYSTEM },
      { role: "user", content: JSON.stringify(input) },
    ],
    max_tokens: 3000,
  };
  if (p.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} (model "${p.model}"): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error(`no content (model "${p.model}")`);
  const parsed = parseJson(text);
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
  return { source: p.name, model: p.model, summary: typeof parsed.summary === "string" ? parsed.summary : "", insights };
}

export async function generateSecondOpinions(input: unknown): Promise<{ opinions: SecondOpinion[]; errors: Record<string, string> }> {
  const enabled = providers().filter((p) => p.key);
  const settled = await Promise.allSettled(enabled.map((p) => callProvider(p, input)));
  const opinions: SecondOpinion[] = [];
  const errors: Record<string, string> = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled" && (r.value.summary || r.value.insights.length)) opinions.push(r.value);
    else if (r.status === "rejected") errors[enabled[i].name] = String(r.reason instanceof Error ? r.reason.message : r.reason).slice(0, 200);
  });
  return { opinions, errors };
}
