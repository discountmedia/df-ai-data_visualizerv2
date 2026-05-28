import Anthropic from "@anthropic-ai/sdk";
import type { ColumnProfile, Row, SchemaProfile } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  return new Anthropic({ apiKey });
}

const INFER_SYSTEM = `You are a data-profiling engine for a forklift dealer inventory export.
The source data is messy: nulls, mixed types, deprecated columns, duplicate or
conflicting fields, inconsistent naming. Your job is to infer STRUCTURE and
SEMANTICS only — do NOT score, rank, or evaluate units.

NOTE: readiness/work-stage is often spread across MULTIPLE checkpoint columns
(e.g. diagnosed, serviced, body done, final sign off) rather than one status
column. Pick the single best work-stage column for conceptMap.workStage, but
flag the others as role "work_stage" too so they can be combined later.

You receive a compact column profile (types, null %, sample values) plus a few
sample rows. Return STRICT JSON ONLY (no prose, no markdown fences) matching:

{
  "columns": [
    { "name": string, "role": "identifier"|"location"|"work_stage"|"sale_type"|"payment_status"|"flag"|"metric"|"date"|"other",
      "trust": "trusted"|"low_signal"|"deprecated"|"duplicate", "reason": string }
  ],
  "conceptMap": {
    "unitName"?: string, "serial"?: string, "location"?: string,
    "workStage"?: string, "saleType"?: string, "paymentStatus"?: string,
    "invoiced"?: string, "signed"?: string
  },
  "workStageValueMap": { "<raw value lowercased>": "ready"|"working"|"needs_diagnosis"|"on_rent"|"sold"|"unknown" },
  "saleTypeValueMap":  { "<raw value lowercased>": "paid_in_full"|"down_payment"|"govt_po"|"rental"|"other"|"unknown" },
  "warnings": [string]
}

Rules:
- Pick ONE best column for each conceptMap key, or omit the key if none fits.
- For the chosen work_stage column, map EVERY distinct sample value to a bucket.
  Same for the sale_type column. Use "unknown" when a value is ambiguous.
- Mark columns "deprecated" when near-empty/abandoned, "duplicate" when two
  columns clearly encode the same thing (trust the fuller/cleaner one).
- Some columns may be values with stray quotes (e.g. '"Rental"'); treat the
  inner token as the value when bucketing.
- Every "reason" is one short plain-language sentence an operator can audit.
- Keep "name" values EXACTLY as given. Do not invent columns.`;

export async function inferSchema(columns: ColumnProfile[], sampleRows: Row[]): Promise<SchemaProfile> {
  const client = getClient();
  const userPayload = {
    columnProfile: columns.map((c) => ({
      name: c.name, detectedType: c.detectedType, nullPercent: c.nullPercent,
      distinctCount: c.distinctCount, sampleValues: c.sampleValues,
    })),
    sampleRows: sampleRows.slice(0, 25),
  };
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 4096, system: INFER_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("\n");
  const parsed = parseJson(text);
  const byName = new Map(columns.map((c) => [c.name, c]));
  const mergedCols: ColumnProfile[] = (parsed.columns ?? []).map(
    (mc: { name: string; role?: string; trust?: string; reason?: string }) => {
      const local = byName.get(mc.name);
      return {
        name: mc.name,
        detectedType: local?.detectedType ?? "string",
        nullPercent: local?.nullPercent ?? 0,
        distinctCount: local?.distinctCount ?? 0,
        sampleValues: local?.sampleValues ?? [],
        role: (mc.role as ColumnProfile["role"]) ?? local?.role ?? "other",
        trust: (mc.trust as ColumnProfile["trust"]) ?? local?.trust ?? "trusted",
        reason: mc.reason ?? local?.reason ?? "",
      };
    }
  );
  for (const c of columns) if (!mergedCols.find((m) => m.name === c.name)) mergedCols.push(c);
  return {
    columns: mergedCols,
    conceptMap: parsed.conceptMap ?? {},
    workStageValueMap: lowerKeys(parsed.workStageValueMap ?? {}),
    saleTypeValueMap: lowerKeys(parsed.saleTypeValueMap ?? {}),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    source: "claude",
  };
}

function parseJson(text: string): Record<string, any> {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); }
  catch {
    const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return valid JSON.");
  }
}
function lowerKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, val] of Object.entries(obj)) out[k.toLowerCase()] = val;
  return out;
}
