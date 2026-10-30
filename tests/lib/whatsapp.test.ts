import { describe, expect, it } from "vitest";
import { instagramUrl, whatsappLink } from "@/lib/whatsapp";

describe("whatsappLink", () => {
  it("aceita E.164 com ou sem +", () => {
    expect(whatsappLink("+5511999998888")).toBe("https://wa.me/5511999998888");
    expect(whatsappLink("5511999998888")).toBe("https://wa.me/5511999998888");
  });
  it.each([undefined, null, "", "abc", "12345", "+0511999998888", "+55 11 99999-8888"])(
    "retorna null para %s",
    (v) => {
      expect(whatsappLink(v)).toBeNull();
    },
  );
});

describe("instagramUrl", () => {
  it("remove @ inicial e espaços", () => {
    expect(instagramUrl("@loja.exemplo")).toBe("https://instagram.com/loja.exemplo");
    expect(instagramUrl(" loja.exemplo ")).toBe("https://instagram.com/loja.exemplo");
  });
});
