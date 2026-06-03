import type {
  Row,
  CellValue,
  EntitySet,
  SchemaProfile,
  SalesSummary,
  SalesRep,
  SoldUnit,
  RoundRobinQueue,
  LeadSource,
} from "./types";
import { findColumn } from "./entities";
import { resolveSale, isSigned, toNum } from "./bucketize";

/* --- small helpers --- */

/** Names arrive padded with a trailing employee id: "Ross Kohlmeier   1108". */
function cleanName(v: CellValue): { name: string; repId: string | null } | null {
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // The export writes literal "undefined"/"null"/"N/A" for unattributed rows —
  // never let those become a phantom rep that tops the leaderboard.
  if (/^(undefined|null|n\/?a|none|unknown|-+)$/i.test(s)) return null;
  const m = s.match(/^(.*?)\s+(\d{2,})\s*$/);
  if (m) return { name: m[1].trim(), repId: m[2] };
  return { name: s, repId: null };
}

/**
 * Fallback: resolve a rep's sender address by first name when the username join
 * misses. Strict on purpose — rejects compound/paired seller strings ("Aaron G
 * & Zellner", "Jennie & Rico"), requires exactly one sender to match by username
 * or exact local-part, and — when that sender is on the roster — confirms it is
 * the SAME person (not just a first-name twin). Returns null rather than ever
 * hand one rep another's address.
 */
function matchEmailByFirstName(
  name: string,
  byUsername: Map<string, string>,
  usernameToName: Map<string, string>
): string | null {
  if (/[&,/]/.test(name)) return null; // paired/compound seller string — can't attribute
  const first = name.toLowerCase().split(/\s+/).filter(Boolean)[0];
  if (!first) return null;
  const matches: { user: string; addr: string }[] = [];
  for (const [user, addr] of byUsername) {
    const local = (addr.split("@")[0] ?? "").toLowerCase();
    if (user === first || local === first) matches.push({ user, addr });
  }
  if (matches.length !== 1) return null; // ambiguous → don't guess
  // If the matched sender maps to a known roster name, it must be this same rep.
  const full = usernameToName.get(matches[0].user);
  if (full && full.toLowerCase() !== name.toLowerCase()) return null;
  return matches[0].addr;
}

/* --- main --- */

