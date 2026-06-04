import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/anthropic";

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
    // Claude is the only analyzer — second-opinion models (Grok/GPT) were removed.
    const result = await generateInsights(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insight generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
