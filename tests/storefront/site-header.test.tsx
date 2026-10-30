import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/storefront/site-header";

const store = { slug: "loja", name: "Loja Exemplo", description: "Desc" };
const categories = [{ slug: "bebes", name: "Bebês" }];

describe("SiteHeader", () => {
  it("mostra o nome da loja em texto quando não há logo", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain("Loja Exemplo");
    expect(html).toContain('href="/loja"');
  });
  it("tem busca GET para a rota de busca, com label", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain('action="/loja/busca"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Buscar produtos..."');
    expect(html).toMatch(/<label[^>]*>Buscar produtos<\/label>/);
  });
  it("só mostra o atalho de WhatsApp com número válido", () => {
    const withWa = renderToStaticMarkup(
      <SiteHeader store={{ ...store, whatsappE164: "+5511999990000" }} categories={categories} />,
    );
    expect(withWa).toContain("https://wa.me/5511999990000");
    expect(withWa).toContain('aria-label="Conversar pelo WhatsApp"');
    for (const bad of [undefined, "abc"]) {
      const html = renderToStaticMarkup(<SiteHeader store={{ ...store, whatsappE164: bad }} categories={categories} />);
      expect(html).not.toContain("wa.me");
    }
  });
  it("tem botão de menu nomeado e links de categoria", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain('aria-label="Abrir menu de categorias"');
    expect(html).toContain('href="/loja/categoria/bebes"');
  });
  it("alvos de toque do logo e dos links de categoria têm pelo menos 44px", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toMatch(new RegExp('<a(?=[^>]*href="/loja")(?=[^>]*min-h-11)[^>]*>'));
    expect(html).toMatch(new RegExp('<a(?=[^>]*href="/loja/categoria/bebes")(?=[^>]*min-h-11)[^>]*>Bebês</a></li></ul></nav>'));
  });
});
