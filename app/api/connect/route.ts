import { NextResponse } from "next/server";
import { planConnection } from "@/lib/anthropic";
import { withLogging } from "@/lib/apiLog";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = withLogging("api.connect", async (req: Request) => {
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
  if (!body || typeof body !== "object" || !("question" in body)) {
    return NextResponse.json({ error: "No question provided." }, { status: 400 });
  }
  try {
    const { spec, narrative } = await planConnection(body);
    return NextResponse.json({ spec, narrative });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection planning failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
