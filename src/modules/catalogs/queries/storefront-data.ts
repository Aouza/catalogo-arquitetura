import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_IMAGES } from "../default-hero";
import { themeFromJson } from "../theme/theme-from-json";
import type { CategoryView, ProductView, StoreInfo } from "../types";
import type { CatalogTheme } from "../theme/tokens";

// Leituras públicas da vitrine. Recebem o cliente para poderem ser testadas contra o banco; em
// produção usam o cliente anônimo (createPublicClient), então só o publicado aparece.

export const STOREFRONT_PAGE_SIZE = 24;
export const HOME_PRODUCT_COUNT = 12;

export type StoreData = { store: StoreInfo; theme: CatalogTheme };

type StoreRow = {
  name: string;
  description: string | null;
  whatsapp_e164: string | null;
  instagram: string | null;
  address: string | null;
  hours: string | null;
  logo_path: string | null;
  logo_full_path: string | null;
  theme: unknown;
};

/** Dados e tema da loja (linha única), ou `null` se a loja ainda não foi configurada. */
export async function fetchStore(client: SupabaseClient): Promise<StoreData | null> {
  const { data, error } = await client
    .from("store_settings")
    .select("name, description, whatsapp_e164, instagram, address, hours, logo_path, logo_full_path, theme")
    .maybeSingle();
  if (error || !data) return null;

  const row = data as StoreRow;
  return {
    store: {
      name: row.name,
      description: row.description ?? "",
      logoUrl: row.logo_path ?? undefined,
      logoFullUrl: row.logo_full_path ?? undefined,
      whatsappE164: row.whatsapp_e164 ?? undefined,
      instagram: row.instagram ?? undefined,
      address: row.address ?? undefined,
      hours: row.hours ?? undefined,
    },
    theme: themeFromJson(row.theme),
  };
}

export type PublicCategory = CategoryView & { id: string };

/** Categorias na ordem de exibição. */
export async function fetchCategories(client: SupabaseClient): Promise<PublicCategory[]> {
  const { data, error } = await client
    .from("categories")
    .select("id, slug, name")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    imageUrl: CATEGORY_IMAGES[row.slug as string],
  }));
}

type StorefrontRow = {
  slug: string;
  name: string;
  price_cents: number | string;
  price_varies: boolean;
  is_available: boolean;
  cover_path: string | null;
  cover_alt: string | null;
};

/** Endereço público e estável de uma foto (servido por /fotos, só se o produto está publicado). */
export const photoUrl = (storagePath: string) => `/fotos/${storagePath}`;

export function toProductView(row: StorefrontRow): ProductView {
  return {
    slug: row.slug,
    name: row.name,
    basePriceCents: Number(row.price_cents),
    priceVaries: row.price_varies,
    imageUrl: row.cover_path ? photoUrl(row.cover_path) : undefined,
    imageAlt: row.cover_alt?.trim() || row.name,
    isAvailable: row.is_available,
  };
}

export type ProductPage = { items: ProductView[]; total: number; page: number; totalPages: number };

/**
 * Produtos publicados, do mais recente para o mais antigo (o esgotado continua na lista, com o
 * selo de indisponível). A página pedida é ajustada ao intervalo existente.
 */
export async function fetchProducts(
  client: SupabaseClient,
  options: { categoryId?: string; page?: number; pageSize?: number } = {},
): Promise<ProductPage> {
  const pageSize = options.pageSize ?? STOREFRONT_PAGE_SIZE;
  const build = (head: boolean) => {
    const query = client
      .from("storefront_products")
      .select(
        head ? "slug" : "slug, name, price_cents, price_varies, is_available, cover_path, cover_alt",
        head ? { count: "exact", head: true } : { count: "exact" },
      );
    return options.categoryId ? query.eq("category_id", options.categoryId) : query;
  };

  const counted = await build(true);
  const total = counted.error ? 0 : (counted.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options.page ?? 1)), totalPages);
  if (total === 0) return { items: [], total: 0, page, totalPages };

  const from = (page - 1) * pageSize;
  const { data, error } = await build(false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error || !data) return { items: [], total, page, totalPages };

  return { items: (data as unknown as StorefrontRow[]).map(toProductView), total, page, totalPages };
}
