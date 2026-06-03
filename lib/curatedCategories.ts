/**
 * The operator's authoritative field → category grouping (replaces the noisy
 * role auto-inference). Columns are the ACTUAL names in CuratedFields-TEST.xlsx;
 * a few extras not in the source list are slotted into the closest category.
 */

export interface CuratedCategory {
  id: string;
  label: string;
  columns: string[];
}

export const CURATED_CATEGORIES: CuratedCategory[] = [
  { id: "specs", label: "Equipment & Inventory Specifications", columns: [
    "Capacity", "Check in model", "Equipment on rent", "Hours", "Make", "Serial Number",
    "Swapped Lift", "Type", "Year", "Fork Length", "Fuel type", "Tires",
  ] },
  { id: "sales", label: "Sales Process & Deal Flow", columns: [
    "SOLD!", "Sold To", "Sales Names Sold by", "Forklift Progress", "Final sale price",
    "Final sale price Differential", "Retail Price", "first leads", "Notes", "Notes Summary",
  ] },
  { id: "financials", label: "Financials, Invoicing & Payments", columns: [
    "Deposit", "Deposit date", "Down Payment type", "Financed", "Invoice Fuel", "InvoiceTradeAmount2",
    "Payment Status", "Payment Type", "QB Invoice Number", "Remaining balance",
    "Who took the down deposit", "who took remaining balance",
  ] },
  { id: "service", label: "Service, Maintenance & Quality Assurance", columns: [
    "Diagnosed", "Serviced", "Serviced by", "final sign off acceptable", "final sign off video upload",
    "notes final sign off", "Notes for Driver",
  ] },
  { id: "comp", label: "Employee Commissions & Compensation", columns: [
    "Commission Draw", "SPIFF", "SPIFF compare",
  ] },
  { id: "contracts", label: "Contracts & Digital Documentation", columns: [
    "CC Auth Signed", "Paid in full feedback email", "PandaDoc Signed", "Record UUID",
  ] },
  { id: "location", label: "Logistics & Location", columns: ["FOB City and State"] },
  { id: "staff", label: "Staff & Organization Details", columns: [
    "Staff::DEPARTMENT", "Staff::NAME", "Staff::TITLE", "Staff::USERNAME",
  ] },
  { id: "leads", label: "Lead Routing (Round Robin)", columns: [
    "round_robin::round_robin_call_in", "round_robin::round_robin_chat", "round_robin::round_robin_date",
    "round_robin::round_robin_walk_in_denver", "round_robin::round_robin_walk_in_dfw",
    "round_robin::round_robin_walk_in_phoenix", "round_robin::round_robin_walk_in_vegas",
  ] },
  { id: "email", label: "System Logs & Email Tracking", columns: [
    "email::email_date", "email::email_from_address", "email::email_language", "email::email_price",
    "email::email_server_status", "email::email_to_address", "email::inventory_record_uuid", "email::staff_user",
  ] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const COL_TO_CAT = new Map<string, string>();
for (const c of CURATED_CATEGORIES) for (const col of c.columns) COL_TO_CAT.set(norm(col), c.id);

/** Category id for an actual column name (normalized match), or undefined. */
export function categoryIdOf(columnName: string): string | undefined {
  return COL_TO_CAT.get(norm(columnName));
}

export function columnsInCategory(id: string): string[] {
  return CURATED_CATEGORIES.find((c) => c.id === id)?.columns ?? [];
}

/** Resolve the first present column from a category that matches a name pattern. */
export function curatedColumn(present: string[], categoryId: string, re: RegExp): string | undefined {
  const inCat = new Set(columnsInCategory(categoryId).map(norm));
  return present.find((c) => inCat.has(norm(c)) && re.test(c));
}
