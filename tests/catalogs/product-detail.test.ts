import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";
import {
  buildWhatsAppMessage,
  ctaState,
  galleryFor,
  missingOptions,
  parseSelection,
  priceView,
  productHref,
  selectedVariant,
  selectValue,
  valueState,
  type ProductDetail,
} from "@/modules/catalogs/product-detail";

// Vestido: cor (rosa, azul, verde) x tamanho (2, 4). A combinação azul·4 não existe e o azul está
// todo esgotado; verde só existe no tamanho 4, com preço próprio zero.
const dress: ProductDetail = {
  id: "p1",
  slug: "vestido-floral",
  name: "Vestido Floral",
  description: "Algodão.",
  basePriceCents: 7990,
  options: [
    {
      code: "cor",
      name: "Cor",
      values: [
        { id: "c-rosa", code: "rosa", label: "Rosa" },
        { id: "c-azul", code: "azul", label: "Azul" },
        { id: "c-verde", code: "verde", label: "Verde" },
      ],
    },
    {
      code: "tamanho",
      name: "Tamanho",
      values: [
        { id: "s-2", code: "2", label: "2" },
        { id: "s-4", code: "4", label: "4" },
      ],
    },
  ],
  variants: [
    { id: "v1", values: { cor: "rosa", tamanho: "2" }, priceCents: 7990, isAvailable: true },
    { id: "v2", values: { cor: "rosa", tamanho: "4" }, priceCents: 8990, isAvailable: true },
    { id: "v3", values: { cor: "azul", tamanho: "2" }, priceCents: 7990, isAvailable: false },
    { id: "v4", values: { cor: "verde", tamanho: "4" }, priceCents: 0, isAvailable: true },
  ],
  images: [
    { id: "g1", path: "/fotos/p1/g1.png", alt: "", optionValueId: null, position: 0 },
    { id: "r1", path: "/fotos/p1/r1.png", alt: "", optionValueId: "c-rosa", position: 1 },
    { id: "a1", path: "/fotos/p1/a1.png", alt: "", optionValueId: "c-azul", position: 2 },
    { id: "g2", path: "/fotos/p1/g2.png", alt: "", optionValueId: null, position: 3 },
  ],
};

const simple: ProductDetail = {
  ...dress,
  options: [],
  variants: [{ id: "only", values: {}, priceCents: 5000, isAvailable: true }],
  images: [],
};

describe("parseSelection (a URL nunca produz combinação inexistente)", () => {
  it("lê cor e tamanho válidos", () => {
    expect(parseSelection(dress, { cor: "rosa", tamanho: "4" })).toEqual({ cor: "rosa", tamanho: "4" });
  });

  it("sem parâmetros, nada escolhido", () => {
    expect(parseSelection(dress, {})).toEqual({});
  });

  it("descarta valor inexistente e opção desconhecida", () => {
    expect(parseSelection(dress, { cor: "roxo", tamanho: "2", material: "seda" })).toEqual({ tamanho: "2" });
  });

  it("descarta o valor que formaria uma combinação que não existe", () => {
    // azul·4 não existe: fica só a cor, que vem primeiro.
    expect(parseSelection(dress, { cor: "azul", tamanho: "4" })).toEqual({ cor: "azul" });
    expect(parseSelection(dress, { cor: "verde", tamanho: "2" })).toEqual({ cor: "verde" });
  });

  it("usa o primeiro valor quando o parâmetro se repete e ignora tipos estranhos", () => {
    expect(parseSelection(dress, { cor: ["azul", "rosa"] })).toEqual({ cor: "azul" });
    expect(parseSelection(dress, { cor: undefined, tamanho: [] })).toEqual({});
  });

  it("produto simples não tem o que escolher", () => {
    expect(parseSelection(simple, { cor: "rosa" })).toEqual({});
  });
});

describe("selectValue (o valor tocado tem prioridade)", () => {
  it("troca a cor mantendo o tamanho quando a combinação existe", () => {
    expect(selectValue(dress, { cor: "rosa", tamanho: "4" }, "cor", "verde")).toEqual({ cor: "verde", tamanho: "4" });
  });

  it("troca a cor e solta o tamanho que deixaria de existir", () => {
    expect(selectValue(dress, { cor: "rosa", tamanho: "4" }, "cor", "azul")).toEqual({ cor: "azul" });
  });

  it("escolher o tamanho solta a cor incompatível", () => {
    expect(selectValue(dress, { cor: "verde" }, "tamanho", "2")).toEqual({ tamanho: "2" });
  });

  it("valor inexistente não muda nada além de descartá-lo", () => {
    expect(selectValue(dress, { cor: "rosa" }, "tamanho", "99")).toEqual({ cor: "rosa" });
  });
});

