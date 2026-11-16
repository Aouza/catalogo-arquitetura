import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { buildSitemapEntries, type SitemapData } from "@/modules/catalogs/queries/sitemap-data";
import { defaultShareImage, shareMetadata, summarize } from "@/modules/catalogs/seo";

describe("summarize", () => {
  it("texto curto fica como está, com espaços normalizados", () => {
    expect(summarize("  Algodão   macio.\nLavar à mão. ")).toBe("Algodão macio. Lavar à mão.");
    expect(summarize("")).toBe("");
  });

  it("texto longo é cortado em palavra inteira, com reticências, dentro do limite", () => {
    const text = "palavra ".repeat(60);
    const result = summarize(text, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, -1).endsWith("palavra")).toBe(true);
  });

  it("palavra gigante sem espaços é cortada no limite", () => {
    const result = summarize("a".repeat(500), 40);
    expect(result).toHaveLength(40);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("shareMetadata (prévia do link e endereço oficial)", () => {
  const input = {
    title: "Vestido Floral · Loja",
    description: "Algodão macio.",
    path: "/produto/vestido-floral",
    siteName: "Loja",
    image: { url: "/fotos/p1/f1.png", alt: "Vestido de frente" },
  };

  it("define título exato, descrição e endereço oficial", () => {
    const meta = shareMetadata(input);
    expect(meta.title).toEqual({ absolute: "Vestido Floral · Loja" });
    expect(meta.description).toBe("Algodão macio.");
    expect(meta.alternates?.canonical).toBe("/produto/vestido-floral");
  });

  it("prévia no WhatsApp/Instagram (Open Graph) com a foto e o nome da loja", () => {
    const og = shareMetadata(input).openGraph!;
    expect(og).toMatchObject({
      title: "Vestido Floral · Loja",
      url: "/produto/vestido-floral",
      siteName: "Loja",
      type: "website",
      locale: "pt_BR",
      images: [{ url: "/fotos/p1/f1.png", alt: "Vestido de frente" }],
    });
  });

  it("cartão grande quando há foto; cartão simples quando não há", () => {
    expect(shareMetadata(input).twitter).toMatchObject({ card: "summary_large_image", images: ["/fotos/p1/f1.png"] });
    expect(shareMetadata({ ...input, image: undefined }).twitter).toMatchObject({ card: "summary" });
    expect(shareMetadata({ ...input, image: undefined }).openGraph?.images).toBeUndefined();
  });

  it("a foto padrão é a imagem de destaque da loja", () => {
    expect(defaultShareImage().url).toBe("/images/hero/hero-family.webp");
    expect(defaultShareImage().alt).toBeTruthy();
  });
});

describe("robots", () => {
  it("libera a loja, bloqueia admin e login e aponta o mapa do site", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule).toMatchObject({ userAgent: "*", allow: "/", disallow: ["/admin", "/login"] });
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("buildSitemapEntries", () => {
  const data: SitemapData = {
    products: [
      { slug: "vestido-floral", updatedAt: "2026-03-01T10:00:00.000Z" },
      { slug: "jaqueta", updatedAt: "2026-05-20T09:30:00.000Z" },
    ],
    categories: [{ slug: "meninas" }],
  };
  const entries = buildSitemapEntries(data, "https://loja.example");

  it("inclui início, lista, categorias e cada produto, com endereço completo", () => {
    expect(entries.map((e) => e.url)).toEqual([
      "https://loja.example/",
      "https://loja.example/produtos",
      "https://loja.example/categoria/meninas",
      "https://loja.example/produto/vestido-floral",
      "https://loja.example/produto/jaqueta",
    ]);
  });

  it("informa a data de alteração de cada produto e a mais recente no início", () => {
    expect(entries[3].lastModified).toEqual(new Date("2026-03-01T10:00:00.000Z"));
    expect(entries[0].lastModified).toEqual(new Date("2026-05-20T09:30:00.000Z"));
  });

  it("sem produtos, ainda lista o início e a lista, sem data inventada", () => {
    const empty = buildSitemapEntries({ products: [], categories: [] }, "https://loja.example");
    expect(empty.map((e) => e.url)).toEqual(["https://loja.example/", "https://loja.example/produtos"]);
    expect(empty[0].lastModified).toBeUndefined();
  });

  it("codifica o endereço do produto", () => {
    const odd = buildSitemapEntries({ products: [{ slug: "a b", updatedAt: "2026-01-01T00:00:00Z" }], categories: [] }, "https://x.example");
    expect(odd.at(-1)?.url).toBe("https://x.example/produto/a%20b");
  });
});
