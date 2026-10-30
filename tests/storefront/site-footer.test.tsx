import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/storefront/site-footer";

const store = { slug: "loja", name: "Loja Exemplo", description: "Desc" };

describe("SiteFooter", () => {
  it("mostra só o nome quando nada mais está configurado", () => {
    const html = renderToStaticMarkup(<SiteFooter store={store} />);
    expect(html).toContain("Loja Exemplo");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("instagram");
  });
  it("mostra contatos configurados", () => {
    const html = renderToStaticMarkup(
      <SiteFooter
        store={{ ...store, whatsappE164: "+5511999990000", instagram: "@lojaexemplo", address: "Rua A, 1", hours: "9h às 18h" }}
      />,
    );
    expect(html).toContain("https://wa.me/5511999990000");
    expect(html).toContain("Rua A, 1");
    expect(html).toContain("9h às 18h");
  });
  it("não duplica @ no link do Instagram", () => {
    const html = renderToStaticMarkup(<SiteFooter store={{ ...store, instagram: "@lojaexemplo" }} />);
    expect(html).toContain('href="https://instagram.com/lojaexemplo"');
    expect(html).not.toContain("@@");
  });
  it("ignora WhatsApp inválido", () => {
    expect(renderToStaticMarkup(<SiteFooter store={{ ...store, whatsappE164: "abc" }} />)).not.toContain("wa.me");
  });
});
