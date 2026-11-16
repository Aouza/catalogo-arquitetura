import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "@/lib/site";
import { whatsappMessageLink } from "@/lib/whatsapp";

afterEach(() => vi.unstubAllEnvs());

describe("whatsappMessageLink", () => {
  it("monta o link com a mensagem codificada", () => {
    const link = whatsappMessageLink("+5511999990000", "Olá! Preço: R$ 89,90\nhttps://x.example/p?a=1&b=2");
    expect(link?.startsWith("https://wa.me/5511999990000?text=")).toBe(true);
    const text = new URL(link!).searchParams.get("text");
    expect(text).toBe("Olá! Preço: R$ 89,90\nhttps://x.example/p?a=1&b=2");
  });

  it("não deixa caracteres especiais escaparem da mensagem", () => {
    const link = whatsappMessageLink("+5511999990000", "a&text=b#c")!;
    expect(new URL(link).searchParams.getAll("text")).toEqual(["a&text=b#c"]);
  });

  it("número inválido ou ausente não gera link", () => {
    for (const value of [undefined, null, "", "abc", "+0123"]) expect(whatsappMessageLink(value, "oi")).toBeNull();
  });
});

describe("siteUrl", () => {
  it("usa a variável do ambiente, sem a barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://loja.example.com///");
    expect(siteUrl()).toBe("https://loja.example.com");
  });

  it("sem variável, usa o endereço local", () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      expect(siteUrl()).toBe("http://localhost:3000");
    } finally {
      if (original !== undefined) process.env.NEXT_PUBLIC_SITE_URL = original;
    }
  });
});
