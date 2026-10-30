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
