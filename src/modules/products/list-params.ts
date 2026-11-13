import { routes } from "@/lib/routes";
import type { AdminProductListFilters } from "./list-products";
import type { ProductStatus } from "./set-status";

export type RawParams = Record<string, string | string[] | undefined>;

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUSES = Object.keys(STATUS_LABELS) as ProductStatus[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUERY_LENGTH = 80;
const MAX_PAGE = 10_000;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Lê os filtros da URL (`q`, `situacao`, `categoria`, `pagina`), ignorando valores inválidos. */
export function parseListParams(raw: RawParams): AdminProductListFilters {
  const query = first(raw.q)?.trim().slice(0, MAX_QUERY_LENGTH) || undefined;

  const statusValue = first(raw.situacao);
  const status = STATUSES.find((candidate) => candidate === statusValue);

  const categoryValue = first(raw.categoria);
  const categoryId = categoryValue && UUID.test(categoryValue) ? categoryValue : undefined;

  const pageValue = Number.parseInt(first(raw.pagina) ?? "", 10);
  const page = Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= MAX_PAGE ? pageValue : 1;

  return { query, status, categoryId, page };
}

/** Monta a URL da lista preservando os filtros (a página 1 não aparece na URL). */
export function listHref(filters: AdminProductListFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status) params.set("situacao", filters.status);
  if (filters.categoryId) params.set("categoria", filters.categoryId);
  if (filters.page && filters.page > 1) params.set("pagina", String(filters.page));
  const search = params.toString();
  return search ? `${routes.adminProducts()}?${search}` : routes.adminProducts();
}
