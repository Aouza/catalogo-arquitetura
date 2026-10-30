export const COLOR_TOKENS = [
  "bg",
  "surface",
  "surface-subtle",
  "fg",
  "fg-muted",
  "action",
  "action-hover",
  "brand",
  "accent",
  "accent-strong",
  "border",
  "border-strong",
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
export type FontKey = "dm-sans" | "inter";

export type CatalogTheme = {
  colors: Record<ColorToken, string>;
  headingFont: FontKey;
  bodyFont: FontKey;
};

// Valores do guia de design v1.2 (seção 02). Devem espelhar `:root` em globals.css (há teste).
export const defaultTheme: CatalogTheme = {
  colors: {
    bg: "#FAF8F4",
    surface: "#FFFFFF",
    "surface-subtle": "#EEF1EC",
    fg: "#292D2A",
    "fg-muted": "#6B6F6B",
    action: "#5E7462",
    "action-hover": "#4F6353",
    brand: "#718775",
    accent: "#C98470",
    "accent-strong": "#9E5643",
    border: "#E8E4DC",
    "border-strong": "#8C8880",
  },
  headingFont: "dm-sans",
  bodyFont: "inter",
};
