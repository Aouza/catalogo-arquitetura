import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/modules/auth/require-admin";

// O painel começa pela lista de produtos.
export default async function AdminHomePage() {
  await requireAdmin();
  redirect(routes.adminProducts());
}
