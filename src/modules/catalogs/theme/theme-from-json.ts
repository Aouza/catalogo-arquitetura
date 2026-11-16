import { COLOR_TOKENS, defaultTheme, type CatalogTheme, type FontKey } from "./tokens";
import { validateTheme } from "./validate-theme";

const FONTS: FontKey[] = ["dm-sans", "inter"];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Tema salvo na loja (JSON) sobre o tema padrão. Qualquer valor inválido, ou um tema que não
 * passe nos limites de contraste do guia, volta ao tema padrão: a vitrine nunca fica ilegível.
 */
export function themeFromJson(json: unknown): CatalogTheme {
  if (!isRecord(json)) return defaultTheme;

  const colors = { ...defaultTheme.colors };
  const savedColors = isRecord(json.colors) ? json.colors : {};
  for (const token of COLOR_TOKENS) {
    const value = savedColors[token];
    if (typeof value === "string") colors[token] = value;
  }

  const theme: CatalogTheme = {
    colors,
    headingFont: FONTS.find((font) => font === json.headingFont) ?? defaultTheme.headingFont,
    bodyFont: FONTS.find((font) => font === json.bodyFont) ?? defaultTheme.bodyFont,
  };

  return validateTheme(theme).length === 0 ? theme : defaultTheme;
}
