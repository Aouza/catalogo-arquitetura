# Home da vitrine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a home pública `/{catalogSlug}` com dados fictícios, tema por catálogo e componentes reutilizáveis, sem Supabase nem login.

**Architecture:** Server Components com componentes puros em `components/storefront` alimentados por `getCatalogHome(slug)` (fixture hoje, Supabase depois). Tokens semânticos viram variáveis CSS (`--theme-*`) expostas ao Tailwind v4 via `@theme inline` e sobrescritas por catálogo num wrapper `ThemeScope`. Toda URL sai de `lib/routes.ts`.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript strict, Tailwind v4, Vitest 5 (testes de renderização com `react-dom/server`).

**Spec:** `docs/superpowers/specs/2026-10-30-home-vitrine-design.md` (ler junto com este plano). Guia de UI: `docs/design/Guia_Design_Catalogo_v1_2.docx`.

## Global Constraints

- TypeScript strict; nomes de código em inglês; textos de UI em pt-BR.
- Moeda BRL em centavos (inteiros); `price 0` é preço válido (só `null` herda; `AGENTS.md`).
- Componentes e `src/app` **nunca** contêm cor hexadecimal nem `[#...]` em classe; só tokens (`bg-action`, `text-fg`...). Exceção: `text-white` (branco fixo do guia sobre `action`).
- Nada de e-commerce: sem carrinho, favoritos, conta, avaliações, entrega; sem carrossel; sem swatches no card; sem segundo banner terracota.
- Corpo ≥ 16 px no mobile; alvos de toque ≥ 44 px; `caption` (12 px) nunca para informação essencial.
- Grade: 2 colunas (320–599), 3 (600–1023), 4 (≥ 1024); margem lateral 16 px; conteúdo máximo 1200 px; imagens de produto 4:5.
- Apenas produtos `published` chegam à vitrine (BR-011). A fixture só responde quando `NODE_ENV !== "production"`.
- `params` só é lido dentro de `<Suspense>` (Cache Components). `generateStaticParams` não é usado.
- Não criar migrations nem código de Supabase. Não mexer na rota `/`.
- Cada commit termina com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Gates antes de cada commit de código: `npm run typecheck && npm run lint && npm test`.

## Review Focus

Entradas e condições que a spec implica mas nenhum requisito testa diretamente, da mais provável para a menos:

1. Slug com maiúsculas ou hostil (`Demo-Infantil`, `../x`, string vazia ou enorme) → resolve em minúsculas ou retorna `null`; nunca lança. (Task 4)
2. Produto com preço `0` → "R$ 0,00" no card, sem esconder nem tratar como ausente. (Tasks 1 e 5)
3. WhatsApp malformado (letras, curto) → atalho do header e CTA do estado vazio não aparecem. (Tasks 1, 5 e 6)
4. Catálogo mínimo (sem hero, categorias, produtos nem contatos) → home renderiza sem erro, com `h1` e estado vazio. (Task 6)
5. Instagram informado com `@` → link único `https://instagram.com/handle`, sem `@@`. (Task 5)

---

## File Structure

```
src/
  app/
    layout.tsx                      # modificar: fontes DM Sans + Inter, metadataBase
    globals.css                     # reescrever: tokens, base, foco, reduced motion
    [catalogSlug]/page.tsx          # criar: Suspense + generateMetadata
    [catalogSlug]/error.tsx         # criar
    [catalogSlug]/not-found.tsx     # criar
  components/
    ui/icons.tsx  container.tsx  button-link.tsx  skeleton.tsx
    storefront/
      theme-scope.tsx  image-placeholder.tsx  price-display.tsx
      product-card.tsx  product-grid.tsx  category-strip.tsx  hero.tsx
      empty-state.tsx  site-footer.tsx  search-field.tsx
      category-drawer.tsx  site-header.tsx  home-skeleton.tsx  catalog-home.tsx
  lib/format.ts  routes.ts  whatsapp.ts
  modules/catalogs/
    types.ts  reserved-slugs.ts
    theme/tokens.ts  contrast.ts  validate-theme.ts  theme-to-style.ts
    fixtures/demo-catalog.ts
    queries/get-catalog-home.ts
tests/
  lib/format.test.ts  routes.test.ts  whatsapp.test.ts
  theme/contrast.test.ts  validate-theme.test.ts  theme-to-style.test.ts  globals-css.test.ts
  catalogs/get-catalog-home.test.ts
  storefront/*.test.tsx
  guard-no-hex.test.ts
vitest.config.ts                    # modificar: incluir *.test.tsx
```

---

### Task 1: Utilitários `format`, `routes` e `whatsapp`

**Files:**
- Create: `src/lib/format.ts`, `src/lib/routes.ts`, `src/lib/whatsapp.ts`
- Test: `tests/lib/format.test.ts`, `tests/lib/routes.test.ts`, `tests/lib/whatsapp.test.ts`

**Interfaces:**
- Produces:
  - `formatPrice(cents: number): string` — "R$ 149,90" com espaço não separável (U+00A0); lança `RangeError` se `cents` não for inteiro seguro ≥ 0.
  - `routes.catalog(slug)`, `routes.products(slug)`, `routes.search(slug)`, `routes.category(slug, categorySlug)`, `routes.product(slug, productSlug)` — todas `string`.
  - `whatsappLink(value?: string | null): string | null` — `https://wa.me/<dígitos>` ou `null` se inválido.
  - `instagramUrl(handle: string): string` — `https://instagram.com/<handle sem @>`.

- [ ] **Step 1: Write the failing tests**

`tests/lib/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";

describe("formatPrice", () => {
  it("formata centavos em BRL pt-BR com espaço não separável", () => {
    expect(formatPrice(14990)).toBe("R$ 149,90");
  });
  it("trata zero como preço válido", () => {
    expect(formatPrice(0)).toBe("R$ 0,00");
  });
  it("formata milhares", () => {
    expect(formatPrice(123456789)).toBe("R$ 1.234.567,89");
  });
  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejeita %s", (v) => {
    expect(() => formatPrice(v)).toThrow(RangeError);
  });
});
```

`tests/lib/routes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";

describe("routes", () => {
  it("monta as URLs provisórias", () => {
    expect(routes.catalog("loja")).toBe("/loja");
    expect(routes.products("loja")).toBe("/loja/produtos");
    expect(routes.search("loja")).toBe("/loja/busca");
    expect(routes.category("loja", "bebes")).toBe("/loja/categoria/bebes");
    expect(routes.product("loja", "vestido")).toBe("/loja/produto/vestido");
  });
  it("codifica segmentos", () => {
    expect(routes.product("loja", "a/b?c")).toBe("/loja/produto/a%2Fb%3Fc");
  });
});
```

`tests/lib/whatsapp.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lib`
Expected: FAIL (módulos `@/lib/*` não existem).

- [ ] **Step 3: Write minimal implementation**

`src/lib/format.ts`:
```ts
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatPrice(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("cents must be a non-negative safe integer");
  }
  return brl.format(cents / 100);
}
```

`src/lib/routes.ts`:
```ts
const seg = encodeURIComponent;

// Único lugar que monta URLs públicas. Caminhos provisórios (ver OQ-15).
export const routes = {
  catalog: (slug: string) => `/${seg(slug)}`,
  products: (slug: string) => `/${seg(slug)}/produtos`,
  search: (slug: string) => `/${seg(slug)}/busca`,
  category: (slug: string, categorySlug: string) => `/${seg(slug)}/categoria/${seg(categorySlug)}`,
  product: (slug: string, productSlug: string) => `/${seg(slug)}/produto/${seg(productSlug)}`,
};
```