describe("valueState (o que cada botão de opção mostra)", () => {
  it("sem escolha: todos existem e combinam; o azul só tem combinação esgotada", () => {
    expect(valueState(dress, {}, "cor", "rosa")).toEqual({ selected: false, exists: true, compatible: true, available: true });
    expect(valueState(dress, {}, "cor", "azul")).toEqual({ selected: false, exists: true, compatible: true, available: false });
  });

  it("com a cor azul escolhida: o tamanho 2 está esgotado; o 4 não combina, mas continua escolhível", () => {
    const selection = { cor: "azul" };
    expect(valueState(dress, selection, "tamanho", "2")).toMatchObject({ exists: true, compatible: true, available: false });
    // azul·4 não existe; o 4 existe em outras cores (e está disponível nelas).
    expect(valueState(dress, selection, "tamanho", "4")).toMatchObject({ exists: true, compatible: false, available: true });
  });

  it("valor sem nenhuma combinação não existe e não pode ser escolhido", () => {
    const noGreen = { ...dress, variants: dress.variants.filter((variant) => variant.values.cor !== "verde") };
    expect(valueState(noGreen, {}, "cor", "verde")).toMatchObject({ exists: false, compatible: false, available: false });
  });

  it("marca o valor escolhido", () => {
    expect(valueState(dress, { cor: "rosa" }, "cor", "rosa").selected).toBe(true);
    expect(valueState(dress, { cor: "rosa" }, "cor", "azul").selected).toBe(false);
  });

  it("a própria escolha da opção não restringe as alternativas dessa opção", () => {
    // Com rosa escolhido, verde continua escolhível para trocar (verde existe no tamanho 4).
    expect(valueState(dress, { cor: "rosa" }, "cor", "verde").exists).toBe(true);
  });
});

describe("combinação escolhida", () => {
  it("só existe com todas as opções escolhidas", () => {
    expect(selectedVariant(dress, {})).toBeNull();
    expect(selectedVariant(dress, { cor: "rosa" })).toBeNull();
    expect(selectedVariant(dress, { cor: "rosa", tamanho: "4" })?.id).toBe("v2");
  });

  it("produto simples usa a variante padrão sem escolha", () => {
    expect(selectedVariant(simple, {})?.id).toBe("only");
  });

  it("lista o que falta escolher, na ordem do produto", () => {
    expect(missingOptions(dress, {})).toEqual(["Cor", "Tamanho"]);
    expect(missingOptions(dress, { cor: "rosa" })).toEqual(["Tamanho"]);
    expect(missingOptions(dress, { cor: "rosa", tamanho: "2" })).toEqual([]);
  });
});

describe("priceView (BR-024)", () => {
  it("sem escolha: preço de partida entre as combinações disponíveis, com 'a partir de'", () => {
    // O verde tem preço próprio zero, que é válido e é o menor.
    expect(priceView(dress, {})).toEqual({ cents: 0, from: true });
  });

  it("escolhendo só a cor, o intervalo se limita a ela", () => {
    expect(priceView(dress, { cor: "rosa" })).toEqual({ cents: 7990, from: true });
    expect(priceView(dress, { cor: "verde" })).toEqual({ cents: 0, from: false });
  });

  it("cor toda esgotada: usa o preço de todas as combinações dela", () => {
    expect(priceView(dress, { cor: "azul" })).toEqual({ cents: 7990, from: false });
  });

  it("combinação escolhida mostra o preço efetivo dela", () => {
    expect(priceView(dress, { cor: "rosa", tamanho: "4" })).toEqual({ cents: 8990, from: false });
    expect(priceView(dress, { cor: "rosa", tamanho: "2" })).toEqual({ cents: 7990, from: false });
    expect(priceView(dress, { cor: "verde", tamanho: "4" })).toEqual({ cents: 0, from: false });
  });

  it("produto simples e produto sem combinações", () => {
    expect(priceView(simple, {})).toEqual({ cents: 5000, from: false });
    expect(priceView({ ...dress, variants: [] }, {})).toEqual({ cents: 7990, from: false });
  });
});

describe("galleryFor (BR-031, BR-032)", () => {
  const ids = (selection: Record<string, string>) => galleryFor(dress, selection).map((image) => image.id);

  it("sem cor escolhida, só as gerais", () => {
    expect(ids({})).toEqual(["g1", "g2"]);
  });

  it("cor escolhida: as dela primeiro, depois as gerais, sem fotos de outra cor", () => {
    expect(ids({ cor: "rosa" })).toEqual(["r1", "g1", "g2"]);
    expect(ids({ cor: "azul" })).toEqual(["a1", "g1", "g2"]);
  });

  it("trocar a cor muda a galeria; trocar o tamanho não", () => {
    expect(ids({ cor: "rosa" })).not.toEqual(ids({ cor: "azul" }));
    expect(ids({ cor: "rosa", tamanho: "2" })).toEqual(ids({ cor: "rosa", tamanho: "4" }));
    expect(ids({ tamanho: "4" })).toEqual(ids({}));
  });

  it("cor sem fotos próprias usa as gerais", () => {
    expect(ids({ cor: "verde" })).toEqual(["g1", "g2"]);
  });
});

