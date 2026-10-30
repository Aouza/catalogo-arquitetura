import { describe, expect, it } from "vitest";
import { defaultTheme } from "@/modules/catalogs/theme/tokens";
import { validateTheme } from "@/modules/catalogs/theme/validate-theme";

const withColor = (token: keyof typeof defaultTheme.colors, value: string) => ({
  ...defaultTheme,
  colors: { ...defaultTheme.colors, [token]: value },
});

describe("validateTheme", () => {
  it("a paleta padrão do guia passa", () => {
    expect(validateTheme(defaultTheme)).toEqual([]);
  });
  it("aponta o token quando o contraste é insuficiente", () => {
    const issues = validateTheme(withColor("fg-muted", "#AAAAAA"));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.tokens.includes("fg-muted"))).toBe(true);
  });
  it("reprova action claro demais para texto branco", () => {
    const issues = validateTheme(withColor("action", "#A8C3AC"));
    expect(issues.some((i) => i.tokens.includes("action"))).toBe(true);
  });
  it("reprova hexadecimal inválido sem lançar", () => {
    const issues = validateTheme(withColor("bg", "red"));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("bg");
  });
});