`src/lib/whatsapp.ts`:
```ts
const E164 = /^\+?[1-9]\d{7,14}$/;

export function whatsappLink(value?: string | null): string | null {
  if (!value || !E164.test(value)) return null;
  return `https://wa.me/${value.replace("+", "")}`;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.trim().replace(/^@/, "")}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib tests/lib
git commit -m "feat(lib): add price formatting, route builders and WhatsApp link helpers"
```

---

### Task 2: Módulo de tema (tokens, contraste, validação, estilo)

**Files:**
- Create: `src/modules/catalogs/theme/tokens.ts`, `contrast.ts`, `validate-theme.ts`, `theme-to-style.ts`
- Test: `tests/theme/contrast.test.ts`, `validate-theme.test.ts`, `theme-to-style.test.ts`

**Interfaces:**
- Produces (`tokens.ts`): `COLOR_TOKENS` (readonly tuple), `type ColorToken`, `type FontKey = "dm-sans" | "inter"`, `type CatalogTheme = { colors: Record<ColorToken, string>; headingFont: FontKey; bodyFont: FontKey }`, `defaultTheme: CatalogTheme`.
- Produces (`contrast.ts`): `contrastRatio(a: string, b: string): number` (hex `#RRGGBB`).
- Produces (`validate-theme.ts`): `type ThemeIssue = { tokens: ColorToken[]; message: string }`, `validateTheme(theme: CatalogTheme): ThemeIssue[]` (vazio = válido).
- Produces (`theme-to-style.ts`): `themeToStyle(theme: CatalogTheme): React.CSSProperties` com `--theme-<token>`, `--theme-font-heading`, `--theme-font-body`.

- [ ] **Step 1: Write the failing tests**

`tests/theme/contrast.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/modules/catalogs/theme/contrast";

describe("contrastRatio", () => {
  it("preto sobre branco é 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });
  it("cores iguais dão 1 e a ordem dos argumentos não importa", () => {
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrastRatio("#292D2A", "#FAF8F4")).toBeCloseTo(contrastRatio("#FAF8F4", "#292D2A"), 5);
  });
  it("bate com o valor medido do guia (fg sobre bg ≈ 13,17)", () => {
    expect(contrastRatio("#292D2A", "#FAF8F4")).toBeCloseTo(13.17, 1);
  });
});
```

`tests/theme/validate-theme.test.ts`:
```ts
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
```

`tests/theme/theme-to-style.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/theme`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Write minimal implementation**

`src/modules/catalogs/theme/tokens.ts`:
```ts
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
```

`src/modules/catalogs/theme/contrast.ts`:
```ts
function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```

`src/modules/catalogs/theme/validate-theme.ts`:
```ts
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
```

`src/modules/catalogs/theme/theme-to-style.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/theme`
Expected: PASS (inclui a paleta padrão sem issues).

- [ ] **Step 5: Commit**

```bash
git add src/modules tests/theme
git commit -m "feat(theme): add catalog theme tokens, WCAG contrast validation and style mapping"
```

---

### Task 3: Tokens no Tailwind, fontes e guarda contra hexadecimal

**Files:**
- Modify: `src/app/globals.css` (reescrever), `src/app/layout.tsx`, `vitest.config.ts`
- Test: `tests/theme/globals-css.test.ts`, `tests/guard-no-hex.test.ts`

**Interfaces:**
- Consumes: `defaultTheme`, `COLOR_TOKENS` (Task 2).
- Produces: utilitários Tailwind `bg-bg bg-surface bg-surface-subtle text-fg text-fg-muted bg-action bg-action-hover text-brand bg-accent text-accent-strong border-border border-border-strong`; tamanhos `text-display text-h1 text-h2 text-price text-body text-label text-caption`; `font-heading`, `font-sans`; raios `rounded-control rounded-card rounded-hero`; classes de fonte `--font-dm-sans`/`--font-inter` no `<html>`.

- [ ] **Step 1: Write the failing tests**

`tests/theme/globals-css.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, defaultTheme } from "@/modules/catalogs/theme/tokens";

const css = readFileSync("src/app/globals.css", "utf8");

describe("globals.css", () => {
  it.each(COLOR_TOKENS)("`:root` define --theme-%s igual ao defaultTheme", (token) => {
    const match = css.match(new RegExp(`--theme-${token}:\\s*(#[0-9a-fA-F]{6})`));
    expect(match?.[1].toUpperCase()).toBe(defaultTheme.colors[token].toUpperCase());
  });
  it.each(COLOR_TOKENS)("expõe --color-%s ao Tailwind", (token) => {
    expect(css).toContain(`--color-${token}: var(--theme-${token})`);
  });
});
```

`tests/guard-no-hex.test.ts`:
```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const roots = ["src/components", "src/app"];

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name));
}

