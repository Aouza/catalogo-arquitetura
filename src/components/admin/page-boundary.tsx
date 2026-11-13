import { Suspense } from "react";

/**
 * Fronteira de Suspense de cada página do /admin. As páginas leem a sessão em runtime
 * (`requireAdmin`); o layout não re-renderiza a cada navegação, então o <Suspense> dele
 * não cobre a troca de página nem a mudança de filtros (searchParams).
 */
export function AdminPageBoundary({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-4 text-body text-fg-muted">Carregando…</p>}>{children}</Suspense>;
}
