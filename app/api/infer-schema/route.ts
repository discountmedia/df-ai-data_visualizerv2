import { NextResponse } from "next/server";
import { inferSchema } from "@/lib/anthropic";
import type { ColumnProfile, Row } from "@/lib/types";
import { withLogging, safeLog } from "@/lib/apiLog";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withLogging("api.infer-schema", async (req: Request) => {
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
    void safeLog({ type: "system", name: "schema.inferred", message: `Inferred schema for ${columns.length} columns`, meta: { columns: columns.length, source: schema?.source } });
    return NextResponse.json({ schema });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inference failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
