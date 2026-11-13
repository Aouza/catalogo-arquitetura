import Link from "next/link";
import { routes } from "@/lib/routes";
import type { CategoryOption } from "@/modules/categories/list-categories";
import type { AdminProductListFilters } from "@/modules/products/list-products";
import { STATUS_LABELS } from "@/modules/products/list-params";

const field =
  "min-h-12 w-full rounded-control border border-border-strong bg-surface px-4 text-body text-fg";

/** Filtros por formulário GET (funciona sem JavaScript e deixa a URL compartilhável). */
export function ProductFilters({
  filters,
  categories,
}: {
  filters: AdminProductListFilters;
  categories: CategoryOption[];
}) {
  const hasFilters = Boolean(filters.query || filters.status || filters.categoryId);

  return (
    <form method="get" action={routes.adminProducts()} role="search" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-q" className="text-label font-semibold text-fg">
          Buscar pelo nome
        </label>
        <input
          id="filter-q"
          name="q"
          type="search"
          defaultValue={filters.query ?? ""}
          maxLength={80}
          placeholder="Ex.: vestido"
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-label font-semibold text-fg">
          Situação
        </label>
        <select id="filter-status" name="situacao" defaultValue={filters.status ?? ""} className={field}>
          <option value="">Todas</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-category" className="text-label font-semibold text-fg">
          Categoria
        </label>
        <select id="filter-category" name="categoria" defaultValue={filters.categoryId ?? ""} className={field}>
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control bg-action px-5 text-label font-semibold text-white transition-colors hover:bg-action-hover"
        >
          Filtrar
        </button>
        {hasFilters ? (
          <Link
            href={routes.adminProducts()}
            className="inline-flex min-h-12 items-center justify-center rounded-control px-3 text-label font-semibold text-fg-muted hover:text-fg"
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
