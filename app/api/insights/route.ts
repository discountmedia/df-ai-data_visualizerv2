import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/anthropic";
import { generateSecondOpinions } from "@/lib/secondOpinions";

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
    // Claude is the primary read; Grok + GPT run in parallel as independent second
    // opinions. Any second-opinion failure is isolated and never blocks the report.
    const [claude, others] = await Promise.allSettled([
      generateInsights(body),
      generateSecondOpinions(body),
    ]);
    if (claude.status !== "fulfilled") throw claude.reason;
    const second = others.status === "fulfilled" ? others.value : { opinions: [], errors: {} };
    return NextResponse.json({ ...claude.value, others: second.opinions, othersErrors: second.errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insight generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
