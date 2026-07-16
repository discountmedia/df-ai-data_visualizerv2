import { writeLog, type LogEntry } from "./logStore";

/**
 * Fire-and-forget logging for server code. Logging must NEVER break a request,
 * so every write is wrapped: a missing DATABASE_URL or a DB hiccup is swallowed.
 */
export async function safeLog(entry: LogEntry): Promise<void> {
  try {
    await writeLog(entry);
  } catch {
    /* logging is best-effort — never throw into the caller's path */
  }
}

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

/**
 * Wrap a route handler to log its duration (→ Performance tab) and any thrown
 * error (→ Errors tab). Usage: `export const POST = withLogging("insights", async (req) => {…})`.
 */
export function withLogging(name: string, handler: RouteHandler): RouteHandler {
  return async (req: Request, ctx?: unknown) => {
    const start = Date.now();
    let path: string | null = null;
    try {
      path = new URL(req.url).pathname;
    } catch {
      /* non-URL request */
    }
    try {
      const res = await handler(req, ctx);
      void safeLog({
        type: "performance",
        level: res.status >= 500 ? "error" : "info",
        name,
        path,
        method: req.method,
        durationMs: Date.now() - start,
        meta: { status: res.status },
      });
      return res;
    } catch (e) {
      void safeLog({
        type: "error",
        level: "error",
        name,
        path,
        method: req.method,
        durationMs: Date.now() - start,
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  };
}