describe("componentes não usam cores hexadecimais", () => {
  it("nenhum arquivo em src/components ou src/app contém #RGB/#RRGGBB", () => {
    const offenders = roots
      .flatMap(files)
      .filter((f) => HEX.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/theme/globals-css.test.ts tests/guard-no-hex.test.ts`
Expected: `globals-css` FAIL (CSS ainda é o do template); `guard-no-hex` PASS (ainda não há hex em `src/app`; é guarda para o futuro).

- [ ] **Step 3: Implement**

`src/app/globals.css` (substituir o arquivo inteiro):
```css
@import "tailwindcss";

/* Tokens padrão do guia v1.2. Cada catálogo sobrescreve --theme-* no ThemeScope. */
:root {
  --theme-bg: #FAF8F4;
  --theme-surface: #FFFFFF;
  --theme-surface-subtle: #EEF1EC;
  --theme-fg: #292D2A;
  --theme-fg-muted: #6B6F6B;
  --theme-action: #5E7462;
  --theme-action-hover: #4F6353;
  --theme-brand: #718775;
  --theme-accent: #C98470;
  --theme-accent-strong: #9E5643;
  --theme-border: #E8E4DC;
  --theme-border-strong: #8C8880;
  --theme-font-heading: var(--font-dm-sans);
  --theme-font-body: var(--font-inter);
}

@theme inline {
  --color-bg: var(--theme-bg);
  --color-surface: var(--theme-surface);
  --color-surface-subtle: var(--theme-surface-subtle);
  --color-fg: var(--theme-fg);
  --color-fg-muted: var(--theme-fg-muted);
  --color-action: var(--theme-action);
  --color-action-hover: var(--theme-action-hover);
  --color-brand: var(--theme-brand);
  --color-accent: var(--theme-accent);
  --color-accent-strong: var(--theme-accent-strong);
  --color-border: var(--theme-border);
  --color-border-strong: var(--theme-border-strong);

  --font-heading: var(--theme-font-heading), ui-sans-serif, system-ui, sans-serif;
  --font-sans: var(--theme-font-body), ui-sans-serif, system-ui, sans-serif;

  --radius-control: 10px;
  --radius-card: 14px;
  --radius-hero: 18px;

  --text-display: 32px;
  --text-display--line-height: 38px;
  --text-h1: 24px;
  --text-h1--line-height: 30px;
  --text-h2: 18px;
  --text-h2--line-height: 24px;
  --text-price: 18px;
  --text-price--line-height: 24px;
  --text-body: 16px;
  --text-body--line-height: 24px;
  --text-label: 14px;
  --text-label--line-height: 20px;
  --text-caption: 12px;
  --text-caption--line-height: 16px;
}

body {
  background: var(--theme-bg);
  color: var(--theme-fg);
  font-family: var(--theme-font-body), ui-sans-serif, system-ui, sans-serif;
  font-size: 16px;
  line-height: 24px;
}

:focus-visible {
  outline: 2px solid var(--theme-action);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

`src/app/layout.tsx` (substituir o arquivo inteiro):
```tsx
import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Catálogo Digital",
  description: "Vitrine digital de produtos com contato via WhatsApp",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

`vitest.config.ts`: alterar a linha `include` para
```ts
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo PASS; o build compila com as novas fontes (requer rede para o Google Fonts).

- [ ] **Step 5: Commit**

```bash
git add src/app tests vitest.config.ts
git commit -m "feat(ui): add design tokens to Tailwind, DM Sans/Inter fonts and no-hex guard"
```

---

### Task 4: Domínio do catálogo (tipos, fixture, `getCatalogHome`)

**Files:**
- Create: `src/modules/catalogs/types.ts`, `reserved-slugs.ts`, `fixtures/demo-catalog.ts`, `queries/get-catalog-home.ts`
- Test: `tests/catalogs/get-catalog-home.test.ts`

**Interfaces:**
- Consumes: `CatalogTheme`, `defaultTheme` (Task 2), `validateTheme` (teste).
- Produces (`types.ts`): `StoreInfo`, `HeroView`, `CategoryView`, `ProductView`, `CatalogHomeView` (campos abaixo).
- Produces: `getCatalogHome(slug: string): Promise<CatalogHomeView | null>`; `isReservedSlug(slug: string): boolean`.

- [ ] **Step 1: Write the failing test**

`tests/catalogs/get-catalog-home.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { validateTheme } from "@/modules/catalogs/theme/validate-theme";

afterEach(() => vi.unstubAllEnvs());

describe("getCatalogHome", () => {
  it("retorna a vitrine do catálogo fictício", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(home?.store.slug).toBe("demo-infantil");
    expect(home?.categories.length).toBeGreaterThan(0);
    expect(home?.productsOrder).toBe("published_at");
  });

  it("exclui rascunhos e arquivados", async () => {
    const home = await getCatalogHome("demo-infantil");
    const names = home!.products.map((p) => p.name);
    expect(names).not.toContain("Rascunho interno");
    expect(names).not.toContain("Peça arquivada");
  });

  it("deriva isAvailable das variações", async () => {
    const home = await getCatalogHome("demo-infantil");
    const byName = Object.fromEntries(home!.products.map((p) => [p.name, p]));
    expect(byName["Tênis Branco"].isAvailable).toBe(false);
    expect(byName["Vestido Floral"].isAvailable).toBe(true);
  });

  it("mantém preço zero como válido", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(home!.products.some((p) => p.basePriceCents === 0)).toBe(true);
  });

  it("não expõe campos internos", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(Object.keys(home!.products[0]).sort()).toEqual(
      ["basePriceCents", "imageAlt", "imageUrl", "isAvailable", "name", "slug"].sort(),
    );
  });

  it("o tema da fixture passa na validação de contraste", async () => {
    const home = await getCatalogHome("demo-infantil");
    expect(validateTheme(home!.theme)).toEqual([]);
  });

  it("normaliza maiúsculas", async () => {
    expect(await getCatalogHome("Demo-Infantil")).not.toBeNull();
  });

  it.each(["nao-existe", "admin", "api", "_next", "ADMIN", "", "../x", "a".repeat(5000), "demo infantil"])(
    "retorna null para slug %#",
    async (slug) => {
      expect(await getCatalogHome(slug)).toBeNull();
    },
  );

  it("não responde em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await getCatalogHome("demo-infantil")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/catalogs`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implement**

`src/modules/catalogs/types.ts`:
```ts
import type { CatalogTheme } from "./theme/tokens";

export type StoreInfo = {
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
  whatsappE164?: string;
  instagram?: string;
  address?: string;
  hours?: string;
};

export type HeroView = { title: string; text: string; imageUrl?: string; imageAlt?: string };
export type CategoryView = { slug: string; name: string; imageUrl?: string };

export type ProductView = {
  slug: string;
  name: string;
  basePriceCents: number;
  imageUrl?: string;
  imageAlt: string;
  isAvailable: boolean;
};

export type CatalogHomeView = {
  store: StoreInfo;
  theme: CatalogTheme;
  hero?: HeroView;
  categories: CategoryView[];
  productsOrder: "published_at" | "default";
  products: ProductView[];
};
```

`src/modules/catalogs/reserved-slugs.ts`:
```ts
const RESERVED = new Set(["admin", "api", "_next"]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase());
}
```

`src/modules/catalogs/fixtures/demo-catalog.ts`:
```ts
import { defaultTheme } from "../theme/tokens";
import type { CategoryView, HeroView, StoreInfo } from "../types";

export type FixtureProduct = {
  slug: string;
  name: string;
  basePriceCents: number;
  imageUrl?: string;
  imageAlt: string;
  status: "draft" | "published" | "archived";
  variants: { isAvailable: boolean }[];
};

export type FixtureCatalog = {
  store: StoreInfo;
  theme: typeof defaultTheme;
  hero?: HeroView;
  categories: CategoryView[];
  products: FixtureProduct[];
};

const available = [{ isAvailable: true }, { isAvailable: false }];

// Dados fictícios. Nome, textos e preços não são de nenhuma loja real.
export const demoCatalog: FixtureCatalog = {
  store: {
    slug: "demo-infantil",
    name: "Loja Exemplo",
    description: "Moda infantil para todas as fases da infância.",
    whatsappE164: "+5511999990000",
    instagram: "@lojaexemplo",
    address: "Rua das Flores, 123 — São Paulo/SP",
    hours: "Seg a sáb, 9h às 18h",
  },
  theme: defaultTheme,
  hero: {
    title: "Pequenos estilos. Grandes descobertas.",
    text: "Moda infantil para todas as fases da infância.",
  },
  categories: [
    { slug: "bebes", name: "Bebês" },
    { slug: "meninas", name: "Meninas" },
    { slug: "meninos", name: "Meninos" },
    { slug: "calcados", name: "Calçados" },
    { slug: "acessorios", name: "Acessórios" },
  ],
  products: [
    { slug: "vestido-floral", name: "Vestido Floral", basePriceCents: 14990, imageAlt: "Vestido floral bege, vista frontal", status: "published", variants: available },
    { slug: "jaqueta-sarja", name: "Jaqueta Sarja", basePriceCents: 17990, imageAlt: "Jaqueta de sarja verde, vista frontal", status: "published", variants: available },
    { slug: "conjunto-rosa-linho", name: "Conjunto Rosa Linho", basePriceCents: 13990, imageAlt: "Conjunto de linho rosa, vista frontal", status: "published", variants: available },
    { slug: "macacao-jeans", name: "Macacão Jeans", basePriceCents: 16990, imageAlt: "Macacão jeans azul, vista frontal", status: "published", variants: available },
    { slug: "conjunto-verao-estampado", name: "Conjunto de verão com estampa floral delicada, babados e botões de madrepérola", basePriceCents: 18990, imageAlt: "Conjunto de verão floral, vista frontal", status: "published", variants: available },
    { slug: "body-bebe", name: "Body Bebê", basePriceCents: 4990, imageAlt: "Body de algodão branco, vista frontal", status: "published", variants: available },
    { slug: "meia-lisa", name: "Meia Lisa (brinde)", basePriceCents: 0, imageAlt: "Par de meias lisas brancas", status: "published", variants: available },
    { slug: "tenis-branco", name: "Tênis Branco", basePriceCents: 12990, imageAlt: "Tênis branco infantil, vista lateral", status: "published", variants: [{ isAvailable: false }] },
    { slug: "rascunho-interno", name: "Rascunho interno", basePriceCents: 9990, imageAlt: "Rascunho", status: "draft", variants: available },
    { slug: "peca-arquivada", name: "Peça arquivada", basePriceCents: 9990, imageAlt: "Arquivada", status: "archived", variants: available },
  ],
};
```

`src/modules/catalogs/queries/get-catalog-home.ts`:
```ts
import { demoCatalog, type FixtureCatalog } from "../fixtures/demo-catalog";
import { isReservedSlug } from "../reserved-slugs";
import type { CatalogHomeView, ProductView } from "../types";

// Troque esta função por leitura do Supabase mantendo o contrato de CatalogHomeView.
function findCatalog(slug: string): FixtureCatalog | null {
  if (process.env.NODE_ENV === "production") return null;
  return slug === demoCatalog.store.slug ? demoCatalog : null;
}

export async function getCatalogHome(slug: string): Promise<CatalogHomeView | null> {
  const normalized = slug.toLowerCase();
  if (isReservedSlug(normalized)) return null;

  const catalog = findCatalog(normalized);
  if (!catalog) return null;

  const products: ProductView[] = catalog.products
    .filter((p) => p.status === "published")
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      basePriceCents: p.basePriceCents,
      imageUrl: p.imageUrl,
      imageAlt: p.imageAlt,
      isAvailable: p.variants.some((v) => v.isAvailable),
    }));

  return {
    store: catalog.store,
    theme: catalog.theme,
    hero: catalog.hero,
    categories: catalog.categories,
    productsOrder: "published_at",
    products,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/catalogs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules tests/catalogs
git commit -m "feat(catalogs): add catalog home view types, demo fixture and getCatalogHome"
```

---

### Task 5: Componentes `ui/` e cartões de produto

**Files:**
- Create: `src/components/ui/icons.tsx`, `container.tsx`, `button-link.tsx`, `skeleton.tsx`; `src/components/storefront/image-placeholder.tsx`, `price-display.tsx`, `product-card.tsx`, `product-grid.tsx`
- Test: `tests/storefront/product-card.test.tsx`, `tests/storefront/product-grid.test.tsx`

**Interfaces:**
- Consumes: `formatPrice`, `routes` (Task 1); `ProductView` (Task 4).
- Produces:
  - `MenuIcon, SearchIcon, WhatsAppIcon, ArrowRightIcon, CloseIcon` — `(props: { className?: string }) => JSX` (SVG `aria-hidden`).
  - `Container({ children, className? })`.
  - `ButtonLink({ href, variant?: "primary" | "secondary", external?: boolean, className?, children })`.
  - `Skeleton({ className? })`.
  - `ImagePlaceholder({ className? })`; `PriceDisplay({ cents, className? })`.
  - `ProductCard({ storeSlug: string, product: ProductView, priority?: boolean })` — renderiza `<li>`.
  - `ProductGrid({ storeSlug: string, products: ProductView[], order: "published_at" | "default" })`.

- [ ] **Step 1: Write the failing tests**

`tests/storefront/product-card.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCard } from "@/components/storefront/product-card";
import type { ProductView } from "@/modules/catalogs/types";

const base: ProductView = {
  slug: "vestido-floral",
  name: "Vestido Floral",
  basePriceCents: 14990,
  imageAlt: "Vestido floral bege, vista frontal",
  isAvailable: true,
};
const render = (p: Partial<ProductView> = {}) =>
  renderToStaticMarkup(<ul><ProductCard storeSlug="loja" product={{ ...base, ...p }} /></ul>);

describe("ProductCard", () => {
  it("é um link para o produto com nome e preço", () => {
    const html = render();
    expect(html).toContain('href="/loja/produto/vestido-floral"');
    expect(html).toContain("Vestido Floral");
    expect(html).toContain("R$ 149,90");
  });
  it("mostra preço zero", () => {
    expect(render({ basePriceCents: 0 })).toContain("R$ 0,00");
  });
  it("mostra o selo textual quando indisponível", () => {
    expect(render({ isAvailable: false })).toContain("Indisponível");
    expect(render()).not.toContain("Indisponível");
  });
  it("usa a imagem com alt quando existe", () => {
    const html = render({ imageUrl: "/img/vestido.jpg" });
    expect(html).toContain("<img");
    expect(html).toContain('alt="Vestido floral bege, vista frontal"');
  });
  it("não renderiza <img> sem imagem", () => {
    expect(render()).not.toContain("<img");
  });
  it("não tem favoritos nem carrinho", () => {
    expect(render().toLowerCase()).not.toMatch(/favorit|carrinho|comprar/);
  });
});
```

`tests/storefront/product-grid.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductGrid } from "@/components/storefront/product-grid";
import type { ProductView } from "@/modules/catalogs/types";

const products: ProductView[] = [1, 2, 3].map((n) => ({
  slug: `p-${n}`,
  name: `Produto ${n}`,
  basePriceCents: 1000 * n,
  imageAlt: `Produto ${n}`,
  isAvailable: n !== 2,
}));

describe("ProductGrid", () => {
  it("usa 'Novidades' quando ordenado por publicação", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="published_at" />);
    expect(html).toContain("Novidades");
    expect(html).not.toContain(">Produtos<");
  });
  it("usa 'Produtos' na ordem padrão", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="default" />);
    expect(html).toContain(">Produtos<");
    expect(html).not.toContain("Novidades");
  });
  it("tem 'Ver todos' para a listagem e um item por produto", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="default" />);
    expect(html).toContain('href="/loja/produtos"');
    expect(html.match(/<li/g)).toHaveLength(3);
  });
  it("usa as 3 larguras de grade do guia", () => {
    const html = renderToStaticMarkup(<ProductGrid storeSlug="loja" products={products} order="default" />);
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("min-[600px]:grid-cols-3");
    expect(html).toContain("lg:grid-cols-4");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/storefront`
Expected: FAIL (componentes não existem).

- [ ] **Step 3: Implement**

`src/components/ui/icons.tsx`:
```tsx
type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "size-6"}
    >
      {children}
    </svg>
  );
}

export const MenuIcon = (p: IconProps) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M5 12h14m-6-6 6 6-6 6" /></Svg>;
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>
);
export const WhatsAppIcon = (p: IconProps) => <Svg {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></Svg>;
```

`src/components/ui/container.tsx`:
```tsx
export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 ${className}`}>{children}</div>;
}
```

`src/components/ui/button-link.tsx`:
```tsx
import Link from "next/link";

type Props = {
  href: string;
  variant?: "primary" | "secondary";
  external?: boolean;
  className?: string;
  children: React.ReactNode;
};

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-label font-semibold transition-colors";
const variants = {
  primary: "bg-action text-white hover:bg-action-hover",
  secondary: "border border-border-strong bg-surface text-fg hover:border-action",
};

export function ButtonLink({ href, variant = "secondary", external, className = "", children }: Props) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}
```

`src/components/ui/skeleton.tsx`:
```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-border ${className}`} />;
}
```

`src/components/storefront/image-placeholder.tsx`:
```tsx
export function ImagePlaceholder({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`h-full w-full bg-surface-subtle ${className}`} />;
}
```

`src/components/storefront/price-display.tsx`:
```tsx
import { formatPrice } from "@/lib/format";

export function PriceDisplay({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatPrice(cents)}</span>;
}
```

`src/components/storefront/product-card.tsx`:
```tsx
import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/routes";
import type { ProductView } from "@/modules/catalogs/types";
import { ImagePlaceholder } from "./image-placeholder";
import { PriceDisplay } from "./price-display";

type Props = { storeSlug: string; product: ProductView; priority?: boolean };

export function ProductCard({ storeSlug, product, priority = false }: Props) {
  return (
    <li>
      <Link
        href={routes.product(storeSlug, product.slug)}
        className="block overflow-hidden rounded-card border border-border bg-surface"
      >
        <div className="relative aspect-[4/5] bg-surface-subtle">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 600px) 33vw, 50vw"
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder />
          )}
          {!product.isAvailable && (
            <span className="absolute left-2 top-2 rounded-control bg-surface px-2 py-1 text-label font-medium text-fg">
              Indisponível
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-10 text-label font-medium text-fg">{product.name}</h3>
          <PriceDisplay cents={product.basePriceCents} className="mt-1 block text-label font-semibold text-fg" />
        </div>
      </Link>
    </li>
  );
}
```

`src/components/storefront/product-grid.tsx`:
```tsx
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { ProductView } from "@/modules/catalogs/types";
import { ProductCard } from "./product-card";

type Props = { storeSlug: string; products: ProductView[]; order: "published_at" | "default" };

export function ProductGrid({ storeSlug, products, order }: Props) {
  return (
    <section aria-labelledby="products-title" className="py-6">
      <Container>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="products-title" className="font-heading text-h2 font-semibold text-fg">
            {order === "published_at" ? "Novidades" : "Produtos"}
          </h2>
          <Link
            href={routes.products(storeSlug)}
            className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-action"
          >
            Ver todos <ArrowRightIcon className="size-4" />
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {products.map((product, index) => (
            <ProductCard key={product.slug} storeSlug={storeSlug} product={product} priority={index < 2} />
          ))}
        </ul>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm run lint && npx vitest run tests/storefront`
Expected: PASS. Se `next/image` falhar em `renderToStaticMarkup` no ambiente node, o teste de imagem aponta o erro; corrigir o componente, não o teste.

- [ ] **Step 5: Commit**

```bash
git add src/components tests/storefront
git commit -m "feat(storefront): add ui primitives, product card and product grid"
```

---

### Task 6: Categorias, hero, estado vazio e rodapé

**Files:**
- Create: `src/components/storefront/category-strip.tsx`, `hero.tsx`, `empty-state.tsx`, `site-footer.tsx`
- Test: `tests/storefront/category-strip.test.tsx`, `hero.test.tsx`, `empty-state.test.tsx`, `site-footer.test.tsx`

**Interfaces:**
- Consumes: `routes`, `whatsappLink`, `instagramUrl` (Task 1); `CategoryView`, `HeroView`, `StoreInfo` (Task 4); `Container`, `ButtonLink` (Task 5).
- Produces:
  - `CategoryStrip({ storeSlug, categories })` — retorna `null` se vazio.
  - `Hero({ storeSlug, hero })` — `<h1>` com `hero.title`; CTA "Explorar produtos" → `routes.products`.
  - `EmptyState({ whatsappE164? })`.
  - `SiteFooter({ store: StoreInfo })`.

- [ ] **Step 1: Write the failing tests**

`tests/storefront/category-strip.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryStrip } from "@/components/storefront/category-strip";

describe("CategoryStrip", () => {
  it("lista categorias com link e inicial como fallback", () => {
    const html = renderToStaticMarkup(
      <CategoryStrip storeSlug="loja" categories={[{ slug: "bebes", name: "Bebês" }]} />,
    );
    expect(html).toContain('href="/loja/categoria/bebes"');
    expect(html).toContain("Bebês");
    expect(html).toContain(">B<");
    expect(html).toContain('aria-label="Categorias"');
  });
  it("não renderiza nada sem categorias", () => {
    expect(renderToStaticMarkup(<CategoryStrip storeSlug="loja" categories={[]} />)).toBe("");
  });
});
```

`tests/storefront/hero.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/storefront/hero";

describe("Hero", () => {
  const hero = { title: "Pequenos estilos", text: "Moda infantil" };
  it("tem h1, texto e CTA secundário para a listagem", () => {
    const html = renderToStaticMarkup(<Hero storeSlug="loja" hero={hero} />);
    expect(html).toMatch(/<h1[^>]*>Pequenos estilos<\/h1>/);
    expect(html).toContain("Moda infantil");
    expect(html).toContain("Explorar produtos");
    expect(html).toContain('href="/loja/produtos"');
  });
  it("sem imagem não renderiza <img>", () => {
    expect(renderToStaticMarkup(<Hero storeSlug="loja" hero={hero} />)).not.toContain("<img");
  });
  it("com imagem usa o alt informado", () => {
    const html = renderToStaticMarkup(
      <Hero storeSlug="loja" hero={{ ...hero, imageUrl: "/h.jpg", imageAlt: "Vestido floral bege" }} />,
    );
    expect(html).toContain('alt="Vestido floral bege"');
  });
});
```

`tests/storefront/empty-state.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/storefront/empty-state";

describe("EmptyState", () => {
  it("com WhatsApp válido oferece o contato", () => {
    const html = renderToStaticMarkup(<EmptyState whatsappE164="+5511999990000" />);
    expect(html).toContain("Novidades chegando em breve. Fale com a gente pelo WhatsApp.");
    expect(html).toContain('href="https://wa.me/5511999990000"');
  });
  it.each([undefined, "abc"])("sem WhatsApp válido (%s) não cita nem linka o WhatsApp", (v) => {
    const html = renderToStaticMarkup(<EmptyState whatsappE164={v} />);
    expect(html).toContain("Novidades chegando em breve.");
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("wa.me");
  });
});
```

`tests/storefront/site-footer.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/storefront/site-footer";

const store = { slug: "loja", name: "Loja Exemplo", description: "Desc" };

describe("SiteFooter", () => {
  it("mostra só o nome quando nada mais está configurado", () => {
    const html = renderToStaticMarkup(<SiteFooter store={store} />);
    expect(html).toContain("Loja Exemplo");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("instagram");
  });
  it("mostra contatos configurados", () => {
    const html = renderToStaticMarkup(
      <SiteFooter
        store={{ ...store, whatsappE164: "+5511999990000", instagram: "@lojaexemplo", address: "Rua A, 1", hours: "9h às 18h" }}
      />,
    );
    expect(html).toContain("https://wa.me/5511999990000");
    expect(html).toContain("Rua A, 1");
    expect(html).toContain("9h às 18h");
  });
  it("não duplica @ no link do Instagram", () => {
    const html = renderToStaticMarkup(<SiteFooter store={{ ...store, instagram: "@lojaexemplo" }} />);
    expect(html).toContain('href="https://instagram.com/lojaexemplo"');
    expect(html).not.toContain("@@");
  });
  it("ignora WhatsApp inválido", () => {
    expect(renderToStaticMarkup(<SiteFooter store={{ ...store, whatsappE164: "abc" }} />)).not.toContain("wa.me");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/storefront`
Expected: os 4 novos arquivos FAIL (componentes não existem); os da Task 5 seguem PASS.

- [ ] **Step 3: Implement**

`src/components/storefront/category-strip.tsx`:
```tsx
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { CategoryView } from "@/modules/catalogs/types";

export function CategoryStrip({ storeSlug, categories }: { storeSlug: string; categories: CategoryView[] }) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categorias" className="py-4">
      <Container>
        <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
          {categories.map((category) => (
            <li key={category.slug} className="snap-start">
              <Link
                href={routes.category(storeSlug, category.slug)}
                className="flex min-w-[72px] flex-col items-center gap-2"
              >
                <span className="relative grid size-16 place-items-center overflow-hidden rounded-full bg-surface-subtle font-heading text-h2 font-semibold text-brand">
                  {category.imageUrl ? (
                    <Image src={category.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    category.name.charAt(0)
                  )}
                </span>
                <span className="text-label font-medium text-fg">{category.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
```

`src/components/storefront/hero.tsx`:
```tsx
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/routes";
import type { HeroView } from "@/modules/catalogs/types";

export function Hero({ storeSlug, hero }: { storeSlug: string; hero: HeroView }) {
  return (
    <section className="py-4">
      <Container>
        <div className="grid overflow-hidden rounded-hero bg-surface-subtle lg:grid-cols-2">
          {hero.imageUrl && (
            <div className="relative aspect-[4/5] lg:order-2 lg:aspect-[16/9]">
              <Image
                src={hero.imageUrl}
                alt={hero.imageAlt ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
          <div className="flex flex-col items-start justify-center gap-3 p-6 lg:p-10">
            <h1 className="font-heading text-display font-bold text-fg">{hero.title}</h1>
            <p className="text-body text-fg">{hero.text}</p>
            <ButtonLink href={routes.products(storeSlug)} variant="secondary">
              Explorar produtos <ArrowRightIcon className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
```

`src/components/storefront/empty-state.tsx`:
```tsx
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { whatsappLink } from "@/lib/whatsapp";

export function EmptyState({ whatsappE164 }: { whatsappE164?: string }) {
  const href = whatsappLink(whatsappE164);
  return (
    <section className="py-8">
      <Container>
        <div className="flex flex-col items-center gap-4 rounded-card bg-surface-subtle p-8 text-center">
          <p className="text-body text-fg">
            {href ? "Novidades chegando em breve. Fale com a gente pelo WhatsApp." : "Novidades chegando em breve."}
          </p>
          {href && (
            <ButtonLink href={href} external variant="primary">
              Falar pelo WhatsApp
            </ButtonLink>
          )}
        </div>
      </Container>
    </section>
  );
}
```

`src/components/storefront/site-footer.tsx`:
```tsx
import { Container } from "@/components/ui/container";
import { instagramUrl, whatsappLink } from "@/lib/whatsapp";
import type { StoreInfo } from "@/modules/catalogs/types";

export function SiteFooter({ store }: { store: StoreInfo }) {
  const whatsapp = whatsappLink(store.whatsappE164);
  const linkCls = "inline-flex min-h-11 items-center text-label font-medium text-action underline";
  return (
    <footer className="mt-12 border-t border-border bg-surface py-8">
      <Container className="flex flex-col gap-3">
        <p className="font-heading text-h2 font-semibold text-fg">{store.name}</p>
        {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={linkCls}>WhatsApp</a>}
        {store.instagram && (
          <a href={instagramUrl(store.instagram)} target="_blank" rel="noopener noreferrer" className={linkCls}>
            Instagram
          </a>
        )}
        {store.address && <p className="text-label text-fg-muted">{store.address}</p>}
        {store.hours && <p className="text-label text-fg-muted">{store.hours}</p>}
      </Container>
    </footer>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components tests/storefront
git commit -m "feat(storefront): add category strip, hero, empty state and footer"
```

---

### Task 7: Header (busca, gaveta) e composição `CatalogHome`

**Files:**
- Create: `src/components/storefront/search-field.tsx`, `category-drawer.tsx`, `site-header.tsx`, `theme-scope.tsx`, `home-skeleton.tsx`, `catalog-home.tsx`
- Test: `tests/storefront/site-header.test.tsx`, `catalog-home.test.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 1–6; `themeToStyle` (Task 2); `CatalogHomeView` (Task 4).
- Produces:
  - `SearchField({ storeSlug, id })` — `<form role="search" action="/{slug}/busca" method="get">` com `<input name="q">`.
  - `CategoryDrawer({ storeSlug, categories })` — client component (`"use client"`).
  - `SiteHeader({ store, categories })`.
  - `ThemeScope({ theme, children })` — wrapper com variáveis `--theme-*`.
  - `HomeSkeleton()`.
  - `CatalogHome({ home: CatalogHomeView })` — síncrono; contém `ThemeScope`, skip link, header, `<main id="conteudo">`, rodapé.

- [ ] **Step 1: Write the failing tests**

`tests/storefront/site-header.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/storefront/site-header";

const store = { slug: "loja", name: "Loja Exemplo", description: "Desc" };
const categories = [{ slug: "bebes", name: "Bebês" }];

describe("SiteHeader", () => {
  it("mostra o nome da loja em texto quando não há logo", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain("Loja Exemplo");
    expect(html).toContain('href="/loja"');
  });
  it("tem busca GET para a rota de busca, com label", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain('action="/loja/busca"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Buscar produtos..."');
    expect(html).toMatch(/<label[^>]*>Buscar produtos<\/label>/);
  });
  it("só mostra o atalho de WhatsApp com número válido", () => {
    const withWa = renderToStaticMarkup(
      <SiteHeader store={{ ...store, whatsappE164: "+5511999990000" }} categories={categories} />,
    );
    expect(withWa).toContain("https://wa.me/5511999990000");
    expect(withWa).toContain('aria-label="Conversar pelo WhatsApp"');
    for (const bad of [undefined, "abc"]) {
      const html = renderToStaticMarkup(<SiteHeader store={{ ...store, whatsappE164: bad }} categories={categories} />);
      expect(html).not.toContain("wa.me");
    }
  });
  it("tem botão de menu nomeado e links de categoria", () => {
    const html = renderToStaticMarkup(<SiteHeader store={store} categories={categories} />);
    expect(html).toContain('aria-label="Abrir menu de categorias"');
    expect(html).toContain('href="/loja/categoria/bebes"');
  });
});
```

`tests/storefront/catalog-home.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogHome } from "@/components/storefront/catalog-home";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";
import { defaultTheme } from "@/modules/catalogs/theme/tokens";
import type { CatalogHomeView } from "@/modules/catalogs/types";

