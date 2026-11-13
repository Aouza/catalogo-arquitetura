import { describe, expect, it } from "vitest";
import type { AdminProduct } from "@/modules/products/get-admin-product";
import { structureSchema } from "@/modules/products/schemas";
import {
  addValue,
  emptyState,
  hydrateEditor,
  listCombos,
  removeValue,
  setCombo,
  toStructure,
  type EditorState,
} from "@/modules/products/structure-editor";

const build = (colors: string[], sizes: string[]): EditorState => {
  let state = emptyState();
  for (const color of colors) state = addValue(state, "colors", color).state;
  for (const size of sizes) state = addValue(state, "sizes", size).state;
  return state;
};

describe("combinações (o caso do vestido: 2 cores x 2 tamanhos)", () => {
  it("gera as 4 combinações sem o lojista criá-las uma a uma", () => {
    const combos = listCombos(build(["Rosa", "Azul"], ["2", "4"]));
    expect(combos.map((c) => c.label)).toEqual(["Rosa · 2", "Rosa · 4", "Azul · 2", "Azul · 4"]);
    expect(combos.every((c) => c.config.enabled && c.config.available && c.config.price === "")).toBe(true);
  });

  it("só cores, só tamanhos e produto único", () => {
    expect(listCombos(build(["Rosa", "Azul"], [])).map((c) => c.label)).toEqual(["Rosa", "Azul"]);
    expect(listCombos(build([], ["P", "M", "G"])).map((c) => c.label)).toEqual(["P", "M", "G"]);
    expect(listCombos(emptyState()).map((c) => c.label)).toEqual(["Produto único"]);
  });

  it("o resultado passa na validação do servidor", () => {
    const result = toStructure(build(["Rosa", "Azul"], ["2", "4"]));
    if (!result.ok) throw new Error(result.errors.join(", "));
    expect(structureSchema.safeParse(result.structure).success).toBe(true);
    expect(result.structure.variants).toHaveLength(4);
    expect(result.structure.options.map((o) => o.code)).toEqual(["cor", "tamanho"]);
  });

  it("produto único vira uma variante padrão sem opções", () => {
    const result = toStructure(emptyState());
    expect(result).toEqual({
      ok: true,
      structure: { options: [], variants: [{ values: {}, priceOverrideCents: null, isAvailable: true, position: 0 }] },
    });
  });

  it("só tamanhos: a opção de tamanho tem posição 0", () => {
    const result = toStructure(build([], ["P", "M"]));
    if (!result.ok) throw new Error("falhou");
    expect(result.structure.options).toEqual([expect.objectContaining({ code: "tamanho", position: 0 })]);
  });
});

describe("revisão das combinações", () => {
  it("desmarcar uma combinação a remove do resultado", () => {
    let state = build(["Rosa", "Azul"], ["2", "4"]);
    state = setCombo(state, "azul|2", { enabled: false });
    const result = toStructure(state);
    if (!result.ok) throw new Error("falhou");
    expect(result.structure.variants).toHaveLength(3);
    expect(result.structure.variants.map((v) => v.values)).not.toContainEqual({ cor: "azul", tamanho: "2" });
  });

  it("preço próprio, preço zero, vazio (herda) e indisponível", () => {
    let state = build(["Rosa", "Azul"], ["2"]);
    state = setCombo(state, "rosa|2", { price: "89,90" });
    state = setCombo(state, "azul|2", { price: "0", available: false });
    const result = toStructure(state);
    if (!result.ok) throw new Error("falhou");
    const byColor = Object.fromEntries(result.structure.variants.map((v) => [v.values.cor, v]));
    expect(byColor.rosa).toMatchObject({ priceOverrideCents: 8990, isAvailable: true });
    expect(byColor.azul).toMatchObject({ priceOverrideCents: 0, isAvailable: false });

    const inherit = toStructure(build(["Rosa"], []));
    expect(inherit.ok && inherit.structure.variants[0].priceOverrideCents).toBeNull();
  });

  it("aponta preço inválido pelo nome da combinação", () => {
    const state = setCombo(build(["Rosa"], ["4"]), "rosa|4", { price: "abc" });
    expect(toStructure(state)).toEqual({
      ok: false,
      errors: ["Preço inválido em “Rosa · 4”. Use um valor como 79,90."],
    });
  });

  it("preço inválido de combinação desmarcada não atrapalha", () => {
    let state = build(["Rosa", "Azul"], []);
    state = setCombo(state, "azul|", { enabled: false, price: "abc" });
    expect(toStructure(state).ok).toBe(true);
  });

  it("exige ao menos uma combinação marcada", () => {
    const state = setCombo(emptyState(), "|", { enabled: false });
    expect(toStructure(state)).toEqual({ ok: false, errors: ["Marque ao menos uma combinação."] });
  });

  it("mantém o que o lojista já configurou ao acrescentar uma cor", () => {
    let state = build(["Rosa"], ["2", "4"]);
    state = setCombo(state, "rosa|4", { price: "89,90", available: false });
    state = addValue(state, "colors", "Azul").state;
    const rosa4 = listCombos(state).find((c) => c.key === "rosa|4")!;
    expect(rosa4.config).toMatchObject({ price: "89,90", available: false });
    expect(listCombos(state)).toHaveLength(4);
  });

  it("remover uma cor tira as combinações dela", () => {
    const state = removeValue(build(["Rosa", "Azul"], ["2", "4"]), "colors", "Azul");
    expect(listCombos(state).map((c) => c.label)).toEqual(["Rosa · 2", "Rosa · 4"]);
  });
});

