import { NextResponse } from "next/server";
import { summarizeCategory } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

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
  if (!body || typeof body !== "object" || !("category" in body)) {
    return NextResponse.json({ error: "No category snapshot provided." }, { status: 400 });
  }
  try {
    const { narrative, suggestedQuestions } = await summarizeCategory(body);
    return NextResponse.json({ narrative, suggestedQuestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summary generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
