import { describe, expect, it } from "vitest";
import { defaultTheme } from "@/modules/catalogs/theme/tokens";
import { themeToStyle } from "@/modules/catalogs/theme/theme-to-style";

describe("themeToStyle", () => {
  it("gera uma variável por token e as fontes", () => {
    const style = themeToStyle(defaultTheme) as Record<string, string>;
    expect(style["--theme-action"]).toBe("#5E7462");
    expect(style["--theme-surface-subtle"]).toBe("#EEF1EC");
    expect(style["--theme-font-heading"]).toBe("var(--font-dm-sans)");
    expect(style["--theme-font-body"]).toBe("var(--font-inter)");
    expect(Object.keys(style)).toHaveLength(14);
  });
});