export function deriveSales(entities: EntitySet, schema: SchemaProfile): SalesSummary {
  const notes: string[] = [];
  const baseCols = entities.base.columns;
  const baseRows = entities.rowsByEntity["base"] ?? [];

  // Resolve the sales-relevant columns from the base (unit) table.
  const soldByCol = findColumn(baseCols, [/sold\s*by/i, /sales.*sold/i]);
  const saleTypeCol =
    schema.conceptMap.saleType ?? findColumn(baseCols, [/^sold!?$/i, /sale\s*type/i]);
  const signedCol =
    schema.conceptMap.signed ?? findColumn(baseCols, [/pandadoc.*sign/i, /\bsigned\b/i]);
  const priceCol = findColumn(baseCols, [
    /^final\s*sale\s*price$/i,
    /final\s*sale\s*price(?!.*(differential|6))/i,
    /sold\s*price/i,
  ]);
  const customerCol = findColumn(baseCols, [/^sold\s*to$/i, /sold\s*to(?!6)/i]);
  const makeCol = findColumn(baseCols, [/^make$/i, /manufacturer/i]);
  const modelCol = findColumn(baseCols, [/check\s*in\s*model/i, /^model$/i]);
  const typeCol = findColumn(baseCols, [/^type$/i, /category/i]);
  const leadCol = findColumn(baseCols, [/first\s*leads/i, /lead\s*source/i]);

  if (!soldByCol) notes.push("No 'sold by' column found — rep sales could not be attributed.");
  if (!saleTypeCol) notes.push("No sale-type column found — sale classification is limited.");

  // --- Staff roster (dimension): name/username -> location/title ---
  const staffEntity = entities.related.find(
    (e) =>
      /staff/i.test(e.key) ||
      (findColumn(e.columns, [/name/i]) && findColumn(e.columns, [/department|dept/i]))
  );
  const rosterByName = new Map<string, { dept: string | null; title: string | null; username: string | null }>();
  const usernameToName = new Map<string, string>();
  if (staffEntity) {
    const nameCol = findColumn(staffEntity.columns, [/name/i]);
    const deptCol = findColumn(staffEntity.columns, [/department|dept/i]);
    const titleCol = findColumn(staffEntity.columns, [/title/i]);
    const userCol = findColumn(staffEntity.columns, [/username|user/i]);
    const rows = entities.rowsByEntity[staffEntity.key] ?? [];
    for (const r of rows) {
      const nm = nameCol ? cleanName(r[nameCol]) : null;
      if (!nm) continue;
      const dept = deptCol && r[deptCol] != null ? String(r[deptCol]).trim() : null;
      const title = titleCol && r[titleCol] != null ? String(r[titleCol]).trim() : null;
      const uname = userCol && r[userCol] != null ? String(r[userCol]).trim().toLowerCase() : null;
      if (!rosterByName.has(nm.name.toLowerCase()))
        rosterByName.set(nm.name.toLowerCase(), { dept, title, username: uname });
      if (uname) usernameToName.set(uname, nm.name);
    }
  }

  // --- Email volume (activity proxy) + rep sender address, keyed by username ---
  // There is no contact-email column on the Staff roster; a rep's email is their
  // outbound sender address (email::email_from_address), joined by the same staff
  // username used for the email counts.
  const emailEntity = entities.related.find(
    (e) => /email/i.test(e.key) && findColumn(e.columns, [/staff_user|from_address/i])
  );
  const emailsByUsername = new Map<string, number>();
  const emailAddrByUsername = new Map<string, string>();
  let totalEmails: number | null = null;
  if (emailEntity) {
    const userCol = findColumn(emailEntity.columns, [/staff_user/i]);
    const fromCol = findColumn(emailEntity.columns, [/from_address/i]);
    const senderCol = userCol ?? fromCol; // count key — prefer the username
    const rows = entities.rowsByEntity[emailEntity.key] ?? [];
    totalEmails = rows.length;
    for (const r of rows) {
      const key = senderCol && r[senderCol] != null ? String(r[senderCol]).trim().toLowerCase() : null;
      if (key) emailsByUsername.set(key, (emailsByUsername.get(key) ?? 0) + 1);
      // First stable from-address per username is the rep's own address.
      const uname = userCol && r[userCol] != null ? String(r[userCol]).trim().toLowerCase() : key;
      const addr = fromCol && r[fromCol] != null ? String(r[fromCol]).trim() : null;
      if (uname && addr && /@/.test(addr) && !emailAddrByUsername.has(uname)) emailAddrByUsername.set(uname, addr);
    }
  } else {
    notes.push("No email table detected — 'emails sent' is unavailable.");
  }
  notes.push("No phone column in the export — rep phone shows as “—”.");

  // --- Build the rep map: anchor on sellers ∪ staff roster ---
  const reps = new Map<string, SalesRep>();
  const ensureRep = (name: string, repId: string | null): SalesRep => {
    const k = name.toLowerCase();
    let rep = reps.get(k);
    if (!rep) {
      const roster = rosterByName.get(k);
      rep = {
        name,
        repId,
        location: roster?.dept ?? null,
        title: roster?.title ?? null,
        email: null,
        phone: null,
        unitsSold: 0,
        totalSale: 0,
        avgSale: null,
        emailsSent: null,
        unsignedDocs: 0,
      };
      reps.set(k, rep);
    }
    if (repId && !rep.repId) rep.repId = repId;
    return rep;
  };

  // Seed from roster so the whole team shows even with no sales yet.
  for (const [k, info] of rosterByName) {
    ensureRep(usernameToName.get(info.username ?? "") ?? capitalize(k), null);
    const rep = reps.get(k);
    if (rep) {
      rep.location = info.dept ?? rep.location;
      rep.title = info.title ?? rep.title;
    }
  }

  // Sold units → attribute to reps and collect the unsigned-doc worklist.
  const unsignedWorklist: SoldUnit[] = [];
  const soldUnitsByRep: Record<string, SoldUnit[]> = {};
  const cell = (col: string | undefined, r: Row) => (col && r[col] != null ? String(r[col]) : null);
  if (soldByCol) {
    for (const r of baseRows) {
      const rawSale = cell(saleTypeCol, r);
      if (rawSale == null) continue; // only committed units are relevant here
      const nm = cleanName(r[soldByCol]);
      const signed = signedCol ? isSigned(r[signedCol]) : false;
      const price = priceCol ? toNum(r[priceCol]) : null;
      const unit: SoldUnit = {
        rep: nm?.name ?? "(unattributed)",
        make: cell(makeCol, r),
        model: cell(modelCol, r),
        type: cell(typeCol, r),
        saleType: resolveSale(rawSale, schema),
        saleTypeRaw: rawSale,
        price,
        customer: cell(customerCol, r),
        signed,
      };
      const rep = nm ? ensureRep(nm.name, nm.repId) : null;
      if (rep) {
        rep.unitsSold += 1;
        if (price != null) rep.totalSale = (rep.totalSale ?? 0) + price;
        (soldUnitsByRep[nm!.name] ??= []).push(unit);
      }
      if (unsignedQualifies(rawSale, signed)) {
        unsignedWorklist.push(unit);
        if (rep) rep.unsignedDocs += 1;
      }
    }
  }

  // Attach email count + sender address via roster username.
  for (const rep of reps.values()) {
    const roster = rosterByName.get(rep.name.toLowerCase());
    const uname = roster?.username;
    if (emailEntity) {
      const count = uname ? emailsByUsername.get(uname) : undefined;
      rep.emailsSent = count ?? 0;
    }
    // Username match first; fall back to an unambiguous first-name match so reps
    // without a roster row still resolve. Never guess on a collision.
    rep.email = (uname ? emailAddrByUsername.get(uname) : undefined)
      ?? matchEmailByFirstName(rep.name, emailAddrByUsername, usernameToName)
      ?? null;
    rep.avgSale = rep.unitsSold > 0 && rep.totalSale != null ? Math.round(rep.totalSale / rep.unitsSold) : null;
    if (rep.unitsSold === 0) rep.totalSale = null;
  }

  // Keep reps who either sold something or exist in the roster (drop empty noise).
  let repList = Array.from(reps.values()).filter(
    (r) => r.unitsSold > 0 || rosterByName.has(r.name.toLowerCase())
  );
  repList.sort(
    (a, b) =>
      b.unitsSold - a.unitsSold ||
      (b.totalSale ?? 0) - (a.totalSale ?? 0) ||
      (b.emailsSent ?? 0) - (a.emailsSent ?? 0)
  );

  // --- Round-robin snapshot (live "next up" per queue) ---
  const rrEntity = entities.related.find((e) => /round.?robin/i.test(e.key));
  const roundRobin: RoundRobinQueue[] = [];
  let roundRobinAsOf: string | null = null;
  if (rrEntity) {
    const rows = entities.rowsByEntity[rrEntity.key] ?? [];
    const firstVal = (re: RegExp): string | null => {
      const col = findColumn(rrEntity.columns, [re]);
      if (!col) return null;
      for (const r of rows) if (r[col] != null) return String(r[col]);
      return null;
    };
    const queues: [string, RegExp][] = [
      ["Denver walk-in", /walk_in_denver|denver/i],
      ["DFW walk-in", /walk_in_dfw|dfw/i],
      ["Phoenix walk-in", /walk_in_phoenix|phoenix/i],
      ["Vegas walk-in", /walk_in_vegas|vegas/i],
      ["Call-in", /call_?in/i],
      ["Chat", /chat/i],
    ];
    for (const [label, re] of queues) {
      const raw = firstVal(re);
      if (raw != null) roundRobin.push({ queue: label, assignee: cleanName(raw)?.name ?? raw.trim() });
    }
    const dateRaw = firstVal(/date/i);
    if (dateRaw) roundRobinAsOf = dateRaw;
    if (roundRobin.length) notes.push("Round-robin shows the current 'next up' per queue (snapshot, not a history).");
  }

  // --- Lead sources ---
  const leadSources: LeadSource[] = [];
  if (leadCol) {
    const counts = new Map<string, number>();
    for (const r of baseRows) {
      const v = r[leadCol];
      if (v == null) continue;
      const key = String(v).trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [source, count] of counts) leadSources.push({ source, count });
    leadSources.sort((a, b) => b.count - a.count);
  }

  return {
    totalSold: repList.reduce((s, r) => s + r.unitsSold, 0),
    reps: repList,
    unsignedWorklist,
    unsignedCount: unsignedWorklist.length,
    roundRobin,
    roundRobinAsOf,
    leadSources: leadSources.slice(0, 10),
    soldUnitsByRep,
    emailsAvailable: !!emailEntity,
    totalEmails,
    notes,
  };
}

/** Worklist rule (per spec): exclude Govt PO and Removed-from-Inventory. */
function unsignedQualifies(rawSale: string, signed: boolean): boolean {
  if (signed) return false;
  if (/govt|government|\bpo\b/i.test(rawSale)) return false;
  if (/removed/i.test(rawSale)) return false;
  return true;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