describe("validação dos nomes (cores e tamanhos)", () => {
  const state = build(["Rosa"], ["2"]);

  it.each([
    ["", "Digite um nome."],
    ["   ", "Digite um nome."],
    ["!!!", "Use ao menos uma letra ou número."],
    ["a".repeat(61), "Use no máximo 60 caracteres."],
    ["rosa", "Essa cor já foi adicionada."],
    ["  ROSA ", "Essa cor já foi adicionada."],
  ])("cor %j → %s", (label, message) => {
    expect(addValue(state, "colors", label).error).toBe(message);
  });

  it("não deixa repetir o tamanho nem mudar o estado quando há erro", () => {
    const result = addValue(state, "sizes", "2");
    expect(result.error).toBe("Esse tamanho já foi adicionado.");
    expect(result.state).toBe(state);
  });

  it("aceita acentos e espaços; o nome digitado é preservado", () => {
    const result = addValue(emptyState(), "colors", "  Azul-bebê claro ");
    expect(result.error).toBeUndefined();
    expect(result.state.colors).toEqual(["Azul-bebê claro"]);
    expect(listCombos(result.state)[0].colorCode).toBe("azul-bebe-claro");
  });

  it("limita a 20 valores no total", () => {
    let current = emptyState();
    for (let i = 0; i < 20; i++) current = addValue(current, i % 2 ? "sizes" : "colors", `v${i}`).state;
    // 10 cores x 10 tamanhos = 100 combinações: com 20 valores no total, é o máximo possível.
    expect(listCombos(current)).toHaveLength(100);
    expect(addValue(current, "colors", "extra").error).toBe("No máximo 20 cores e tamanhos no total.");
  });
});

const saved = (overrides: Partial<Pick<AdminProduct, "options" | "variants">>) => ({
  options: [],
  variants: [],
  ...overrides,
});

const colorOption = {
  id: "o1",
  code: "cor",
  name: "Cor",
  position: 0,
  values: [
    { id: "v1", code: "rosa", label: "Rosa", position: 0 },
    { id: "v2", code: "azul", label: "Azul", position: 1 },
  ],
};
const sizeOption = {
  id: "o2",
  code: "tamanho",
  name: "Tamanho",
  position: 1,
  values: [
    { id: "v3", code: "2", label: "2", position: 0 },
    { id: "v4", code: "4", label: "4", position: 1 },
  ],
};

const variant = (values: Record<string, string>, override: number | null = null, isAvailable = true) => ({
  id: crypto.randomUUID(),
  values,
  priceOverrideCents: override,
  effectivePriceCents: override ?? 7990,
  isAvailable,
  position: 0,
});

describe("hydrateEditor (editar um produto salvo)", () => {
  it("produto novo, sem nada salvo, começa vazio com tudo marcado", () => {
    expect(hydrateEditor(saved({}))).toEqual({ supported: true, state: emptyState() });
  });

  it("restaura cores, tamanhos, preços e disponibilidade; o que falta fica desmarcado", () => {
    const result = hydrateEditor(
      saved({
        options: [colorOption, sizeOption],
        variants: [
          variant({ cor: "rosa", tamanho: "2" }),
          variant({ cor: "rosa", tamanho: "4" }, 8990),
          variant({ cor: "azul", tamanho: "4" }, 0, false),
        ],
      }),
    );
    if (!result.supported) throw new Error("deveria ser suportado");

    const combos = Object.fromEntries(listCombos(result.state).map((c) => [c.label, c.config]));
    expect(combos["Rosa · 4"]).toEqual({ enabled: true, price: "89,90", available: true });
    expect(combos["Azul · 4"]).toEqual({ enabled: true, price: "0,00", available: false });
    expect(combos["Azul · 2"].enabled).toBe(false);
    expect(combos["Rosa · 2"].enabled).toBe(true);
  });

  it("ida e volta: o que foi salvo é o que volta ao salvar de novo", () => {
    const original = setCombo(build(["Rosa", "Azul"], ["2", "4"]), "azul|2", { enabled: false });
    const first = toStructure(setCombo(original, "rosa|4", { price: "89,90" }));
    if (!first.ok) throw new Error("falhou");

    const product = {
      options: first.structure.options.map((option, index) => ({
        id: `o${index}`,
        code: option.code,
        name: option.name,
        position: index,
        values: option.values.map((value, i) => ({ id: `${option.code}${i}`, ...value, position: i })),
      })),
      variants: first.structure.variants.map((v) =>
        variant(v.values, v.priceOverrideCents ?? null, v.isAvailable ?? true),
      ),
    };
    const hydrated = hydrateEditor(product);
    if (!hydrated.supported) throw new Error("deveria ser suportado");
    const second = toStructure(hydrated.state);
    if (!second.ok) throw new Error("falhou");

    const sortKey = (v: { values: Record<string, string> }) => JSON.stringify(v.values);
    const normalize = (s: typeof first.structure) =>
      [...s.variants]
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
        .map((v) => ({ values: v.values, price: v.priceOverrideCents, available: v.isAvailable }));
    expect(normalize(second.structure)).toEqual(normalize(first.structure));
  });

  it("produto simples com preço próprio na variante padrão", () => {
    const result = hydrateEditor(saved({ variants: [variant({}, 5000)] }));
    if (!result.supported) throw new Error("deveria ser suportado");
    expect(listCombos(result.state)[0].config).toEqual({ enabled: true, price: "50,00", available: true });
  });

  it("não suporta produto com opções diferentes de cor e tamanho", () => {
    const material = { ...colorOption, id: "o9", code: "material", name: "Material" };
    expect(hydrateEditor(saved({ options: [material] }))).toEqual({ supported: false });
  });
});
