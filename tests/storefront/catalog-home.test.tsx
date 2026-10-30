import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogHome } from "@/components/storefront/catalog-home";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { defaultTheme } from "@/modules/catalogs/theme/tokens";
import type { CatalogHomeView } from "@/modules/catalogs/types";

const minimal: CatalogHomeView = {
  store: { slug: "vazia", name: "Loja Vazia", description: "x" },
  theme: defaultTheme,
  categories: [],
  productsOrder: "default",
  products: [],
};

describe("CatalogHome", () => {
  it("renderiza a vitrine completa do catálogo fictício", async () => {
    const home = (await getCatalogHome("demo-infantil"))!;
    const html = renderToStaticMarkup(<CatalogHome home={home} />);
    expect(html).toContain("--theme-action:#5E7462");
    expect(html).toContain('id="conteudo"');
    expect(html).toContain("Pular para o conteúdo");
    expect(html).toContain("Pequenos estilos. Grandes descobertas.");
    expect(html).toContain("Novidades");
    expect(html).toContain("Vestido Floral");
    expect(html).toContain("<footer");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
  it("catálogo mínimo: sem hero, categorias, produtos e contatos", () => {
    const html = renderToStaticMarkup(<CatalogHome home={minimal} />);
    expect(html).toMatch(/<h1[^>]*sr-only[^>]*>Loja Vazia<\/h1>/);
    expect(html).toContain("Novidades chegando em breve.");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain('aria-label="Categorias"');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
  it("todos indisponíveis: a grade continua e mostra os selos", () => {
    const html = renderToStaticMarkup(
      <CatalogHome
        home={{
          ...minimal,
          products: [{ slug: "a", name: "Peça A", basePriceCents: 100, imageAlt: "Peça A", isAvailable: false }],
        }}
      />,
    );
    expect(html).toContain("Peça A");
    expect(html).toContain("Indisponível");
    expect(html).not.toContain("Novidades chegando");
  });
  it("não introduz funcionalidades de e-commerce", async () => {
    const home = (await getCatalogHome("demo-infantil"))!;
    expect(renderToStaticMarkup(<CatalogHome home={home} />).toLowerCase()).not.toMatch(
      /carrinho|favorit|comprar|checkout|frete/,
    );
  });
});
