import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/storefront/hero";

describe("Hero", () => {
  const hero = { title: "Pequenos estilos", text: "Moda infantil" };
  it("tem h1, texto e CTA para a listagem", () => {
    const html = renderToStaticMarkup(<Hero hero={hero} />);
    expect(html).toMatch(/<h1[^>]*>Pequenos estilos<\/h1>/);
    expect(html).toContain("Moda infantil");
    expect(html).toContain("Explorar agora");
    expect(html).toContain('href="/produtos"');
  });
  it("sem imagem não renderiza <img>", () => {
    expect(renderToStaticMarkup(<Hero hero={hero} />)).not.toContain("<img");
  });
  it("com imagem usa o alt informado", () => {
    const html = renderToStaticMarkup(
      <Hero hero={{ ...hero, imageUrl: "/h.jpg", imageAlt: "Vestido floral bege" }} />,
    );
    expect(html).toContain('alt="Vestido floral bege"');
  });
});
