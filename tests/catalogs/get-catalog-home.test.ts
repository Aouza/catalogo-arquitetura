import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { validateTheme } from "@/modules/catalogs/theme/validate-theme";

afterEach(() => vi.unstubAllEnvs());

describe("getCatalogHome", () => {
  it("retorna a vitrine do catálogo fictício", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(home?.store.slug).toBe("demo-infantil");
    expect(home?.categories.length).toBeGreaterThan(0);
    expect(home?.productsOrder).toBe("published_at");
  });

  it("exclui rascunhos e arquivados", async () => {
    const home = await getCatalogHome("demo-infantil");
    const names = home!.products.map((p) => p.name);
    expect(names).not.toContain("Rascunho interno");
    expect(names).not.toContain("Peça arquivada");
  });

  it("deriva isAvailable das variações", async () => {
    const home = await getCatalogHome("demo-infantil");
    const byName = Object.fromEntries(home!.products.map((p) => [p.name, p]));
    expect(byName["Tênis Branco"].isAvailable).toBe(false);
    expect(byName["Vestido Floral"].isAvailable).toBe(true);
  });

  it("mantém preço zero como válido", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(home!.products.some((p) => p.basePriceCents === 0)).toBe(true);
  });

  it("não expõe campos internos", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(Object.keys(home!.products[0]).sort()).toEqual(
      ["basePriceCents", "imageAlt", "imageUrl", "isAvailable", "name", "slug"].sort(),
    );
  });

  it("o tema da fixture passa na validação de contraste", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(validateTheme(home!.theme)).toEqual([]);
  });

  it("normaliza maiúsculas", async () => {
    expect(await getCatalogHome("Demo-Infantil")).not.toBeNull();
  });

  it.each(["nao-existe", "admin", "api", "_next", "ADMIN", "", "../x", "a".repeat(5000), "demo infantil"])(
    "retorna null para slug %#",
    async (slug) => {
      expect(await getCatalogHome(slug)).toBeNull();
    },
  );

  it("não responde em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await getCatalogHome("demo-infantil")).toBeNull();
  });
});
