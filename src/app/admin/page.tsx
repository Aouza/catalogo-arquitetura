import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/modules/auth/require-admin";
import { AdminPageBoundary } from "@/components/admin/page-boundary";

// O painel começa pela lista de produtos.
async function AdminHomePageContent(): Promise<null> {
  await requireAdmin();
  redirect(routes.adminProducts());
}

export default function AdminHomePage() {
  return (
    <AdminPageBoundary>
      <AdminHomePageContent />
    </AdminPageBoundary>
  );
}