describe("ctaState (OQ-08: o WhatsApp exige a escolha completa)", () => {
  it("sem escolha: pede cor e tamanho", () => {
    expect(ctaState(dress, {})).toEqual({ kind: "choose", missing: ["Cor", "Tamanho"] });
  });

  it("escolha parcial: pede só o que falta", () => {
    expect(ctaState(dress, { cor: "rosa" })).toEqual({ kind: "choose", missing: ["Tamanho"] });
    expect(ctaState(dress, { tamanho: "2" })).toEqual({ kind: "choose", missing: ["Cor"] });
  });

  it("combinação completa e disponível: pronto", () => {
    const state = ctaState(dress, { cor: "rosa", tamanho: "4" });
    expect(state).toMatchObject({ kind: "ready", variant: { id: "v2" } });
  });

  it("combinação esgotada: indisponível (não oferece o botão como disponível)", () => {
    expect(ctaState(dress, { cor: "azul", tamanho: "2" })).toEqual({ kind: "unavailable", reason: "combination" });
  });

  it("produto simples fica pronto sem escolha", () => {
    expect(ctaState(simple, {})).toMatchObject({ kind: "ready" });
  });

  it("produto todo esgotado ou sem combinações: indisponível, mesmo com escolha", () => {
    const soldOut = { ...dress, variants: dress.variants.map((variant) => ({ ...variant, isAvailable: false })) };
    expect(ctaState(soldOut, {})).toEqual({ kind: "unavailable", reason: "product" });
    expect(ctaState(soldOut, { cor: "rosa", tamanho: "2" })).toEqual({ kind: "unavailable", reason: "product" });
    expect(ctaState({ ...dress, variants: [] }, {})).toEqual({ kind: "unavailable", reason: "product" });
  });
});

describe("productHref", () => {
  it("monta o endereço com a escolha, na ordem das opções", () => {
    expect(productHref(dress, { tamanho: "4", cor: "rosa" })).toBe("/produto/vestido-floral?cor=rosa&tamanho=4");
    expect(productHref(dress, { cor: "rosa" })).toBe("/produto/vestido-floral?cor=rosa");
  });

  it("sem escolha é o endereço limpo", () => {
    expect(productHref(dress, {})).toBe("/produto/vestido-floral");
    expect(productHref(simple, {})).toBe("/produto/vestido-floral");
  });

  it("ignora o que não é opção do produto", () => {
    expect(productHref(dress, { material: "seda" })).toBe("/produto/vestido-floral");
  });
});

describe("buildWhatsAppMessage (BR-040, BR-042)", () => {
  const variant = dress.variants[1];

  it("identifica produto, cor, tamanho, preço e traz o link da combinação", () => {
    const message = buildWhatsAppMessage({
      detail: dress,
      selection: { cor: "rosa", tamanho: "4" },
      variant,
      url: "https://loja.example/produto/vestido-floral?cor=rosa&tamanho=4",
    });
    expect(message).toBe(
      [
        "Olá! Tenho interesse neste produto:",
        "",
        "*Vestido Floral*",
        "Cor: Rosa",
        "Tamanho: 4",
        `Preço: ${formatPrice(8990)}`,
        "",
        "https://loja.example/produto/vestido-floral?cor=rosa&tamanho=4",
      ].join("\n"),
    );
  });

  it("produto simples não tem linhas de opção; preço zero aparece", () => {
    const message = buildWhatsAppMessage({
      detail: { ...simple, name: "Brinde" },
      selection: {},
      variant: { id: "x", values: {}, priceCents: 0, isAvailable: true },
      url: "https://loja.example/produto/brinde",
    });
    expect(message).toContain(`Preço: ${formatPrice(0)}`);
    expect(message).not.toContain("Cor:");
  });

  it("não deixa o nome quebrar a formatação em negrito", () => {
    const message = buildWhatsAppMessage({
      detail: { ...dress, name: "Vestido *Luxo*" },
      selection: { cor: "rosa", tamanho: "4" },
      variant,
      url: "https://x.example/p",
    });
    expect(message).toContain("*Vestido Luxo*");
  });

  it("só diz que há interesse: sem palavras de pedido, compra ou reserva", () => {
    const message = buildWhatsAppMessage({
      detail: dress,
      selection: { cor: "rosa", tamanho: "4" },
      variant,
      url: "https://x.example/p",
    });
    expect(message.toLowerCase()).not.toMatch(/pedido|reserv|compr/);
  });
});
