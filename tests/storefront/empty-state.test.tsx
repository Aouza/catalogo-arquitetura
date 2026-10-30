import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/storefront/empty-state";

describe("EmptyState", () => {
  it("com WhatsApp válido oferece o contato", () => {
    const html = renderToStaticMarkup(<EmptyState whatsappE164="+5511999990000" />);
    expect(html).toContain("Novidades chegando em breve. Fale com a gente pelo WhatsApp.");
    expect(html).toContain('href="https://wa.me/5511999990000"');
  });
  it.each([undefined, "abc"])("sem WhatsApp válido (%s) não cita nem linka o WhatsApp", (v) => {
    const html = renderToStaticMarkup(<EmptyState whatsappE164={v} />);
    expect(html).toContain("Novidades chegando em breve.");
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("wa.me");
  });
});
