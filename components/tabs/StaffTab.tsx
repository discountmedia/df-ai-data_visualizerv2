"use client";

import type { TabContext } from "./CategoryTab";
import { TabHeader } from "./TabHeader";
import { TabAI } from "./TabAI";
import { SalesTeam } from "../sales/SalesTeam";
import { fmt } from "@/lib/format";

/** Staff = the rep leaderboard, round-robin, lead sources, email activity and
 *  unsigned chase list — all already joined in salesSummary. */
export function StaffTab({ category, sales, entities, schema, parsed }: TabContext) {
  return (
    <div className="space-y-4 fade-up">
      <TabHeader category={category} />
      {sales ? (
        <SalesTeam summary={sales} />
      ) : (
        <p className="text-xs text-ink-faint">No staff roster or sales attribution found in this file.</p>
      )}
      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={sales ? [
          `Reps on team: ${sales.reps.length}`,
          `Total units sold: ${fmt(sales.totalSold)}`,
          `Unsigned docs: ${fmt(sales.unsignedCount)}`,
          sales.emailsAvailable ? `Emails sent: ${fmt(sales.totalEmails)}` : "Email activity: not in file",
        ] : []} />
    </div>
  );
}
