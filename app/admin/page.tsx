import { AdminDashboard } from "@/components/admin/AdminDashboard";

/**
 * The admin dashboard. Gated by the backend's auth middleware, not here.
 */
export default function AdminPage() {
  return <AdminDashboard />;
}
