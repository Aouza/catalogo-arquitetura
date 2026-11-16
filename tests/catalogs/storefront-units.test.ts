import { describe, expect, it } from "vitest";
import { parsePage } from "@/modules/catalogs/queries/parse-page";
import { photoUrl, toProductView } from "@/modules/catalogs/queries/storefront-data";
import { themeFromJson } from "@/modules/catalogs/theme/theme-from-json";
import { defaultTheme } from "@/modules/catalogs/theme/tokens";

const row = (overrides = {}) => ({
  slug: "vestido-floral",
  name: "Vestido Floral",
  price_cents: 7990,
  price_varies: false,
  is_available: true,
  cover_path: null,
  cover_alt: null,
  ...overrides,
});

describe("toProductView", () => {
  it("monta o card com preço de partida, selo de variação e disponibilidade", () => {
    expect(toProductView(row({ price_cents: 6990, price_varies: true }))).toEqual({
      slug: "vestido-floral",
      name: "Vestido Floral",
      basePriceCents: 6990,
      priceVaries: true,
      imageUrl: undefined,
      imageAlt: "Vestido Floral",
      isAvailable: true,
    });
  });

  it("converte preço em texto (bigint do banco) para número e mantém zero", () => {
    expect(toProductView(row({ price_cents: "12990" })).basePriceCents).toBe(12990);
    expect(toProductView(row({ price_cents: 0 })).basePriceCents).toBe(0);
  });

  it("a foto de capa vira o endereço público estável e usa a descrição como texto alternativo", () => {
    const view = toProductView(row({ cover_path: "abc/def.png", cover_alt: "  Frente do vestido " }));
    expect(view.imageUrl).toBe("/fotos/abc/def.png");
    expect(view.imageAlt).toBe("Frente do vestido");
  });

  it("sem descrição na foto, o nome do produto é o texto alternativo", () => {
    expect(toProductView(row({ cover_path: "a/b.png", cover_alt: "   " })).imageAlt).toBe("Vestido Floral");
  });

  it("produto esgotado continua na lista, marcado como indisponível", () => {
    expect(toProductView(row({ is_available: false })).isAvailable).toBe(false);
  });

  it("não expõe campos internos", () => {
    expect(Object.keys(toProductView(row())).sort()).toEqual(
      ["basePriceCents", "imageAlt", "imageUrl", "isAvailable", "name", "priceVaries", "slug"].sort(),
    );
  });
});

describe("photoUrl", () => {
  it("usa a rota pública de fotos", () => {
    expect(photoUrl("p1/f1.webp")).toBe("/fotos/p1/f1.webp");
  });
});

describe("themeFromJson", () => {
  it("sem tema salvo (ou tipo inesperado) usa o tema padrão", () => {
    for (const value of [null, undefined, {}, [], "x", 5]) expect(themeFromJson(value)).toEqual(defaultTheme);
  });

  it("aplica cores e fontes válidas sobre o padrão", () => {
    const theme = themeFromJson({ colors: { action: "#2E5339" }, headingFont: "inter" });
    expect(theme.colors.action).toBe("#2E5339");
    expect(theme.colors.bg).toBe(defaultTheme.colors.bg);
    expect(theme.headingFont).toBe("inter");
    expect(theme.bodyFont).toBe(defaultTheme.bodyFont);
  });

  it("ignora fonte desconhecida e valores que não são texto", () => {
    const theme = themeFromJson({ headingFont: "comic-sans", colors: { action: 42 } });
    expect(theme.headingFont).toBe(defaultTheme.headingFont);
    expect(theme.colors.action).toBe(defaultTheme.colors.action);
  });

  it("cor inválida ou sem contraste suficiente volta ao tema padrão inteiro", () => {
    expect(themeFromJson({ colors: { action: "verde" } })).toEqual(defaultTheme);
    // Texto claro sobre fundo claro: ilegível.
    expect(themeFromJson({ colors: { fg: "#F5F5F5" } })).toEqual(defaultTheme);
  });
});

describe("parsePage", () => {
  it.each([
    [undefined, 1],
    ["3", 3],
    [["2", "5"], 2],
    ["0", 1],
    ["-4", 1],
    ["abc", 1],
    ["1e9", 1],
    ["99999", 1],
    ["", 1],
  ])("%j → %j", (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });
});
