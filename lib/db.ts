import { neon } from "@neondatabase/serverless";

/**
 * Neon (serverless Postgres) client + idempotent schema bootstrap.
 *
 * Connection comes from DATABASE_URL (set in Vercel + .env.local). The neon()
 * HTTP driver is the right fit for serverless route handlers — no pooling/
 * connection lifecycle to manage. We never expose this to the browser; it's
 * only imported inside API routes (server-side).
 *
 * Schema is created on demand via ensureSchema() so there is no separate
 * migration step — CREATE TABLE IF NOT EXISTS is cheap and idempotent.
 */

let _sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Add it in Vercel (and .env.local for local dev)."
    );
  }
  if (!_sql) _sql = neon(url);
  return _sql;
}

let _schemaReady = false;

export async function ensureSchema() {
  if (_schemaReady) return;
  const sql = getSql();

  // Audit of every upload: who, when, where it came from, and what changed.
  await sql`
    CREATE TABLE IF NOT EXISTS uploads (
      id          BIGSERIAL PRIMARY KEY,
      uploaded_by TEXT        NOT NULL DEFAULT 'Admin',
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      filename    TEXT,
      source      TEXT        NOT NULL DEFAULT 'upload',
      total_rows  INTEGER     NOT NULL DEFAULT 0,
      inserted    INTEGER     NOT NULL DEFAULT 0,
      updated     INTEGER     NOT NULL DEFAULT 0,
      skipped     INTEGER     NOT NULL DEFAULT 0
    )
  `;

  // One row per inventory unit, keyed by the inventory-URL id. The full CSV
  // row lives in `data` (JSONB) so the schema survives column add/remove in
  // future exports. `content_hash` powers dedup: unchanged rows are ignored.
  await sql`
    CREATE TABLE IF NOT EXISTS inventory_rows (
      inventory_id   TEXT        PRIMARY KEY,
      data           JSONB       NOT NULL,
      content_hash   TEXT        NOT NULL,
      first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_upload_id BIGINT      REFERENCES uploads(id)
    )
  `;

  _schemaReady = true;
}
