import Anthropic from "@anthropic-ai/sdk";
import type { ColumnProfile, Row, SchemaProfile, Insight } from "./types";

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

const INSIGHTS_SYSTEM = `You are an operations analyst for a forklift dealership. You receive a COMPACT,
already-computed snapshot of one inventory export: fleet counts, work-stage mix,
sale-type mix, the top priority units (already scored by a deterministic engine),
per-location stage counts, and sales rollups. Some fields may be missing.

Your job: turn the numbers into a short operational read for a yard manager —
what to act on, where the risk is, what's healthy. The priority SCORES are given;
do NOT re-score or invent rankings. Be concrete and grounded ONLY in the supplied
numbers (cite real counts/locations). No filler, no generic advice.

The dashboard's primary priority driver is committed-but-unfinished units (a
customer has paid/committed but the unit isn't deliverable) — lead with those if
present.

Return STRICT JSON ONLY (no prose, no markdown fences):
{
  "summary": string,                      // 1–2 sentences: the headline read
  "insights": [                           // 3–6 items, ordered most-urgent first
    { "title": string,                    // short, specific (e.g. "5 paid units stuck at diagnosis")
      "body": string,                     // 1–2 sentences, actionable, cites numbers
      "severity": "act" | "watch" | "info" }
  ]
}`;

export async function generateInsights(input: unknown): Promise<{ summary: string; insights: Insight[] }> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: INSIGHTS_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
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
  return { summary, insights };
}

const CONNECT_SYSTEM = `You translate a plain-English question about a forklift dealer's spreadsheet into ONE pivot/cross-tab specification that the app computes deterministically. You do NOT compute anything — you only choose which columns to group by and what to measure.

You receive: the user's question, the data "source" (which stacked table the rows come from), and the list of available columns with their inferred role, type, and a few sample values.

Return STRICT JSON ONLY (no prose, no markdown fences):
{
  "spec": {
    "dimension": string,                 // EXACT column name — its values become the chart's rows/bars
    "breakdown": string | null,          // EXACT column name for a second split (grouped bars), or null
    "measure": { "kind": "count" | "sum" | "avg", "column": string | null },
    "topN": number,                      // how many dimension values to keep (default 12)
    "title": string                      // short, specific chart title
  },
  "narrative": string                    // 1–2 plain sentences on what this view will reveal and why it answers the question
}

Rules:
- "dimension", "breakdown", and measure "column" MUST be exact names from the provided columns (or null where allowed). Never invent columns.
- Use measure.kind "count" unless the question implies summing or averaging a NUMBER column (e.g. "total sales $" → sum of a price column; "average hours" → avg). For count, set "column": null.
- Pick the dimension that the question is really asking to break results down by (e.g. "which salesman" → the sold-by/rep column). Use "breakdown" for a second factor ("...of which make" → make column).
- Prefer columns with role identifier/sale_type/work_stage/location/metric over near-empty "other" columns when several fit.
- Keep "narrative" grounded in the chosen columns; do not claim specific numbers (you haven't seen the data).`;

export async function planConnection(input: unknown): Promise<{ spec: Record<string, any>; narrative: string }> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: CONNECT_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const parsed = parseJson(text);
  const spec = parsed.spec && typeof parsed.spec === "object" ? parsed.spec : {};
  const narrative = typeof parsed.narrative === "string" ? parsed.narrative : "";
  return { spec, narrative };
}

const SUMMARIZE_SYSTEM = `You are an operations analyst for a forklift dealership. You receive a COMPACT snapshot of ONE category tab from an inventory dashboard: the category name, its already-computed headline numbers, and the names of the other tabs. Turn it into a short, concrete operational read for a yard/sales manager — what the numbers mean and what to do about them.

Ground EVERY claim in the supplied numbers and cite them. No filler, no generic advice, no invented figures. If the numbers signal a problem (e.g. committed units with open work, heavy discounting), lead with it.

Return STRICT JSON ONLY (no prose, no markdown fences):
{
  "narrative": string,              // 2-4 sentences, the operational read
  "suggestedQuestions": [string]    // 2-4 specific cross-tab questions a manager would ask next (reference the other tab names / real fields)
}`;

export async function summarizeCategory(input: unknown): Promise<{ narrative: string; suggestedQuestions: string[] }> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SUMMARIZE_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const parsed = parseJson(text);
  const narrative = typeof parsed.narrative === "string" ? parsed.narrative : "";
  const suggestedQuestions = Array.isArray(parsed.suggestedQuestions)
    ? parsed.suggestedQuestions.map((q: unknown) => String(q)).filter(Boolean).slice(0, 4)
    : [];
  return { narrative, suggestedQuestions };
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
