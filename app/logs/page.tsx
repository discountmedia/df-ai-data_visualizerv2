import { LogsView } from "@/components/logs/LogsView";

/**
 * Standalone /logs route — exempt from the FileMaker gate (see middleware) and
 * protected by its own password. This is the always-available way in, including
 * while production is in the "waiting for PRO" state.
 */
export default function LogsPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <LogsView />
    </main>
  );
}
