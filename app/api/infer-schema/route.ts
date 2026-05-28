import { NextResponse } from "next/server";
import { inferSchema } from "@/lib/anthropic";
import type { ColumnProfile, Row } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured.", code: "NO_KEY" },
      { status: 503 }
    );
  }
  let body: { columns?: ColumnProfile[]; sampleRows?: Row[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { columns, sampleRows } = body;
  if (!Array.isArray(columns) || columns.length === 0) {
    return NextResponse.json({ error: "No column profile provided." }, { status: 400 });
  }
  try {
    const schema = await inferSchema(columns, sampleRows ?? []);
    return NextResponse.json({ schema });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inference failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
