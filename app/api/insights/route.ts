import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/anthropic";
import { generateInsightsXai, hasXai } from "@/lib/xai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured.", code: "NO_KEY" },
      { status: 503 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "No snapshot provided." }, { status: 400 });
  }
  try {
    // Claude is the primary read; Grok runs in parallel as an independent second
    // opinion. A Grok failure (e.g. wrong model string) never blocks the report.
    const [claude, grok] = await Promise.allSettled([
      generateInsights(body),
      hasXai() ? generateInsightsXai(body) : Promise.reject(new Error("XAI_API_KEY not set")),
    ]);
    if (claude.status !== "fulfilled") throw claude.reason;

    const second = grok.status === "fulfilled"
      ? { summary: grok.value.summary, insights: grok.value.insights, model: grok.value.model, source: "grok" as const }
      : null;
    const secondError = grok.status === "rejected"
      ? String(grok.reason instanceof Error ? grok.reason.message : grok.reason).slice(0, 240)
      : undefined;

    return NextResponse.json({ ...claude.value, second, secondError });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insight generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
