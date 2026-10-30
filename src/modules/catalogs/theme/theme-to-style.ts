import type { CSSProperties } from "react";
import { COLOR_TOKENS, type CatalogTheme, type FontKey } from "./tokens";

const FONT_VARS: Record<FontKey, string> = {
  "dm-sans": "var(--font-dm-sans)",
  inter: "var(--font-inter)",
};

export function themeToStyle(theme: CatalogTheme): CSSProperties {
  const style: Record<string, string> = {};
  for (const token of COLOR_TOKENS) style[`--theme-${token}`] = theme.colors[token];
  style["--theme-font-heading"] = FONT_VARS[theme.headingFont];
  style["--theme-font-body"] = FONT_VARS[theme.bodyFont];
  return style as CSSProperties;
}
