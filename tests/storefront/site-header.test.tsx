import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/storefront/site-header";

const store = { name: "Loja Exemplo", description: "Desc" };
const categories = [{ slug: "bebes", name: "Bebês" }];

describe("SiteHeader", () => {
  it("mostra o nome da loja em texto quando não há logo", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain("Loja Exemplo");
    expect(html).toContain('href="/"');
  });
  it("tem busca GET para a rota de busca, com label", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain('action="/busca"');
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
    expect(html).toContain('href="/categoria/bebes"');
  });
  it("usa logo completo no desktop e compacto no celular quando há os dois", () => {
    const html = renderToStaticMarkup(
      <SiteHeader store={{ ...store, logoUrl: "/c.png", logoFullUrl: "/f.png" }} categories={categories} />,
    );
    expect(html).toMatch(/<img[^>]*lg:hidden[^>]*/);
    expect(html).toMatch(/<img[^>]*hidden h-12[^>]*lg:block/);
    expect(html.match(/<img/g)).toHaveLength(2);
  });
  it("com só o logo compacto renderiza uma imagem", () => {
    const html = renderToStaticMarkup(<SiteHeader store={{ ...store, logoUrl: "/c.png" }} categories={categories} />);
    expect(html.match(/<img/g)).toHaveLength(1);
  });
  it("cabeçalho sem borda inferior e busca em pílula sem borda", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toMatch(/<header[^>]*bg-bg/);
    expect(html).not.toMatch(/<header[^>]*border-b/);
    expect(html).toContain("rounded-full");
  });
  it("não tem favoritos nem carrinho (fora do MVP)", () => {
    const html = renderToStaticMarkup(
      <SiteHeader store={{ ...store, whatsappE164: "+5511999990000" }} categories={categories} />,
    );
    expect(html.toLowerCase()).not.toMatch(/favorit|carrinho/);
  });
  it("alvos de toque do logo e dos links de categoria têm pelo menos 44px", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toMatch(new RegExp('<a(?=[^>]*href="/")(?=[^>]*min-h-11)[^>]*>'));
    expect(html).toMatch(new RegExp('<a(?=[^>]*href="/categoria/bebes")(?=[^>]*min-h-11)[^>]*>Bebês</a></li></ul></nav>'));
  });
});
