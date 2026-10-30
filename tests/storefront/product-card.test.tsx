import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCard } from "@/components/storefront/product-card";
import type { ProductView } from "@/modules/catalogs/types";

const base: ProductView = {
  slug: "vestido-floral",
  name: "Vestido Floral",
  basePriceCents: 14990,
  imageAlt: "Vestido floral bege, vista frontal",
  isAvailable: true,
};
const render = (p: Partial<ProductView> = {}) =>
  renderToStaticMarkup(<ul><ProductCard storeSlug="loja" product={{ ...base, ...p }} /></ul>);

describe("ProductCard", () => {
  it("é um link para o produto com nome e preço", () => {
    const html = render();
    expect(html).toContain('href="/loja/produto/vestido-floral"');
    expect(html).toContain("Vestido Floral");
    expect(html).toContain("R$ 149,90");
  });
  it("mostra preço zero", () => {
    expect(render({ basePriceCents: 0 })).toContain("R$ 0,00");
  });
  it("mostra o selo textual quando indisponível", () => {
    expect(render({ isAvailable: false })).toContain("Indisponível");
    expect(render()).not.toContain("Indisponível");
  });
  it("usa a imagem com alt quando existe", () => {
    const html = render({ imageUrl: "/img/vestido.jpg" });
    expect(html).toContain("<img");
    expect(html).toContain('alt="Vestido floral bege, vista frontal"');
  });
  it("não renderiza <img> sem imagem", () => {
    expect(render()).not.toContain("<img");
  });
  it("não tem favoritos nem carrinho", () => {
    expect(render().toLowerCase()).not.toMatch(/favorit|carrinho|comprar/);
  });
});
