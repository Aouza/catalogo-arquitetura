import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/storefront/hero";

describe("Hero", () => {
  const hero = { title: "Pequenos estilos", text: "Moda infantil" };
  it("tem h1, texto e CTA secundário para a listagem", () => {
    const html = renderToStaticMarkup(<Hero storeSlug="loja" hero={hero} />);
    expect(html).toMatch(/<h1[^>]*>Pequenos estilos<\/h1>/);
    expect(html).toContain("Moda infantil");
    expect(html).toContain("Explorar produtos");
    expect(html).toContain('href="/loja/produtos"');
  });
  it("sem imagem não renderiza <img>", () => {
    expect(renderToStaticMarkup(<Hero storeSlug="loja" hero={hero} />)).not.toContain("<img");
  });
  it("com imagem usa o alt informado", () => {
    const html = renderToStaticMarkup(
      <Hero storeSlug="loja" hero={{ ...hero, imageUrl: "/h.jpg", imageAlt: "Vestido floral bege" }} />,
    );
    expect(html).toContain('alt="Vestido floral bege"');
  });
});
