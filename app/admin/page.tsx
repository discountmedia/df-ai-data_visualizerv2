import { AdminUploads } from "@/components/admin/AdminUploads";

/**
 * Standalone /admin route. The same panel is also surfaced as the "Admin" nav
 * tab inside the dashboard (app/page.tsx) — this route is the direct URL.
 */
export default function AdminPage() {
  return (
    <main className="relative z-10 mx-auto max-w-4xl px-5 py-10">
      <div className="top-rule mb-6 w-12" aria-hidden />
      <AdminUploads />
    </main>
  );
}
