import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, mapDbError, ok, type Result } from "./errors";
import type { ProductStatus } from "./set-status";

export const ADMIN_PAGE_SIZE = 20;

export type AdminProductListFilters = {
  /** Busca por parte do nome. */
  query?: string;
  status?: ProductStatus;
  categoryId?: string;
  page?: number;
};

export type AdminProductListItem = {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  basePriceCents: number;
  categoryId: string | null;
  updatedAt: string;
};

export type AdminProductList = {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Escapa `%`, `_` e `\` para a busca tratar o texto digitado de forma literal. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Lista produtos para o admin (rascunho, publicado e arquivado), do mais recente para o mais
 * antigo. A página pedida é ajustada ao intervalo existente.
 */
export async function listAdminProducts(
  client: SupabaseClient,
  filters: AdminProductListFilters = {},
): Promise<Result<AdminProductList>> {
  const query = filters.query?.trim();

  const build = (columns: string, head: boolean) => {
    let request = client
      .from("products")
      .select(columns, head ? { count: "exact", head: true } : { count: "exact" });
    if (query) request = request.ilike("name", `%${escapeLike(query)}%`);
    if (filters.status) request = request.eq("status", filters.status);
    if (filters.categoryId) request = request.eq("category_id", filters.categoryId);
    return request;
  };

  const counted = await build("id", true);
  if (counted.error) return fail(mapDbError(counted.error));

  const total = counted.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), totalPages);

  if (total === 0) {
    return ok({ items: [], total, page, pageSize: ADMIN_PAGE_SIZE, totalPages });
  }

  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, error } = await build("id, slug, name, status, base_price_cents, category_id, updated_at", false)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (error) return fail(mapDbError(error));

  const rows = (data ?? []) as unknown as {
    id: string;
    slug: string;
    name: string;
    status: ProductStatus;
    base_price_cents: number | string;
    category_id: string | null;
    updated_at: string;
  }[];

  return ok({
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      basePriceCents: Number(row.base_price_cents),
      categoryId: row.category_id,
      updatedAt: row.updated_at,
    })),
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages,
  });
}
