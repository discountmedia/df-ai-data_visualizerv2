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

/**
 * Resolve the connection string from the env. The Neon–Vercel integration sets
 * DATABASE_URL but also a set of aliases (and the Vercel-Postgres template uses
 * POSTGRES_URL*), so accept the common names — pooled first, then unpooled — so
 * this works no matter which the integration populated. The neon() HTTP driver
 * is happy with either a pooled or a direct connection string.
 */
function resolveDbUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    undefined
  );
}

export function getSql() {
  const url = resolveDbUrl();
  if (!url) {
    throw new Error(
      "No Postgres connection string found. Expected DATABASE_URL (or POSTGRES_URL) " +
        "from the Neon–Vercel integration. For local dev run `vercel env pull .env.local`."
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
