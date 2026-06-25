// One-off schema bootstrap for the Neon DB. Mirrors ensureSchema() in lib/db.ts
// (CREATE TABLE IF NOT EXISTS — idempotent). Run with the pulled env:
//   node --env-file=.env.local scripts/migrate.mjs
// The app also runs the same DDL on the first /api/upload call, so this is just
// a way to provision the tables up front + verify connectivity.
import { neon } from "@neondatabase/serverless";

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL;

if (!url) {
  console.error("No Postgres connection string in env. Run: vercel env pull .env.local --environment=production");
  process.exit(1);
}

const sql = neon(url);

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

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log("public tables:", tables.map((t) => t.table_name).join(", ") || "(none)");

for (const t of ["uploads", "inventory_rows"]) {
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${t}
    ORDER BY ordinal_position
  `;
  console.log(`\n${t}:`);
  for (const c of cols) console.log(`  ${c.column_name} :: ${c.data_type}`);
}
console.log("\n✓ schema ready");
