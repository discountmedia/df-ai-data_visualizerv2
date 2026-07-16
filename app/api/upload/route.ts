import { NextResponse } from "next/server";
import { getSql, ensureSchema } from "@/lib/db";
import { ingestReport } from "@/lib/ingestCsv";
import { safeLog } from "@/lib/apiLog";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHUNK_SIZE = 400;

/**
 * POST /api/upload — multipart form:
 *   file        the daily report (.csv / .xlsx)
 *   uploaded_by (optional) who is uploading; defaults to "Admin"
 *   source      (optional) "upload" | "test-data"
 *
 * Upserts rows keyed by inventory id. Unchanged rows (same content hash) are
 * ignored; changed rows are updated; new rows inserted. Records one audit row.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  const uploadedBy = (form.get("uploaded_by") || "").toString().trim() || "Admin";
  const sourceRaw = (form.get("source") || "upload").toString();
  const source = sourceRaw === "test-data" ? "test-data" : "upload";

  let ingest;
  try {
    const buf = await file.arrayBuffer();
    ingest = ingestReport(buf);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not parse the file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (ingest.rows.length === 0) {
    return NextResponse.json(
      { error: "No rows with a usable inventory-URL id were found.", skippedNoId: ingest.skippedNoId },
      { status: 400 }
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();

    // Open the audit row first so rows can reference it; finalize counts after.
    const [upload] = (await sql`
      INSERT INTO uploads (uploaded_by, filename, source, total_rows)
      VALUES (${uploadedBy}, ${file.name}, ${source}, ${ingest.rows.length})
      RETURNING id
    `) as { id: number }[];
    const uploadId = upload.id;

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (let i = 0; i < ingest.rows.length; i += CHUNK_SIZE) {
      const chunk = ingest.rows.slice(i, i + CHUNK_SIZE);
      const payload = JSON.stringify(chunk);
      const res = (await sql`
        INSERT INTO inventory_rows (inventory_id, data, content_hash, last_upload_id)
        SELECT x.inventory_id, x.data, x.content_hash, ${uploadId}
        FROM jsonb_to_recordset(${payload}::jsonb)
          AS x(inventory_id text, data jsonb, content_hash text)
        ON CONFLICT (inventory_id) DO UPDATE
          SET data = EXCLUDED.data,
              content_hash = EXCLUDED.content_hash,
              updated_at = now(),
              last_upload_id = EXCLUDED.last_upload_id
          WHERE inventory_rows.content_hash <> EXCLUDED.content_hash
        RETURNING (xmax = 0) AS inserted
      `) as { inserted: boolean }[];

      for (const r of res) r.inserted ? inserted++ : updated++;
      unchanged += chunk.length - res.length; // conflicts skipped by the WHERE
    }

    await sql`
      UPDATE uploads
      SET inserted = ${inserted}, updated = ${updated}, skipped = ${unchanged}
      WHERE id = ${uploadId}
    `;

    void safeLog({
      type: "system",
      name: "upload.complete",
      message: `Upload by ${uploadedBy}: +${inserted} / ~${updated} / =${unchanged}`,
      path: "/api/upload",
      method: "POST",
      account: uploadedBy,
      meta: { source, totalRows: ingest.rows.length, inserted, updated, unchanged },
    });
    return NextResponse.json({
      ok: true,
      uploadId,
      uploadedBy,
      source,
      totalRows: ingest.rows.length,
      inserted,
      updated,
      unchanged,
      skippedNoId: ingest.skippedNoId,
      collapsedDupes: ingest.collapsedDupes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    void safeLog({ type: "error", level: "error", name: "api.upload", message, path: "/api/upload", method: "POST" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/upload — audit summary for the admin panel. */
export async function GET() {
  try {
    await ensureSchema();
    const sql = getSql();

    const recent = (await sql`
      SELECT id, uploaded_by, uploaded_at, filename, source,
             total_rows, inserted, updated, skipped
      FROM uploads
      ORDER BY uploaded_at DESC
      LIMIT 10
    `) as Record<string, unknown>[];

    const [counts] = (await sql`
      SELECT count(*)::int AS row_count FROM inventory_rows
    `) as { row_count: number }[];

    return NextResponse.json({
      last: recent[0] ?? null,
      recent,
      storedRows: counts?.row_count ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load upload history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
