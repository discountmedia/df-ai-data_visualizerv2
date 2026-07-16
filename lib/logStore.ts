import { getSql, ensureSchema } from "./db";

/**
 * Server-only log store (Neon). Writes/reads the `logs` table (schema in db.ts).
 * Never import from client code. All reads/writes go through here so the API
 * routes stay thin and the sort-column whitelist lives in one place.
 */

export type LogType = "auth" | "performance" | "error" | "system";
export type LogLevel = "info" | "warn" | "error" | "alert";

export interface LogEntry {
  type: LogType;
  level?: LogLevel;
  name: string;
  message?: string | null;
  ip?: string | null;
  method?: string | null;
  path?: string | null;
  userAgent?: string | null;
  filemakerUa?: boolean;
  durationMs?: number | null;
  account?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface LogRow {
  id: string;
  ts: string;
  type: LogType;
  level: LogLevel;
  name: string;
  message: string | null;
  ip: string | null;
  method: string | null;
  path: string | null;
  user_agent: string | null;
  filemaker_ua: boolean;
  duration_ms: number | null;
  account: string | null;
  meta: Record<string, unknown> | null;
}

export async function writeLog(entry: LogEntry): Promise<void> {
  const sql = getSql();
  await ensureSchema();
  await sql`
    INSERT INTO logs (type, level, name, message, ip, method, path, user_agent, filemaker_ua, duration_ms, account, meta)
    VALUES (
      ${entry.type}, ${entry.level ?? "info"}, ${entry.name}, ${entry.message ?? null},
      ${entry.ip ?? null}, ${entry.method ?? null}, ${entry.path ?? null}, ${entry.userAgent ?? null},
      ${entry.filemakerUa ?? false}, ${entry.durationMs ?? null}, ${entry.account ?? null},
      ${entry.meta ? JSON.stringify(entry.meta) : null}
    )
  `;
}

// Whitelist of sortable columns → real column names. Sort key + direction are
// interpolated into SQL, so they MUST come from this map (never user input).
export const LOG_SORT_COLUMNS = {
  ts: "ts",
  type: "type",
  level: "level",
  name: "name",
  ip: "ip",
  path: "path",
  method: "method",
  duration_ms: "duration_ms",
  account: "account",
} as const;
export type LogSortKey = keyof typeof LOG_SORT_COLUMNS;

export interface QueryParams {
  type?: LogType | "all";
  q?: string;
  sort?: LogSortKey;
  order?: "asc" | "desc";
  limit: number;
  offset: number;
}

export async function queryLogs(params: QueryParams): Promise<{ rows: LogRow[]; total: number }> {
  const sql = getSql();
  await ensureSchema();

  const sortCol = LOG_SORT_COLUMNS[params.sort ?? "ts"] ?? "ts";
  const order = params.order === "asc" ? "ASC" : "DESC";

  const where: string[] = [];
  const args: (string | number)[] = [];
  let i = 1;
  if (params.type && params.type !== "all") {
    where.push(`type = $${i++}`);
    args.push(params.type);
  }
  if (params.q && params.q.trim()) {
    where.push(`(name ILIKE $${i} OR message ILIKE $${i} OR path ILIKE $${i} OR ip ILIKE $${i} OR user_agent ILIKE $${i} OR account ILIKE $${i})`);
    args.push(`%${params.q.trim()}%`);
    i++;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // sortCol/order are whitelisted above; q/type/limit/offset are parameterized.
  // The neon() function can be called directly with (queryString, params[]).
  const rows = (await sql(
    `SELECT * FROM logs ${whereSql} ORDER BY ${sortCol} ${order} NULLS LAST, id ${order} LIMIT $${i} OFFSET $${i + 1}`,
    [...args, params.limit, params.offset]
  )) as unknown as LogRow[];
  const countRes = (await sql(`SELECT count(*)::int AS count FROM logs ${whereSql}`, args)) as unknown as { count: number }[];

  return { rows, total: countRes[0]?.count ?? 0 };
}

/** Count of alert-level events since a timestamp — drives the nav bubble. */
export async function alertCountSince(sinceIso: string | null): Promise<number> {
  const sql = getSql();
  await ensureSchema();
  const res = sinceIso
    ? ((await sql`SELECT count(*)::int AS count FROM logs WHERE level = 'alert' AND ts > ${sinceIso}`) as { count: number }[])
    : ((await sql`SELECT count(*)::int AS count FROM logs WHERE level = 'alert'`) as { count: number }[]);
  return res[0]?.count ?? 0;
}