const minimal: CatalogHomeView = {
  store: { slug: "vazia", name: "Loja Vazia", description: "x" },
  theme: defaultTheme,
  categories: [],
  productsOrder: "default",
  products: [],
};

describe("CatalogHome", () => {
  it("renderiza a vitrine completa do catálogo fictício", async () => {
    const home = (await getCatalogHome("demo-infantil"))!;
    const html = renderToStaticMarkup(<CatalogHome home={home} />);
    expect(html).toContain("--theme-action:#5E7462");
    expect(html).toContain('id="conteudo"');
    expect(html).toContain("Pular para o conteúdo");
    expect(html).toContain("Pequenos estilos. Grandes descobertas.");
    expect(html).toContain("Novidades");
    expect(html).toContain("Vestido Floral");
    expect(html).toContain("<footer");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
  it("catálogo mínimo: sem hero, categorias, produtos e contatos", () => {
    const html = renderToStaticMarkup(<CatalogHome home={minimal} />);
    expect(html).toMatch(/<h1[^>]*sr-only[^>]*>Loja Vazia<\/h1>/);
    expect(html).toContain("Novidades chegando em breve.");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain('aria-label="Categorias"');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
  it("todos indisponíveis: a grade continua e mostra os selos", () => {
    const html = renderToStaticMarkup(
      <CatalogHome
        home={{
          ...minimal,
          products: [{ slug: "a", name: "Peça A", basePriceCents: 100, imageAlt: "Peça A", isAvailable: false }],
        }}
      />,
    );
    expect(html).toContain("Peça A");
    expect(html).toContain("Indisponível");
    expect(html).not.toContain("Novidades chegando");
  });
  it("não introduz funcionalidades de e-commerce", async () => {
    const home = (await getCatalogHome("demo-infantil"))!;
    expect(renderToStaticMarkup(<CatalogHome home={home} />).toLowerCase()).not.toMatch(
      /carrinho|favorit|comprar|checkout|frete/,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/storefront`
Expected: os 2 novos arquivos FAIL.

- [ ] **Step 3: Implement**

`src/components/storefront/search-field.tsx`:
```tsx
import { SearchIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";

export function SearchField({ storeSlug, id }: { storeSlug: string; id: string }) {
  return (
    <form action={routes.search(storeSlug)} method="get" role="search" className="relative">
      <label htmlFor={id} className="sr-only">Buscar produtos</label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
      <input
        id={id}
        name="q"
        type="search"
        enterKeyHint="search"
        placeholder="Buscar produtos..."
        className="h-11 w-full rounded-control border border-border-strong bg-surface pl-10 pr-3 text-body text-fg placeholder:text-fg-muted"
      />
    </form>
  );
}
```

`src/components/storefront/category-drawer.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRef } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";
import type { CategoryView } from "@/modules/catalogs/types";

export function CategoryDrawer({ storeSlug, categories }: { storeSlug: string; categories: CategoryView[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu de categorias"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="grid size-11 place-items-center text-fg lg:hidden"
      >
        <MenuIcon />
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Categorias"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface p-0 text-fg backdrop:bg-fg/40"
      >
        <div className="flex items-center justify-between p-4">
          <span className="font-heading text-h2 font-semibold">Categorias</span>
          <button type="button" aria-label="Fechar menu" onClick={close} className="grid size-11 place-items-center">
            <CloseIcon />
          </button>
        </div>
        <ul>
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={routes.category(storeSlug, category.slug)}
                onClick={close}
                className="block px-4 py-3 text-body text-fg"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
```

`src/components/storefront/site-header.tsx`:
```tsx
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { WhatsAppIcon } from "@/components/ui/icons";
import { routes } from "@/lib/routes";
import { whatsappLink } from "@/lib/whatsapp";
import type { CategoryView, StoreInfo } from "@/modules/catalogs/types";
import { CategoryDrawer } from "./category-drawer";
import { SearchField } from "./search-field";

export function SiteHeader({ store, categories }: { store: StoreInfo; categories: CategoryView[] }) {
  const whatsapp = whatsappLink(store.whatsappE164);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <Container className="flex h-16 items-center gap-3">
        <CategoryDrawer storeSlug={store.slug} categories={categories} />
        <Link
          href={routes.catalog(store.slug)}
          className="flex-1 text-center font-heading text-h2 font-bold text-fg lg:flex-none lg:text-left"
        >
          {store.logoUrl ? (
            <Image src={store.logoUrl} alt={store.name} width={120} height={32} className="mx-auto h-8 w-auto lg:mx-0" />
          ) : (
            store.name
          )}
        </Link>
        <nav aria-label="Categorias" className="hidden lg:block">
          <ul className="flex gap-6">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={routes.category(store.slug, category.slug)} className="text-label font-medium text-fg">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto hidden w-72 lg:block">
          <SearchField storeSlug={store.slug} id="search-desktop" />
        </div>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar pelo WhatsApp"
            className="grid size-11 place-items-center text-fg"
          >
            <WhatsAppIcon />
          </a>
        ) : (
          <span aria-hidden="true" className="size-11 lg:hidden" />
        )}
      </Container>
      <div className="pb-3 lg:hidden">
        <Container>
          <SearchField storeSlug={store.slug} id="search-mobile" />
        </Container>
      </div>
    </header>
  );
}
```

`src/components/storefront/theme-scope.tsx`:
```tsx
import { themeToStyle } from "@/modules/catalogs/theme/theme-to-style";
import type { CatalogTheme } from "@/modules/catalogs/theme/tokens";

export function ThemeScope({ theme, children }: { theme: CatalogTheme; children: React.ReactNode }) {
  return (
    <div style={themeToStyle(theme)} className="flex min-h-dvh flex-col bg-bg font-sans text-fg">
      {children}
    </div>
  );
}
```

`src/components/storefront/home-skeleton.tsx`:
```tsx
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Carregando" className="min-h-dvh">
      <div className="h-16 border-b border-border bg-surface" />
      <Container className="grid grid-cols-2 gap-3 py-6 min-[600px]:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5]" />
        ))}
      </Container>
    </div>
  );
}
```

`src/components/storefront/catalog-home.tsx`:
```tsx
import type { CatalogHomeView } from "@/modules/catalogs/types";
import { CategoryStrip } from "./category-strip";
import { EmptyState } from "./empty-state";
import { Hero } from "./hero";
import { ProductGrid } from "./product-grid";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { ThemeScope } from "./theme-scope";

export function CatalogHome({ home }: { home: CatalogHomeView }) {
  const { store, theme, hero, categories, products, productsOrder } = home;
  return (
    <ThemeScope theme={theme}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-30 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader store={store} categories={categories} />
      <main id="conteudo" className="flex-1">
        {hero ? <Hero storeSlug={store.slug} hero={hero} /> : <h1 className="sr-only">{store.name}</h1>}
        <CategoryStrip storeSlug={store.slug} categories={categories} />
        {products.length > 0 ? (
          <ProductGrid storeSlug={store.slug} products={products} order={productsOrder} />
        ) : (
          <EmptyState whatsappE164={store.whatsappE164} />
        )}
      </main>
      <SiteFooter store={store} />
    </ThemeScope>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS. Atenção: o `SiteHeader` renderiza duas `nav aria-label="Categorias"` (header desktop e faixa) — o teste de `catalog-home` não conta `nav`, então não conflita; se o lint acusar landmarks duplicados, renomear o do header para `aria-label="Menu principal"`.

- [ ] **Step 5: Commit**

```bash
git add src/components tests/storefront
git commit -m "feat(storefront): add header with search and drawer, theme scope and CatalogHome"
```

---

### Task 8: Rota `/{catalogSlug}`, metadados, estados e build

**Files:**
- Create: `src/app/[catalogSlug]/page.tsx`, `error.tsx`, `not-found.tsx`
- Modify: `docs/delivery/SETUP.md` (variável `NEXT_PUBLIC_SITE_URL` já em `.env.example`; só documentar uso)

**Interfaces:**
- Consumes: `getCatalogHome` (Task 4), `CatalogHome`, `HomeSkeleton` (Task 7).
- Produces: rota pública `/{catalogSlug}` (sem `generateStaticParams`).

- [ ] **Step 1: Implement**

`src/app/[catalogSlug]/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogHome } from "@/components/storefront/catalog-home";
import { HomeSkeleton } from "@/components/storefront/home-skeleton";
import { getCatalogHome } from "@/modules/catalogs/queries/get-catalog-home";

export async function generateMetadata({ params }: PageProps<"/[catalogSlug]">): Promise<Metadata> {
  const { catalogSlug } = await params;
  const home = await getCatalogHome(catalogSlug);
  if (!home) return { title: "Página não encontrada", robots: { index: false } };

  const { store } = home;
  return {
    title: store.name,
    description: store.description,
    openGraph: {
      title: store.name,
      description: store.description,
      type: "website",
      locale: "pt_BR",
      ...(store.logoUrl ? { images: [store.logoUrl] } : {}),
    },
  };
}

async function CatalogHomeContent({ params }: { params: PageProps<"/[catalogSlug]">["params"] }) {
  const { catalogSlug } = await params;
  const home = await getCatalogHome(catalogSlug);
  if (!home) notFound();
  return <CatalogHome home={home} />;
}

export default function CatalogPage({ params }: PageProps<"/[catalogSlug]">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <CatalogHomeContent params={params} />
    </Suspense>
  );
}
```

`src/app/[catalogSlug]/error.tsx`:
```tsx
"use client";

import { Container } from "@/components/ui/container";

export default function CatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center py-16">
      <Container className="flex flex-col items-start gap-4">
        <p className="text-body text-fg">Não conseguimos carregar esta página.</p>
        <button
          type="button"
          onClick={reset}
          className="min-h-12 rounded-control bg-action px-5 text-label font-semibold text-white hover:bg-action-hover"
        >
          Tentar novamente
        </button>
      </Container>
    </main>
  );
}
```

`src/app/[catalogSlug]/not-found.tsx`:
```tsx
import Link from "next/link";
import { Container } from "@/components/ui/container";

export default function CatalogNotFound() {
  return (
    <main className="flex flex-1 items-center py-16">
      <Container className="flex flex-col items-start gap-4">
        <h1 className="font-heading text-h1 font-semibold text-fg">Página não encontrada</h1>
        <p className="text-body text-fg">Confira o endereço ou volte ao início.</p>
        <Link href="/" className="inline-flex min-h-12 items-center text-label font-semibold text-action underline">
          Voltar ao início
        </Link>
      </Container>
    </main>
  );
}
```

- [ ] **Step 2: Run gates and build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo PASS e o build lista `/[catalogSlug]` como rota com Partial Prerender. **Se o build falhar** por dado de runtime fora de `<Suspense>` (em `generateMetadata` ou na página), PARE e reporte o erro exato ao usuário antes de alterar a abordagem; não use `generateStaticParams` vazio nem desligue `cacheComponents` sem aprovação.

- [ ] **Step 3: Verify production behavior (fixture desligada)**

Run:
```bash
npx next start -p 3100 &
sleep 4
curl -s http://localhost:3100/demo-infantil | grep -o "Página não encontrada" | head -1
curl -s http://localhost:3100/demo-infantil | grep -o 'name="robots" content="noindex' | head -1
kill %1
```
Expected: ambas as linhas imprimem o texto (404 em produção, com `noindex`; o status HTTP pode ser 200 por causa do stream, conforme a spec).

- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "feat(app): add /{catalogSlug} home route with metadata, error and not-found states"
```

---

### Task 9: Verificação visual, acessibilidade e fechamento

**Files:**
- Create (fora do repositório, em scratchpad): `shot.mjs`
- Modify: `docs/delivery/SETUP.md`, `docs/delivery/IMPLEMENTATION_PLAN.md` só se algo divergir

**Interfaces:**
- Consumes: servidor de desenvolvimento com a fixture ativa (`NODE_ENV=development`).

- [ ] **Step 1: Instalar o Playwright fora do projeto e baixar o Chromium**

Run (no diretório do scratchpad):
```bash
cd "$SCRATCH" && npm init -y >/dev/null && npm i playwright && npx playwright install chromium
```
Expected: instalação concluída (não altera o `package.json` do projeto).

- [ ] **Step 2: Criar o script de verificação**

`shot.mjs` (scratchpad):
```js
import { chromium } from "playwright";

const url = "http://localhost:3000/demo-infantil";
const browser = await chromium.launch();
let failed = false;

for (const [name, width, height] of [["320", 320, 800], ["360", 360, 800], ["desktop", 1280, 900]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`${name}: overflow horizontal = ${overflow}px`);
  if (overflow > 0) failed = true;
  await page.screenshot({ path: `home-${name}.png`, fullPage: true });
  await page.close();
}

// Gaveta: abre, Esc fecha, foco volta ao botão
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
const button = page.getByRole("button", { name: "Abrir menu de categorias" });
await button.click();
const open = await page.evaluate(() => document.querySelector("dialog")?.open);
await page.keyboard.press("Escape");
const closed = await page.evaluate(() => !document.querySelector("dialog")?.open);
const focusBack = await button.evaluate((el) => el === document.activeElement);
console.log({ open, closed, focusBack });
if (!(open && closed && focusBack)) failed = true;

// Zoom 200% aproximado: viewport de 180 px de largura
const narrow = await browser.newPage({ viewport: { width: 180, height: 800 } });
await narrow.goto(url, { waitUntil: "networkidle" });
console.log("zoom200 overflow:", await narrow.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));

await browser.close();
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Subir o servidor e rodar**

Run:
```bash
cd <projeto> && npm run dev &   # aguardar "Ready"
cd "$SCRATCH" && node shot.mjs
```
Expected: `overflow horizontal = 0px` em 320, 360 e desktop; `{ open: true, closed: true, focusBack: true }`. Se algum overflow for > 0, corrigir o componente responsável (provável: nome longo do produto ou a faixa de categorias) e repetir.

- [ ] **Step 4: Revisar as capturas contra a referência**

Abrir `home-360.png` e `home-desktop.png` e `docs/design/approved-composite-v2.png` e conferir: header com busca abaixo no mobile; hero em bloco de texto (sem imagem, fixture sem fotos); categorias redondas rolando na horizontal; grade de 2 colunas a 360 px e 4 no desktop; nome longo cortado em 2 linhas; selo "Indisponível" no Tênis Branco; "R$ 0,00" na meia; rodapé com WhatsApp, Instagram, endereço e horário; nenhum elemento fora do guia (sem estrelas, coração, carrinho, terracota). Registrar divergências e corrigi-las.

- [ ] **Step 5: Gates finais, documentação e commit**

1. Em `docs/delivery/SETUP.md`, acrescentar uma seção:
```markdown
## Catálogo fictício
Em desenvolvimento, `http://localhost:3000/demo-infantil` mostra um catálogo de exemplo (`src/modules/catalogs/fixtures/demo-catalog.ts`). Em produção a fixture não responde. A home usa `NEXT_PUBLIC_SITE_URL` como base dos metadados Open Graph.
```
2. Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS.
3. Commit e push, depois conferir o CI:
```bash
git add docs
git commit -m "docs: document demo catalog and finish home storefront verification"
git push origin master
gh run list --limit 1
```
Expected: CI `success`.
