import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryStrip } from "@/components/storefront/category-strip";

describe("CategoryStrip", () => {
  it("lista categorias com link e inicial como fallback", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip categories={[{ slug: "bebes", name: "Bebês" }]} />,
    );
    expect(html).toContain('href="/categoria/bebes"');
    expect(html).toContain("Bebês");
    expect(html).toContain(">B<");
    expect(html).toContain('aria-label="Categorias"');
  });
  it("esconde a inicial dos leitores de tela", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip categories={[{ slug: "bebes", name: "Bebês" }]} />,
    );
    expect(html).toMatch(new RegExp('<span[^>]*aria-hidden="true"[^>]*>B</span>'));
  });
  it("não divide emoji ou par substituto na inicial", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip categories={[{ slug: "x", name: "🙂Bebê" }]} />,
    );
    expect(html).toContain(">🙂<");
  });
  it("não renderiza nada sem categorias", () => {
    expect(renderToStaticMarkup(<CategoryStrip categories={[]} />)).toBe("");
  });
});

describe("CategoryStrip com imagem", () => {
  it("mostra a imagem da categoria, sem círculo e sem inicial", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip categories={[{ slug: "bebes", name: "Bebês", imageUrl: "/images/categories/baby.webp" }]} />,
    );
    expect(html).toContain("<img");
    expect(html).not.toContain("rounded-full");
    expect(html).not.toContain(">B<");
  });
});
