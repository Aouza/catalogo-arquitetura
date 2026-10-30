import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, defaultTheme } from "@/modules/catalogs/theme/tokens";

const css = readFileSync("src/app/globals.css", "utf8");

describe("globals.css", () => {
  it.each(COLOR_TOKENS)("`:root` define --theme-%s igual ao defaultTheme", (token) => {
    const match = css.match(new RegExp(`--theme-${token}: *(#[0-9a-fA-F]{6})`));
    expect(match?.[1].toUpperCase()).toBe(defaultTheme.colors[token].toUpperCase());
  });
  it.each(COLOR_TOKENS)("expõe --color-%s ao Tailwind", (token) => {
    expect(css).toContain(`--color-${token}: var(--theme-${token})`);
  });
});
