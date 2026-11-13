import Link from "next/link";
import type { AdminProductListFilters } from "@/modules/products/list-products";
import { listHref } from "@/modules/products/list-params";

const base =
  "inline-flex min-h-12 items-center justify-center rounded-control border border-border-strong bg-surface px-5 text-label font-semibold text-fg";

export function Pagination({
  page,
  totalPages,
  filters,
}: {
  page: number;
  totalPages: number;
  filters: AdminProductListFilters;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={listHref({ ...filters, page: page - 1 })} className={`${base} hover:border-action`} rel="prev">
          Anterior
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <p className="text-label text-fg-muted">
        Página {page} de {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={listHref({ ...filters, page: page + 1 })} className={`${base} hover:border-action`} rel="next">
          Próxima
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
