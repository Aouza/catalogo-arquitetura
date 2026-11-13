import { describe, expect, it } from "vitest";
import { mapDbError } from "@/modules/products/errors";
import { effectivePriceCents } from "@/modules/products/price";
import {
  createProductSchema,
  structureSchema,
  updateProductSchema,
  validationError,
} from "@/modules/products/schemas";
import { canTransition } from "@/modules/products/set-status";
import { slugify } from "@/modules/products/slug";

describe("effectivePriceCents (BR-024)", () => {
  it("herda o preço base quando o override é null", () => {
    expect(effectivePriceCents(7990, null)).toBe(7990);
  });
  it("usa o override quando existe", () => {
    expect(effectivePriceCents(7990, 8990)).toBe(8990);
  });
  it("zero é um preço válido e não herda o base", () => {
    expect(effectivePriceCents(7990, 0)).toBe(0);
  });
  it("base zero continua zero", () => {
    expect(effectivePriceCents(0, null)).toBe(0);
  });
});

describe("slugify", () => {
  it.each([
    ["Vestido Rosa", "vestido-rosa"],
    ["  Calça   Jeans!! ", "calca-jeans"],
    ["Camiseta Infantil — Ação", "camiseta-infantil-acao"],
    ["Pé-de-moleque 2024", "pe-de-moleque-2024"],
    ["!!!", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("respeita o limite de tamanho sem terminar em hífen", () => {
    const slug = slugify("a ".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("createProductSchema / updateProductSchema", () => {
  it("aceita produto mínimo e usa descrição vazia", () => {
    const parsed = createProductSchema.parse({ name: "  Vestido ", basePriceCents: 0 });
    expect(parsed).toMatchObject({ name: "Vestido", description: "", basePriceCents: 0 });
  });

  it.each([
    [{ name: "", basePriceCents: 100 }, "Informe o nome"],
    [{ name: "X", basePriceCents: -1 }, "negativo"],
    [{ name: "X", basePriceCents: 10.5 }, "centavos inteiros"],
    [{ name: "X", basePriceCents: "10" }, "Informe o preço"],
    [{ name: "X", basePriceCents: 1, slug: "Inválido Slug" }, "Endereço inválido"],
    [{ name: "X", basePriceCents: 1, categoryId: "nao-uuid" }, "Categoria inválida"],
  ])("rejeita %j", (input, message) => {
    const result = createProductSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(validationError(result.error).message).toContain(message);
  });

  it("update exige ao menos um campo e não inclui slug por padrão", () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false);
    const parsed = updateProductSchema.parse({ name: "Novo nome" });
    expect("slug" in parsed).toBe(false);
  });

  it("update aceita categoria nula (remover categoria)", () => {
    expect(updateProductSchema.parse({ categoryId: null })).toEqual({ categoryId: null });
  });
});

const color = { code: "cor", name: "Cor", values: [{ code: "rosa", label: "Rosa" }, { code: "azul", label: "Azul" }] };
const size = { code: "tamanho", name: "Tamanho", values: [{ code: "2", label: "2" }, { code: "4", label: "4" }] };

describe("structureSchema", () => {
  it("aceita produto simples (sem opções, uma variante padrão)", () => {
    expect(structureSchema.safeParse({ options: [], variants: [{ values: {} }] }).success).toBe(true);
  });

  it("aceita cor x tamanho completos, com override zero", () => {
    const result = structureSchema.safeParse({
      options: [color, size],
      variants: [
        { values: { cor: "rosa", tamanho: "2" }, priceOverrideCents: 0 },
        { values: { cor: "rosa", tamanho: "4" }, priceOverrideCents: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  const messageFor = (input: unknown) => {
    const result = structureSchema.safeParse(input);
    return result.success ? null : validationError(result.error).issues;
  };

  it("rejeita combinação repetida", () => {
    expect(
      messageFor({ options: [color], variants: [{ values: { cor: "rosa" } }, { values: { cor: "rosa" } }] }),
    ).toContain("Há combinações repetidas.");
  });

  it("rejeita variante incompleta ou com valor inexistente", () => {
    expect(messageFor({ options: [color, size], variants: [{ values: { cor: "rosa" } }] })).toContain(
      "Cada combinação precisa de exatamente um valor por opção.",
    );
    expect(messageFor({ options: [color], variants: [{ values: { cor: "verde" } }] })).toContain(
      "A combinação usa um valor que não existe na opção.",
    );
  });

  it("rejeita código repetido de opção ou de valor", () => {
    expect(messageFor({ options: [color, color], variants: [] })).toContain("Há opções com o mesmo código.");
    const dup = { ...color, values: [{ code: "rosa", label: "A" }, { code: "rosa", label: "B" }] };
    expect(messageFor({ options: [dup], variants: [] })).toContain("Há valores repetidos na mesma opção.");
  });

  it("rejeita opção sem valores e override negativo", () => {
    expect(messageFor({ options: [{ ...color, values: [] }], variants: [] })).toContain(
      "Cada opção precisa de ao menos um valor.",
    );
    expect(
      messageFor({ options: [], variants: [{ values: {}, priceOverrideCents: -5 }] }),
    ).toContain("O preço não pode ser negativo.");
  });

  it("aplica os limites de BR-017 (opções, valores e variantes)", () => {
    const third = { code: "material", name: "Material", values: [{ code: "x", label: "x" }] };
    expect(messageFor({ options: [color, size, third], variants: [] })).toContain(
      "No máximo 2 opções por produto.",
    );

    const many = {
      code: "n",
      name: "N",
      values: Array.from({ length: 21 }, (_, i) => ({ code: `v${i}`, label: `v${i}` })),
    };
    expect(messageFor({ options: [many], variants: [] })).toContain("No máximo 20 valores no total.");

    const tooMany = Array.from({ length: 101 }, () => ({ values: {} }));
    expect(messageFor({ options: [], variants: tooMany })).toContain(
      "No máximo 100 combinações por produto.",
    );
  });
});

describe("canTransition", () => {
  it.each([
    ["draft", "published", true],
    ["published", "draft", true],
    ["published", "archived", true],
    ["archived", "draft", true],
    ["archived", "published", false],
    ["draft", "archived", false],
    ["draft", "draft", true],
  ] as const)("%s → %s = %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});

describe("mapDbError", () => {
  it("produto incompleto lista as pendências em pt-BR", () => {
    const error = mapDbError({
      code: "23514",
      message: "product cannot be published: no_variants, option_without_values",
    });
    expect(error.code).toBe("incomplete_product");
    expect(error.issues).toEqual([
      "Cadastre ao menos uma opção de compra.",
      "Toda opção precisa de ao menos um valor.",
    ]);
  });

  it("limites do banco", () => {
    expect(mapDbError({ code: "23514", message: "product cannot have more than 2 options" }).code).toBe(
      "limit_exceeded",
    );
    expect(mapDbError({ code: "23514", message: "product cannot have more than 100 variants" }).code).toBe(
      "limit_exceeded",
    );
  });

  it("slug repetido, permissão, não encontrado e categoria inválida", () => {
    expect(
      mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "products_slug_key"' }).code,
    ).toBe("slug_taken");
    expect(mapDbError({ code: "42501", message: "new row violates row-level security policy" }).code).toBe("forbidden");
    expect(mapDbError({ code: "P0002", message: "product not found" }).code).toBe("not_found");
    expect(mapDbError({ code: "23503", message: "fk" }).code).toBe("validation");
  });

  it("erro desconhecido não vaza a mensagem interna", () => {
    const error = mapDbError({ code: "XX000", message: "relation \"secret_table\" exploded" });
    expect(error.code).toBe("unexpected");
    expect(JSON.stringify(error)).not.toContain("secret_table");
  });
});
