import type { ParsedFile, SchemaProfile } from "./types";
import { profileColumns, heuristicSchema } from "./profile";

export interface InferenceResult {
  schema: SchemaProfile;
  usedFallback: boolean;
  note?: string;
}

export async function inferSchemaClient(parsed: ParsedFile): Promise<InferenceResult> {
  const columns = profileColumns(parsed.rows);
  const sampleRows = parsed.rows.slice(0, 25);
  try {
    const res = await fetch("/api/infer-schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns, sampleRows }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data?.code === "NO_KEY") {
        return {
          schema: heuristicSchema(parsed.rows), usedFallback: true,
          note: "No ANTHROPIC_API_KEY set — using heuristic inference. Set the key in Vercel to enable AI schema inference.",
        };
      }
      throw new Error(data?.error || `Inference failed (${res.status}).`);
    }
    const data = (await res.json()) as { schema: SchemaProfile };
    return { schema: data.schema, usedFallback: false };
  } catch (err) {
    return {
      schema: heuristicSchema(parsed.rows), usedFallback: true,
      note: (err instanceof Error ? err.message : "Inference error") + " — using heuristic inference instead.",
    };
  }
}
