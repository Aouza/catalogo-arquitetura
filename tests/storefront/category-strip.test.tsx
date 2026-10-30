import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryStrip } from "@/components/storefront/category-strip";

describe("CategoryStrip", () => {
  it("lista categorias com link e inicial como fallback", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip storeSlug="loja" categories={[{ slug: "bebes", name: "Bebês" }]} />,
    );
    expect(html).toContain('href="/loja/categoria/bebes"');
    expect(html).toContain("Bebês");
    expect(html).toContain(">B<");
    expect(html).toContain('aria-label="Categorias"');
  });
  it("esconde a inicial dos leitores de tela", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip storeSlug="loja" categories={[{ slug: "bebes", name: "Bebês" }]} />,
    );
    expect(html).toMatch(new RegExp('<span[^>]*aria-hidden="true"[^>]*>B</span>'));
  });
  it("não divide emoji ou par substituto na inicial", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip storeSlug="loja" categories={[{ slug: "x", name: "🙂Bebê" }]} />,
    );
    expect(html).toContain(">🙂<");
  });
  it("não renderiza nada sem categorias", () => {
    expect(renderToStaticMarkup(<CategoryStrip storeSlug="loja" categories={[]} />)).toBe("");
  });
});
