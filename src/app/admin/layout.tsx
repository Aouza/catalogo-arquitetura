import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/modules/auth/require-admin";

export const metadata: Metadata = {
  title: { default: "Administração", template: "%s · Administração" },
  robots: { index: false, follow: false },
};

// A sessão é lida em runtime, então fica atrás de <Suspense> (Cache Components).
// Cada página e Server Action do admin deve chamar `requireAdmin()` de novo: layouts
// não re-renderizam a cada navegação, então esta checagem não basta sozinha.
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-4 text-body text-fg-muted">Carregando…</p>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
