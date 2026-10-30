import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductGrid } from "@/components/storefront/product-grid";
import type { ProductView } from "@/modules/catalogs/types";

const products: ProductView[] = [1, 2, 3].map((n) => ({
  slug: `p-${n}`,
  name: `Produto ${n}`,
  basePriceCents: 1000 * n,
  imageAlt: `Produto ${n}`,
  isAvailable: n !== 2,
}));

describe("ProductGrid", () => {
  it("usa 'Novidades' quando ordenado por publicação", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="published_at" />);
    expect(html).toContain("Novidades");
    expect(html).not.toContain(">Produtos<");
  });
  it("usa 'Produtos' na ordem padrão", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="default" />);
    expect(html).toContain(">Produtos<");
    expect(html).not.toContain("Novidades");
  });
  it("tem 'Ver todos' para a listagem e um item por produto", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="default" />);
    expect(html).toContain('href="/loja/produtos"');
    expect(html.match(/<li/g)).toHaveLength(3);
  });
  it("usa as 3 larguras de grade do guia", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="default" />);
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("min-[600px]:grid-cols-3");
    expect(html).toContain("lg:grid-cols-4");
  });
});
