import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STOREFRONT_LIFE, STOREFRONT_TAG } from "@/modules/catalogs/cache";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { getCatalogListing } from "@/modules/catalogs/queries/get-catalog-listing";
import { getProductPage } from "@/modules/catalogs/queries/get-product-page";
import { fetchProductDetail } from "@/modules/catalogs/queries/product-detail-data";
import { fetchSitemapData } from "@/modules/catalogs/queries/sitemap-data";
import { fetchCategories, fetchProducts, fetchStore } from "@/modules/catalogs/queries/storefront-data";

/** Cliente que responde a qualquer consulta com o resultado dado (erro ou vazio). */
function fakeClient(result: { data: unknown; error: unknown; count?: number | null }): SupabaseClient {
  const chain: unknown = new Proxy(() => undefined, {
    get(_target, property) {
      if (property === "then") return (resolve: (value: unknown) => void) => resolve({ count: null, ...result });
      return () => chain;
    },
    apply: () => chain,
  });
  return chain as SupabaseClient;
}

const failing = (message = "conexão perdida") => fakeClient({ data: null, error: { message, code: "XX000" } });

beforeEach(() => {
  vi.mocked(cacheTag).mockClear();
  vi.mocked(cacheLife).mockClear();
});

describe("política de cache da vitrine", () => {
  it("o prazo respeita os limites do Next para a página ser pré-renderizada", () => {
    expect(STOREFRONT_LIFE.expire).toBeGreaterThanOrEqual(300); // abaixo disso vira buraco dinâmico
    expect(STOREFRONT_LIFE.stale).toBeGreaterThanOrEqual(30);
    expect(STOREFRONT_LIFE.revalidate).toBeGreaterThan(0);
    expect(STOREFRONT_LIFE.revalidate).toBeLessThanOrEqual(STOREFRONT_LIFE.expire);
  });

  it("nada fica desatualizado por mais de 10 minutos, mesmo se uma invalidação falhar", () => {
    expect(STOREFRONT_LIFE.expire).toBeLessThanOrEqual(600);
  });

  it.each([
    ["home", () => getCatalogHome()],
    ["lista", () => getCatalogListing({ page: 1 })],
    ["categoria", () => getCatalogListing({ categorySlug: "meninas", page: 1 })],
    ["produto", () => getProductPage("vestido-floral")],
  ])("a leitura da %s usa a etiqueta e o prazo da vitrine", async (_name, read) => {
    await read();
    expect(cacheTag).toHaveBeenCalledWith(STOREFRONT_TAG);
    expect(cacheLife).toHaveBeenCalledWith(STOREFRONT_LIFE);
  });

  it("o mapa do site usa a mesma etiqueta, então é renovado junto com a vitrine", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    await sitemap();
    expect(cacheTag).toHaveBeenCalledWith(STOREFRONT_TAG);
    expect(cacheLife).toHaveBeenCalledWith(STOREFRONT_LIFE);
  });
});

describe("erro do banco não vira vitrine vazia (que ficaria guardada em cache)", () => {
  it.each([
    ["loja", (client: SupabaseClient) => fetchStore(client)],
    ["categorias", (client: SupabaseClient) => fetchCategories(client)],
    ["produtos", (client: SupabaseClient) => fetchProducts(client)],
    ["produtos de uma categoria", (client: SupabaseClient) => fetchProducts(client, { categoryId: "x", page: 2 })],
    ["produto", (client: SupabaseClient) => fetchProductDetail(client, "vestido-floral")],
    ["mapa do site", (client: SupabaseClient) => fetchSitemapData(client)],
  ])("falha ao ler %s: lança o erro em vez de devolver vazio", async (_name, read) => {
    await expect(read(failing())).rejects.toThrow(/Falha ao ler|Falha ao contar/);
  });

  it("a mensagem do erro traz a causa, para os registros do servidor", async () => {
    await expect(fetchStore(failing("timeout no banco"))).rejects.toThrow("timeout no banco");
  });

  it("ausência de dados continua sendo ausência, não erro", async () => {
    const empty = fakeClient({ data: null, error: null });
    expect(await fetchStore(empty)).toBeNull();
    expect(await fetchProductDetail(empty, "vestido-floral")).toBeNull();

    const none = fakeClient({ data: [], error: null, count: 0 });
    expect(await fetchCategories(none)).toEqual([]);
    expect(await fetchProducts(none)).toEqual({ items: [], total: 0, page: 1, totalPages: 1 });
    expect(await fetchSitemapData(none)).toEqual({ products: [], categories: [] });
  });
});
