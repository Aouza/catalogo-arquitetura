import { contrastRatio } from "./contrast";
import { COLOR_TOKENS, type CatalogTheme, type ColorToken } from "./tokens";

export type ThemeIssue = { tokens: ColorToken[]; message: string };

type Side = ColorToken | "white";
const WHITE = "#FFFFFF";
const HEX = /^#[0-9a-fA-F]{6}$/;

// Limites do guia (seção 02): texto ≥ 4,5:1; contorno de controle ≥ 3:1.
const PAIRS: { fg: Side; bg: Side; min: number }[] = [
  { fg: "fg", bg: "bg", min: 4.5 },
  { fg: "fg-muted", bg: "bg", min: 4.5 },
  { fg: "fg-muted", bg: "surface", min: 4.5 },
  { fg: "fg", bg: "surface-subtle", min: 4.5 },
  { fg: "white", bg: "action", min: 4.5 },
  { fg: "white", bg: "action-hover", min: 4.5 },
  { fg: "white", bg: "accent-strong", min: 4.5 },
  { fg: "border-strong", bg: "bg", min: 3 },
];

export function validateTheme(theme: CatalogTheme): ThemeIssue[] {
  const issues: ThemeIssue[] = [];
  const valid = new Set<ColorToken>();

  for (const token of COLOR_TOKENS) {
    if (HEX.test(theme.colors[token])) valid.add(token);
    else issues.push({ tokens: [token], message: `${token}: "${theme.colors[token]}" não é um hexadecimal #RRGGBB` });
  }

  const value = (side: Side) => (side === "white" ? WHITE : theme.colors[side]);

  for (const { fg, bg, min } of PAIRS) {
    const tokens = [fg, bg].filter((s): s is ColorToken => s !== "white");
    if (!tokens.every((t) => valid.has(t))) continue;
    const ratio = contrastRatio(value(fg), value(bg));
    if (ratio < min) {
      issues.push({ tokens, message: `${fg} sobre ${bg}: contraste ${ratio.toFixed(2)}:1, mínimo ${min}:1` });
    }
  }
  return issues;
}
